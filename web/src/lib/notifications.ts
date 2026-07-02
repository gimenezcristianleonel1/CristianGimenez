import type { TaskRow } from './types';

/**
 * Avisos al dispositivo para tareas pendientes (Planificación).
 *
 * Estrategia sin backend:
 *  - Si el navegador soporta `TimestampTrigger` (Chrome/Edge en Android/escritorio),
 *    se PROGRAMAN las notificaciones a la hora exacta; se disparan aunque la app
 *    esté cerrada.
 *  - Si no, se usa un fallback en primer plano: al abrir la app / cada pocos
 *    minutos se revisan las tareas y se avisan los hitos recién vencidos.
 *
 * Se avisa en tres momentos antes del vencimiento y se evita duplicar.
 */

const ICON = '/ICONO.jpeg';
const TAG_PREFIX = 'gtask:';
const SHOWN_KEY = 'ganaderia.remindersShown';
/** Ventana para mostrar (fallback) un hito ya pasado sin repetirlo indefinidamente. */
const GRACE_MS = 6 * 3600_000;

const MILESTONES: Array<{ key: string; offset: number; label: string }> = [
  { key: '1d', offset: 24 * 3600_000, label: 'Vence mañana' },
  { key: '3h', offset: 3 * 3600_000, label: 'Vence en unas horas' },
  { key: 'due', offset: 0, label: 'Vence ahora' },
];

export function notifSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

export function notifPermission(): NotificationPermission {
  return notifSupported() ? Notification.permission : 'denied';
}

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (!notifSupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function supportsTriggers(): boolean {
  return typeof window !== 'undefined' && 'TimestampTrigger' in window;
}

function validDue(t: TaskRow): number | null {
  if (t.status !== 'PENDING' || !t.dueDate) return null;
  const ms = new Date(t.dueDate).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function loadShown(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveShown(s: Set<string>): void {
  try {
    // Mantener acotado el historial local.
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    /* almacenamiento no disponible */
  }
}

/**
 * Sincroniza los avisos con el estado actual de las tareas.
 * Idempotente: se puede llamar en cada cambio de tareas.
 */
export async function syncTaskReminders(tasks: TaskRow[]): Promise<void> {
  if (!notifSupported() || Notification.permission !== 'granted') return;

  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.ready;
  } catch {
    return;
  }

  const now = Date.now();
  const pending = tasks
    .map((t) => ({ t, due: validDue(t) }))
    .filter((x): x is { t: TaskRow; due: number } => x.due !== null);

  if (supportsTriggers()) {
    // --- Camino con programación exacta (funciona con la app cerrada). ---
    const validTags = new Set<string>();
    for (const { t, due } of pending) {
      for (const m of MILESTONES) {
        const at = due - m.offset;
        if (at <= now) continue; // en el pasado: no se puede programar
        const tag = `${TAG_PREFIX}${t.id}:${m.key}`;
        validTags.add(tag);
        try {
          await reg.showNotification('Tarea pendiente', {
            tag,
            body: `${t.title} — ${m.label} (${fmt(t.dueDate!)})`,
            icon: ICON,
            badge: ICON,
            data: { url: '/tasks', taskId: t.id },
            // showTrigger es experimental; no está en los tipos del DOM.
            showTrigger: new (window as unknown as {
              TimestampTrigger: new (t: number) => unknown;
            }).TimestampTrigger(at),
          } as NotificationOptions);
        } catch {
          /* ignorar fallos de programación individuales */
        }
      }
    }
    // Cancelar programadas obsoletas (tareas completadas, borradas o reprogramadas).
    try {
      const existing = await reg.getNotifications({
        includeTriggered: true,
      } as unknown as GetNotificationOptions);
      for (const n of existing) {
        if (n.tag && n.tag.startsWith(TAG_PREFIX) && !validTags.has(n.tag)) n.close();
      }
    } catch {
      /* getNotifications con includeTriggered puede no estar disponible */
    }
    return;
  }

  // --- Fallback en primer plano: avisar hitos recién vencidos, sin repetir. ---
  const shown = loadShown();
  let changed = false;
  for (const { t, due } of pending) {
    for (const m of MILESTONES) {
      const at = due - m.offset;
      const id = `${t.id}:${m.key}`;
      if (now >= at && now <= at + GRACE_MS && !shown.has(id)) {
        try {
          await reg.showNotification('Tarea pendiente', {
            tag: `${TAG_PREFIX}${id}`,
            body: `${t.title} — ${m.label} (${fmt(t.dueDate!)})`,
            icon: ICON,
            badge: ICON,
            data: { url: '/tasks', taskId: t.id },
          });
          shown.add(id);
          changed = true;
        } catch {
          /* ignorar */
        }
      }
    }
  }
  if (changed) saveShown(shown);
}
