// Domain types mirrored from the backend (kept in sync manually for the MVP).

export type Species = 'BOVINE' | 'PORCINE' | 'OVINE' | 'CAPRINE' | 'EQUINE' | 'OTHER';
export type Sex = 'MALE' | 'FEMALE';
export type AnimalStatus = 'ACTIVE' | 'QUARANTINE' | 'READY_FOR_SALE' | 'SOLD' | 'DECEASED';
export type LocationType =
  | 'PASTURE'
  | 'PEN'
  | 'CORRAL'
  | 'BARN'
  | 'QUARANTINE_AREA'
  | 'PADDOCK';
export type HealthEventType =
  | 'VACCINATION'
  | 'DEWORMING'
  | 'TREATMENT'
  | 'SURGERY'
  | 'CHECKUP'
  | 'OTHER';
export type WeightSource = 'MANUAL' | 'SCALE' | 'IOT_SENSOR' | 'ESTIMATED';
export type MovementReason =
  | 'ROTATION'
  | 'OVERGRAZING_PREVENTION'
  | 'MEDICAL'
  | 'WEANING'
  | 'SALE_PREPARATION'
  | 'REGROUPING'
  | 'OTHER';

export interface Animal {
  id: string;
  tagId: string;
  species: Species;
  breed: string;
  sex: Sex;
  birthDate: string;
  entryDate?: string | null;
  initialWeightKg: number | string;
  status: AnimalStatus;
  currentLocationId: string | null;
  motherId?: string | null;
  fatherId?: string | null;
  observations?: string | null;
  metadata?: Record<string, unknown>;
  /** Local-only: 1 when the record has unsynced changes. */
  _dirty?: number;
}

export interface LocationRow {
  id: string;
  name: string;
  type: LocationType;
  capacity: number | null;
  areaHectares?: number | string | null;
  description?: string | null;
  _dirty?: number;
}

export interface WeightRow {
  id: string;
  animalId: string;
  weightKg: number | string;
  measuredAt: string;
  source: WeightSource;
  _dirty?: number;
}

export interface HealthRow {
  id: string;
  animalId: string;
  eventType: HealthEventType;
  medication: string | null;
  dosage: string | null;
  appliedAt: string;
  withdrawalDays: number;
  withdrawalUntil: string | null;
  _dirty?: number;
}

export interface MovementRow {
  id: string;
  animalId: string;
  fromLocationId: string | null;
  toLocationId: string;
  reason: MovementReason | null;
  movedAt: string;
  _dirty?: number;
}

export type TaskStatus = 'PENDING' | 'COMPLETED';

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  _dirty?: number;
}

export type CheckType = 'TACTO' | 'ECOGRAFIA';
/** El cliente usa PRENADA (ASCII); la BD guarda "PREÑADA" (@map en Prisma). */
export type PregnancyStatus = 'PRENADA' | 'VACIA';

export interface ReproCheckRow {
  id: string;
  animalId: string;
  potreroId: string;
  type: CheckType;
  result: PregnancyStatus;
  observations: string | null;
  date: string;
  _dirty?: number;
}

export type ReproEventType = 'SERVICIO' | 'PARICION' | 'DESTETE';

export type AnimalEventType =
  | 'NOTA'
  | 'CONDICION_CORPORAL'
  | 'PARTO'
  | 'ABORTO'
  | 'MUERTE'
  | 'TRATAMIENTO'
  | 'CAMBIO_LOTE'
  | 'CAMBIO_CARAVANA'
  | 'INGRESO'
  | 'EGRESO'
  | 'REVISION_TORO'
  | 'OTRO';

export interface AnimalEventRow {
  id: string;
  animalId: string;
  type: AnimalEventType;
  note: string | null;
  score: number | string | null;
  weightKg: number | string | null;
  data?: Record<string, unknown>;
  date: string;
  _dirty?: number;
}

export interface ReproEventRow {
  id: string;
  animalId: string;
  type: ReproEventType;
  sireTagId: string | null;
  offspringTagId: string | null;
  observations: string | null;
  date: string;
  _dirty?: number;
}

/** A queued API call to be replayed against the backend when online. */
export interface OutboxOp {
  id: string;
  kind:
    | 'animal.create'
    | 'animal.update'
    | 'animal.status'
    | 'animal.delete'
    | 'location.create'
    | 'location.update'
    | 'location.delete'
    | 'weight.create'
    | 'health.create'
    | 'movement.create'
    | 'task.create'
    | 'task.update'
    | 'task.delete'
    | 'reproductive.create'
    | 'reproductive.event.create'
    | 'animalEvent.create';
  method: 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body: Record<string, unknown>;
  entityTable:
    | 'animals'
    | 'locations'
    | 'weights'
    | 'health'
    | 'movements'
    | 'tasks'
    | 'reproChecks'
    | 'reproEvents'
    | 'animalEvents';
  entityId: string;
  attempts: number;
  createdAt: string;
}

/** A server-rejected operation kept for user visibility (not retried). */
export interface ConflictRow {
  id: string;
  kind: string;
  message: string;
  body: Record<string, unknown>;
  at: string;
}
