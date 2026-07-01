import Dexie, { type Table } from 'dexie';
import type {
  Animal,
  ConflictRow,
  HealthRow,
  LocationRow,
  MovementRow,
  OutboxOp,
  ReproCheckRow,
  TaskRow,
  WeightRow,
} from '../lib/types';

/**
 * Local offline-first database (IndexedDB via Dexie).
 *
 * Entity tables are the source of truth for the UI while offline. The `outbox`
 * table is the client-side queue of API calls to replay when connectivity
 * returns; `conflicts` keeps server-rejected operations for the user to see.
 */
export class LivestockDB extends Dexie {
  animals!: Table<Animal, string>;
  locations!: Table<LocationRow, string>;
  weights!: Table<WeightRow, string>;
  health!: Table<HealthRow, string>;
  movements!: Table<MovementRow, string>;
  outbox!: Table<OutboxOp, string>;
  conflicts!: Table<ConflictRow, string>;
  tasks!: Table<TaskRow, string>;
  reproChecks!: Table<ReproCheckRow, string>;

  constructor() {
    super('livestock');
    this.version(1).stores({
      animals: 'id, tagId, status, currentLocationId, _dirty',
      locations: 'id, name, type, _dirty',
      weights: 'id, animalId, measuredAt',
      health: 'id, animalId, appliedAt, withdrawalUntil',
      movements: 'id, animalId, movedAt',
      outbox: 'id, kind, createdAt',
      conflicts: 'id, at',
    });
    // v2: planificación y tareas.
    this.version(2).stores({
      tasks: 'id, dueDate, status, _dirty',
    });
    // v3: diagnóstico reproductivo (tacto / ecografía).
    this.version(3).stores({
      reproChecks: 'id, potreroId, animalId, date, _dirty',
    });
  }
}

export const db = new LivestockDB();

/** Wipes all local data — used when a different establishment logs in. */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.animals.clear(),
    db.locations.clear(),
    db.weights.clear(),
    db.health.clear(),
    db.movements.clear(),
    db.tasks.clear(),
    db.reproChecks.clear(),
    db.outbox.clear(),
    db.conflicts.clear(),
  ]);
}
