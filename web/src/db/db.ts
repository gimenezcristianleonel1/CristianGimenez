import Dexie, { type Table } from 'dexie';
import type {
  Animal,
  ConflictRow,
  HealthRow,
  LocationRow,
  MovementRow,
  OutboxOp,
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
  }
}

export const db = new LivestockDB();
