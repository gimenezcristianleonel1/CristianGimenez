import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { ParsedEvent } from './dto/parsed-event';
import { EffectContext, TargetAnimal, getEffect, toEnumType } from './event-registry';

/**
 * Motor GENÉRICO de eventos de WhatsApp.
 *
 *  1. Resuelve los animales objetivo (por caravana y/o por potrero de grupo).
 *  2. Si el eventType tiene un efecto declarado (mutación de estado / append
 *     especializado), lo ejecuta desde el registro.
 *  3. SIEMPRE registra el evento en la bitácora (`AnimalEvent`, JSONB). Un
 *     eventType nuevo se guarda solo (enum OTRO + eventType real en el JSON),
 *     sin necesidad de reescribir el servidor.
 */
@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(establishmentId: string, ev: ParsedEvent): Promise<string> {
    const type = (ev.eventType || 'NOTA').toUpperCase();
    const animals = await this.resolveTargets(establishmentId, ev);
    const effect = getEffect(type);

    let effectMsg = '';
    if (effect) {
      const ctx: EffectContext = {
        prisma: this.prisma,
        establishmentId,
        animals, // mutable: los handlers de creación pueden agregar animales
        metadata: ev.metadata ?? {},
        observations: ev.observations ?? null,
        resolveLocationId: (name) => this.resolveLocationId(establishmentId, name),
      };
      try {
        effectMsg = await effect(ctx);
      } catch (err) {
        this.logger.error(`Efecto ${type} falló: ${(err as Error).message}`);
        effectMsg = 'Hubo un problema al aplicar la acción; quedó anotada igual.';
      }
    }

    // Log genérico e idempotente-friendly: siempre deja rastro en la bitácora.
    await this.logEvents(establishmentId, type, ev, animals);

    if (!animals.length && !effect) {
      return 'No pude identificar el animal. Ej: "murió la 120" o "pesé 320 la 140".';
    }
    return (
      effectMsg ||
      `✅ Registrado "${type}"${animals.length ? ` en ${animals.length} animal(es)` : ''}.`
    );
  }

  /** Caravanas explícitas + (opcional) todos los activos de un potrero de grupo. */
  private async resolveTargets(establishmentId: string, ev: ParsedEvent): Promise<TargetAnimal[]> {
    const byId = new Map<string, TargetAnimal>();
    const add = (rows: Array<{ id: string; tagId: string; currentLocationId: string | null; metadata: unknown }>) => {
      for (const a of rows) {
        byId.set(a.id, {
          id: a.id,
          tagId: a.tagId,
          currentLocationId: a.currentLocationId,
          metadata: (a.metadata as Record<string, unknown>) ?? {},
        });
      }
    };

    const tags = (ev.animalTags ?? []).map(String).filter(Boolean);
    if (tags.length) {
      add(
        await this.prisma.animal.findMany({
          where: { establishmentId, tagId: { in: tags } },
          select: { id: true, tagId: true, currentLocationId: true, metadata: true },
        }),
      );
    }

    if (ev.groupLocation) {
      const loc = await this.resolveLocationId(establishmentId, String(ev.groupLocation));
      if (loc) {
        add(
          await this.prisma.animal.findMany({
            where: { establishmentId, currentLocationId: loc.id, status: 'ACTIVE' },
            select: { id: true, tagId: true, currentLocationId: true, metadata: true },
          }),
        );
      }
    }

    return [...byId.values()];
  }

  private async resolveLocationId(
    establishmentId: string,
    name: string,
  ): Promise<{ id: string; name: string } | null> {
    const n = String(name).trim();
    if (!n) return null;
    const loc = await this.prisma.location.findFirst({
      where: { establishmentId, name: { contains: n, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    return loc ?? null;
  }

  /** Registra el evento en la bitácora por cada animal afectado (JSONB flexible). */
  private async logEvents(
    establishmentId: string,
    type: string,
    ev: ParsedEvent,
    animals: TargetAnimal[],
  ): Promise<void> {
    if (!animals.length) return;
    const enumType = toEnumType(type);
    const data = {
      eventType: type,
      source: 'whatsapp',
      ...(ev.metadata ?? {}),
    } as Prisma.InputJsonValue;

    await Promise.all(
      animals.map((a) =>
        this.prisma.animalEvent
          .create({
            data: {
              type: enumType,
              note: ev.observations ?? null,
              data,
              animal: { connect: { id: a.id } },
              establishment: { connect: { id: establishmentId } },
            },
          })
          .catch((e: unknown) => this.logger.warn(`log evento falló: ${(e as Error).message}`)),
      ),
    );
  }
}
