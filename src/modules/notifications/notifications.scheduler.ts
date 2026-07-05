import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PushService } from './push.service';
import { NotificationsRepository } from './notifications.repository';

const HOUR = 3_600_000;
/** Ventana para avisar un hito recién pasado sin spamear tareas muy viejas. */
const GRACE_MS = 12 * HOUR;

const MILESTONES: Array<{ key: string; offset: number; label: string }> = [
  { key: '1d', offset: 24 * HOUR, label: 'Vence mañana' },
  { key: '3h', offset: 3 * HOUR, label: 'Vence en unas horas' },
  { key: 'due', offset: 0, label: 'Vence ahora' },
];

/**
 * Revisa periódicamente las tareas pendientes y envía avisos Web Push a los
 * navegadores suscriptos del establecimiento — funciona con la app cerrada.
 * Es un job de sistema (cross-tenant): recorre todos los establecimientos.
 */
@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);
  private running = false;

  constructor(
    private readonly push: PushService,
    private readonly repo: NotificationsRepository,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    if (!this.push.enabled || this.running) return;
    this.running = true;
    try {
      await this.run();
    } catch (err) {
      this.logger.error(`Scheduler de avisos falló: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async run(): Promise<void> {
    const now = Date.now();
    const tasks = await this.repo.findPendingWithDueDate();
    if (tasks.length === 0) return;

    // Una sola consulta de suscripciones por establecimiento.
    const subsCache = new Map<string, Awaited<ReturnType<NotificationsRepository['findSubscriptionsByEstablishment']>>>();
    const getSubs = async (estId: string) => {
      let s = subsCache.get(estId);
      if (!s) {
        s = await this.repo.findSubscriptionsByEstablishment(estId);
        subsCache.set(estId, s);
      }
      return s;
    };

    let sent = 0;
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const due = task.dueDate.getTime();
      const already = new Set(task.notifiedMilestones);

      const pendingMilestones = MILESTONES.filter((m) => {
        const at = due - m.offset;
        return !already.has(m.key) && now >= at && now <= at + GRACE_MS;
      });
      if (pendingMilestones.length === 0) continue;

      const nextMilestones = [...already, ...pendingMilestones.map((m) => m.key)];
      const subs = await getSubs(task.establishmentId);

      // Sin suscripciones: marcamos igual para no reevaluar indefinidamente.
      if (subs.length > 0) {
        // Enviamos solo el hito más urgente (el de menor offset) para no spamear.
        const milestone = pendingMilestones[pendingMilestones.length - 1];
        const fecha = task.dueDate.toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Argentina/Buenos_Aires',
        });
        const payload = {
          title: 'Tarea pendiente',
          body: `${task.title} — ${milestone.label} (${fecha})`,
          url: '/tasks',
        };
        for (const s of subs) {
          const res = await this.push.send(
            { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
            payload,
          );
          if (res === 'gone') await this.repo.deleteByEndpoint(s.endpoint);
          else if (res === 'ok') sent++;
        }
      }

      await this.repo.markMilestones(task.id, nextMilestones);
    }

    if (sent > 0) this.logger.log(`Avisos enviados: ${sent}`);
  }
}
