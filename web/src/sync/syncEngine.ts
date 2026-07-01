import { api, ApiError } from '../api/client';
import { db } from '../db/db';
import { uuid } from '../lib/uuid';
import type { Animal, LocationRow, TaskRow } from '../lib/types';

export interface SyncResult {
  pushed: number;
  rejected: number;
  pulled: number;
  remaining: number;
  errors: string[];
}

/** Terminal HTTP statuses: retrying won't help, so the op leaves the queue. */
function isTerminal(status: number): boolean {
  return status === 400 || status === 404 || status === 409 || status === 422;
}

/**
 * Replays the outbox against the API (FIFO). Successful and server-rejected
 * ops leave the queue; transient failures (offline / 5xx) keep the op for the
 * next attempt. Idempotent because every record carries a client-generated id.
 */
async function pushOutbox(result: SyncResult): Promise<void> {
  const ops = await db.outbox.orderBy('createdAt').toArray();

  for (const op of ops) {
    try {
      await api(op.path, { method: op.method, body: op.body });
      await db.transaction('rw', db.outbox, table(op.entityTable), async () => {
        await db.outbox.delete(op.id);
        await db.table(op.entityTable).update(op.entityId, { _dirty: 0 });
      });
      result.pushed++;
    } catch (err) {
      if (err instanceof ApiError && isTerminal(err.status)) {
        // Server rejected it (duplicate already synced, or a business rule):
        // record for visibility and stop retrying this op.
        await db.transaction('rw', db.outbox, db.conflicts, table(op.entityTable), async () => {
          await db.outbox.delete(op.id);
          await db.conflicts.add({
            id: uuid(),
            kind: op.kind,
            message: `${err.status}: ${err.message}`,
            body: op.body,
            at: new Date().toISOString(),
          });
          await db.table(op.entityTable).update(op.entityId, { _dirty: 0 });
        });
        result.rejected++;
        result.errors.push(`${op.kind}: ${err.message}`);
      } else {
        // Network error or 5xx: keep the op and stop (preserve ordering).
        await db.outbox.update(op.id, { attempts: op.attempts + 1 });
        break;
      }
    }
  }
}

interface Paged<T> {
  data: T[];
  meta: { totalPages: number };
}

/** Fetches every page of a paginated list endpoint (backend caps limit at 100). */
async function fetchAll<T>(basePath: string): Promise<T[]> {
  const first = await api<Paged<T>>(`${basePath}?limit=100&page=1`);
  const all = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page++) {
    const next = await api<Paged<T>>(`${basePath}?limit=100&page=${page}`);
    all.push(...next.data);
  }
  return all;
}

/** Pulls fresh server data into the local store, preserving unsynced edits. */
async function pullData(result: SyncResult): Promise<void> {
  const [animals, locations, tasksResp] = await Promise.all([
    fetchAll<Animal>('/animals'),
    fetchAll<LocationRow>('/locations'),
    // /tasks devuelve { success, notification, tasks } (sin paginar).
    api<{ tasks: TaskRow[] }>('/tasks'),
  ]);
  const tasks = tasksResp.tasks ?? [];

  await db.transaction('rw', db.animals, db.locations, db.tasks, async () => {
    for (const a of animals) {
      const local = await db.animals.get(a.id);
      if (!local?._dirty) {
        await db.animals.put({ ...a, _dirty: 0 });
        result.pulled++;
      }
    }
    for (const l of locations) {
      const local = await db.locations.get(l.id);
      if (!local?._dirty) {
        await db.locations.put({ ...l, _dirty: 0 });
        result.pulled++;
      }
    }
    for (const t of tasks) {
      const local = await db.tasks.get(t.id);
      if (!local?._dirty) {
        await db.tasks.put({ ...t, _dirty: 0 });
        result.pulled++;
      }
    }
  });
}

/**
 * Fast path: only pushes pending local changes to the API (no pull).
 * Se usa apenas el usuario guarda algo, para que el badge "sin sincronizar"
 * se limpie enseguida sin esperar el pull completo.
 */
export async function flushOutbox(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, rejected: 0, pulled: 0, remaining: 0, errors: [] };
  await pushOutbox(result);
  result.remaining = await db.outbox.count();
  return result;
}

/** Full sync: push pending changes, then pull fresh data. */
export async function runSync(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, rejected: 0, pulled: 0, remaining: 0, errors: [] };
  await pushOutbox(result);
  await pullData(result);
  result.remaining = await db.outbox.count();
  return result;
}

function table(name: string) {
  return db.table(name);
}
