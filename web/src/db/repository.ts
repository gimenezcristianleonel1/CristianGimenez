import { db } from './db';
import { uuid } from '../lib/uuid';
import type {
  AnimalEventType,
  AnimalStatus,
  CheckType,
  HealthEventType,
  LocationType,
  MovementReason,
  OutboxOp,
  PregnancyStatus,
  ReproEventType,
  Sex,
  Species,
  TaskStatus,
  WeightSource,
} from '../lib/types';

const DAY = 86_400_000;

/** Evento que avisa que hay algo nuevo en la cola (dispara un sync inmediato). */
export const OUTBOX_EVENT = 'lg-outbox';

async function enqueue(op: Omit<OutboxOp, 'attempts' | 'createdAt'>): Promise<void> {
  await db.outbox.add({ ...op, attempts: 0, createdAt: new Date().toISOString() });
  // Notifica al SyncProvider para que sincronice ya (en segundo plano).
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OUTBOX_EVENT));
  }
}

export interface NewAnimalInput {
  tagId: string;
  species: Species;
  breed: string;
  sex: Sex;
  birthDate: string;
  entryDate?: string | null;
  initialWeightKg: number;
  currentLocationId?: string | null;
  motherId?: string | null;
  fatherId?: string | null;
  observations?: string;
  metadata?: Record<string, unknown>;
}

/** Create an animal locally (optimistic) and queue it for sync. */
export async function createAnimal(input: NewAnimalInput): Promise<string> {
  const id = uuid();
  await db.animals.add({
    id,
    tagId: input.tagId,
    species: input.species,
    breed: input.breed,
    sex: input.sex,
    birthDate: input.birthDate,
    entryDate: input.entryDate ?? null,
    initialWeightKg: input.initialWeightKg,
    status: 'ACTIVE',
    currentLocationId: input.currentLocationId ?? null,
    motherId: input.motherId ?? null,
    fatherId: input.fatherId ?? null,
    observations: input.observations ?? null,
    metadata: input.metadata ?? {},
    _dirty: 1,
  });
  await enqueue({
    id: uuid(),
    kind: 'animal.create',
    method: 'POST',
    path: '/animals',
    body: {
      id,
      ...input,
      currentLocationId: input.currentLocationId || undefined,
      motherId: input.motherId || undefined,
      fatherId: input.fatherId || undefined,
    },
    entityTable: 'animals',
    entityId: id,
  });
  return id;
}

export interface AnimalEditInput {
  tagId?: string;
  species?: Species;
  breed?: string;
  sex?: Sex;
  birthDate?: string;
  entryDate?: string | null;
  initialWeightKg?: number;
  observations?: string | null;
  metadata?: Record<string, unknown>;
}

/** Edita datos de un animal (optimista local) y encola el PATCH para sync. */
export async function updateAnimal(animalId: string, changes: AnimalEditInput): Promise<void> {
  await db.animals.update(animalId, { ...changes, _dirty: 1 });
  await enqueue({
    id: uuid(),
    kind: 'animal.update',
    method: 'PATCH',
    path: `/animals/${animalId}`,
    body: { ...changes },
    entityTable: 'animals',
    entityId: animalId,
  });
}

export async function changeAnimalStatus(animalId: string, status: AnimalStatus): Promise<void> {
  await db.animals.update(animalId, { status, _dirty: 1 });
  await enqueue({
    id: uuid(),
    kind: 'animal.status',
    method: 'PATCH',
    path: `/animals/${animalId}/status`,
    body: { status },
    entityTable: 'animals',
    entityId: animalId,
  });
}

/** Elimina un animal (optimista local) y encola el DELETE para sincronizar. */
export async function deleteAnimal(animalId: string): Promise<void> {
  // Borra el animal y sus registros locales asociados (el backend cascadea).
  await Promise.all([
    db.animals.delete(animalId),
    db.weights.where('animalId').equals(animalId).delete(),
    db.health.where('animalId').equals(animalId).delete(),
    db.movements.where('animalId').equals(animalId).delete(),
    db.animalEvents.where('animalId').equals(animalId).delete(),
    db.reproChecks.where('animalId').equals(animalId).delete(),
    db.reproEvents.where('animalId').equals(animalId).delete(),
  ]);
  await enqueue({
    id: uuid(),
    kind: 'animal.delete',
    method: 'DELETE',
    path: `/animals/${animalId}`,
    body: {},
    entityTable: 'animals',
    entityId: animalId,
  });
}

export interface NewLocationInput {
  name: string;
  type: LocationType;
  capacity?: number;
  areaHectares?: number;
  description?: string;
}

export async function createLocation(input: NewLocationInput): Promise<string> {
  const id = uuid();
  await db.locations.add({
    id,
    name: input.name,
    type: input.type,
    capacity: input.capacity ?? null,
    areaHectares: input.areaHectares ?? null,
    description: input.description ?? null,
    _dirty: 1,
  });
  await enqueue({
    id: uuid(),
    kind: 'location.create',
    method: 'POST',
    path: '/locations',
    body: { id, ...input },
    entityTable: 'locations',
    entityId: id,
  });
  return id;
}

export interface LocationEditInput {
  name?: string;
  type?: LocationType;
  capacity?: number | null;
  areaHectares?: number | null;
  description?: string;
}

/** Edita un potrero (optimista local) y encola el PATCH para sync. */
export async function updateLocation(id: string, changes: LocationEditInput): Promise<void> {
  await db.locations.update(id, { ...changes, _dirty: 1 });
  await enqueue({
    id: uuid(),
    kind: 'location.update',
    method: 'PATCH',
    path: `/locations/${id}`,
    body: { ...changes },
    entityTable: 'locations',
    entityId: id,
  });
}

/** Elimina un potrero (optimista local) y encola el DELETE para sync. */
export async function deleteLocation(id: string): Promise<void> {
  await db.locations.delete(id);
  await enqueue({
    id: uuid(),
    kind: 'location.delete',
    method: 'DELETE',
    path: `/locations/${id}`,
    body: {},
    entityTable: 'locations',
    entityId: id,
  });
}

export interface NewWeightInput {
  weightKg: number;
  measuredAt?: string;
  source?: WeightSource;
}

export async function addWeight(animalId: string, input: NewWeightInput): Promise<string> {
  const id = uuid();
  const measuredAt = input.measuredAt ?? new Date().toISOString();
  const source = input.source ?? 'MANUAL';
  await db.weights.add({ id, animalId, weightKg: input.weightKg, measuredAt, source, _dirty: 1 });
  await enqueue({
    id: uuid(),
    kind: 'weight.create',
    method: 'POST',
    path: `/animals/${animalId}/weights`,
    body: { id, weightKg: input.weightKg, measuredAt, source },
    entityTable: 'weights',
    entityId: id,
  });
  return id;
}

export interface NewHealthInput {
  eventType: HealthEventType;
  medication?: string;
  dosage?: string;
  appliedAt?: string;
  withdrawalDays?: number;
  notes?: string;
}

export async function addHealth(animalId: string, input: NewHealthInput): Promise<string> {
  const id = uuid();
  const appliedAt = input.appliedAt ?? new Date().toISOString();
  const withdrawalDays = input.withdrawalDays ?? 0;
  const withdrawalUntil =
    withdrawalDays > 0 ? new Date(new Date(appliedAt).getTime() + withdrawalDays * DAY).toISOString() : null;
  await db.health.add({
    id,
    animalId,
    eventType: input.eventType,
    medication: input.medication ?? null,
    dosage: input.dosage ?? null,
    appliedAt,
    withdrawalDays,
    withdrawalUntil,
    _dirty: 1,
  });
  await enqueue({
    id: uuid(),
    kind: 'health.create',
    method: 'POST',
    path: `/animals/${animalId}/health`,
    body: {
      id,
      eventType: input.eventType,
      medication: input.medication || undefined,
      dosage: input.dosage || undefined,
      appliedAt,
      withdrawalDays,
      notes: input.notes || undefined,
    },
    entityTable: 'health',
    entityId: id,
  });
  return id;
}

export interface NewMovementInput {
  toLocationId: string;
  reason?: MovementReason;
  movedAt?: string;
  notes?: string;
}

export async function moveAnimal(animalId: string, input: NewMovementInput): Promise<string> {
  const id = uuid();
  const movedAt = input.movedAt ?? new Date().toISOString();
  const animal = await db.animals.get(animalId);
  const fromLocationId = animal?.currentLocationId ?? null;
  await db.movements.add({
    id,
    animalId,
    fromLocationId,
    toLocationId: input.toLocationId,
    reason: input.reason ?? null,
    movedAt,
    _dirty: 1,
  });
  // Reflect the new location locally right away (optimistic).
  await db.animals.update(animalId, { currentLocationId: input.toLocationId, _dirty: 1 });
  await enqueue({
    id: uuid(),
    kind: 'movement.create',
    method: 'POST',
    path: `/animals/${animalId}/movements`,
    body: {
      id,
      toLocationId: input.toLocationId,
      reason: input.reason || undefined,
      movedAt,
      notes: input.notes || undefined,
    },
    entityTable: 'movements',
    entityId: id,
  });
  return id;
}

// ---------------------------------------------------------------- Tareas

export interface NewTaskInput {
  title: string;
  description?: string;
  dueDate?: string; // ISO
}

/** Crea una tarea local (optimista) y la encola para sync. */
export async function createTask(input: NewTaskInput): Promise<string> {
  const id = uuid();
  await db.tasks.add({
    id,
    title: input.title,
    description: input.description ?? null,
    status: 'PENDING',
    dueDate: input.dueDate ?? null,
    completedAt: null,
    _dirty: 1,
  });
  await enqueue({
    id: uuid(),
    kind: 'task.create',
    method: 'POST',
    path: '/tasks',
    body: { id, title: input.title, description: input.description || undefined, dueDate: input.dueDate || undefined },
    entityTable: 'tasks',
    entityId: id,
  });
  return id;
}

export interface TaskEditInput {
  title?: string;
  description?: string | null;
  /** ISO para fijar fecha límite, o null para quitarla. */
  dueDate?: string | null;
}

/** Edita título/fecha/descripción de una tarea (optimista) y encola el PATCH. */
export async function updateTask(taskId: string, changes: TaskEditInput): Promise<void> {
  await db.tasks.update(taskId, { ...changes, _dirty: 1 });
  await enqueue({
    id: uuid(),
    kind: 'task.update',
    method: 'PATCH',
    path: `/tasks/${taskId}`,
    body: { ...changes },
    entityTable: 'tasks',
    entityId: taskId,
  });
}

/** Marca una tarea como cumplida/pendiente (optimista) y encola el PATCH. */
export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const completedAt = status === 'COMPLETED' ? new Date().toISOString() : null;
  await db.tasks.update(taskId, { status, completedAt, _dirty: 1 });
  await enqueue({
    id: uuid(),
    kind: 'task.update',
    method: 'PATCH',
    path: `/tasks/${taskId}`,
    body: { status },
    entityTable: 'tasks',
    entityId: taskId,
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await db.tasks.delete(taskId);
  await enqueue({
    id: uuid(),
    kind: 'task.delete',
    method: 'DELETE',
    path: `/tasks/${taskId}`,
    body: {},
    entityTable: 'tasks',
    entityId: taskId,
  });
}

// ------------------------------------------------------ Reproductivo

export interface NewReproCheckInput {
  animalId: string;
  potreroId: string;
  type: CheckType;
  result: PregnancyStatus;
  observations?: string;
}

/** Registra un chequeo reproductivo local (optimista) y lo encola para sync. */
export async function createReproCheck(input: NewReproCheckInput): Promise<string> {
  const id = uuid();
  const date = new Date().toISOString();
  await db.reproChecks.add({
    id,
    animalId: input.animalId,
    potreroId: input.potreroId,
    type: input.type,
    result: input.result,
    observations: input.observations ?? null,
    date,
    _dirty: 1,
  });
  await enqueue({
    id: uuid(),
    kind: 'reproductive.create',
    method: 'POST',
    path: '/reproductive',
    body: {
      id,
      animalId: input.animalId,
      potreroId: input.potreroId,
      type: input.type,
      result: input.result,
      observations: input.observations || undefined,
      date,
    },
    entityTable: 'reproChecks',
    entityId: id,
  });
  return id;
}

export interface NewReproEventInput {
  animalId: string;
  type: ReproEventType;
  sireTagId?: string;
  offspringTagId?: string;
  observations?: string;
  date?: string; // ISO; por defecto ahora
}

/** Registra un evento del ciclo (servicio/parición/destete) local y lo encola. */
export async function createReproEvent(input: NewReproEventInput): Promise<string> {
  const id = uuid();
  const date = input.date ?? new Date().toISOString();
  await db.reproEvents.add({
    id,
    animalId: input.animalId,
    type: input.type,
    sireTagId: input.sireTagId ?? null,
    offspringTagId: input.offspringTagId ?? null,
    observations: input.observations ?? null,
    date,
    _dirty: 1,
  });
  await enqueue({
    id: uuid(),
    kind: 'reproductive.event.create',
    method: 'POST',
    path: '/reproductive/events',
    body: {
      id,
      animalId: input.animalId,
      type: input.type,
      sireTagId: input.sireTagId || undefined,
      offspringTagId: input.offspringTagId || undefined,
      observations: input.observations || undefined,
      date,
    },
    entityTable: 'reproEvents',
    entityId: id,
  });
  return id;
}

// ------------------------------------------------------ Bitácora del animal

export interface NewAnimalEventInput {
  animalId: string;
  type: AnimalEventType;
  note?: string;
  score?: number;
  weightKg?: number;
  data?: Record<string, unknown>;
  date?: string; // ISO; por defecto ahora
}

/** Registra un evento en la bitácora del animal (nota/CC/recorrida) y lo encola. */
export async function createAnimalEvent(input: NewAnimalEventInput): Promise<string> {
  const id = uuid();
  const date = input.date ?? new Date().toISOString();
  await db.animalEvents.add({
    id,
    animalId: input.animalId,
    type: input.type,
    note: input.note ?? null,
    score: input.score ?? null,
    weightKg: input.weightKg ?? null,
    data: input.data ?? {},
    date,
    _dirty: 1,
  });
  await enqueue({
    id: uuid(),
    kind: 'animalEvent.create',
    method: 'POST',
    path: `/animals/${input.animalId}/events`,
    body: {
      id,
      type: input.type,
      note: input.note || undefined,
      score: input.score,
      weightKg: input.weightKg,
      data: input.data,
      date,
    },
    entityTable: 'animalEvents',
    entityId: id,
  });
  return id;
}

// ---------------------------------------------------------------- Masivo

/**
 * Mueve TODOS los animales de un potrero a otro (una operación por animal,
 * reutilizando moveAnimal → offline-first + sincronización idempotente).
 * Devuelve la cantidad movida.
 */
export async function bulkMoveByLocation(
  fromLocationId: string,
  toLocationId: string,
  reason?: MovementReason,
): Promise<number> {
  const animals = await db.animals.where('currentLocationId').equals(fromLocationId).toArray();
  for (const a of animals) {
    await moveAnimal(a.id, { toLocationId, reason });
  }
  return animals.length;
}

/**
 * Asigna/mueve una lista de animales (por id) a un potrero destino.
 * Reutiliza moveAnimal por animal (offline-first + idempotente).
 * Devuelve la cantidad asignada.
 */
export async function bulkMoveAnimals(
  animalIds: string[],
  toLocationId: string,
  reason?: MovementReason,
): Promise<number> {
  for (const id of animalIds) {
    await moveAnimal(id, { toLocationId, reason });
  }
  return animalIds.length;
}

/**
 * Aplica un evento sanitario a TODOS los animales de un potrero
 * (p.ej. desparasitación masiva). Devuelve la cantidad tratada.
 */
export async function bulkHealthByLocation(
  locationId: string,
  input: NewHealthInput,
): Promise<number> {
  const animals = await db.animals
    .where('currentLocationId')
    .equals(locationId)
    .and((a) => a.status !== 'SOLD' && a.status !== 'DECEASED')
    .toArray();
  for (const a of animals) {
    await addHealth(a.id, input);
  }
  return animals.length;
}

export interface BulkReproEventInput {
  type: ReproEventType;
  sireTagId?: string;
  observations?: string;
  /** Solo hembras (típico para "poner en servicio"). Por defecto true. */
  onlyFemales?: boolean;
}

/**
 * Registra un evento reproductivo (servicio/parición/destete) a TODOS los
 * animales activos de un potrero — p. ej. "poner el potrero en servicio".
 * Devuelve la cantidad de animales afectados.
 */
export async function bulkReproEventByLocation(
  locationId: string,
  input: BulkReproEventInput,
): Promise<number> {
  const onlyFemales = input.onlyFemales ?? true;
  const animals = await db.animals
    .where('currentLocationId')
    .equals(locationId)
    .and((a) => a.status === 'ACTIVE' && (!onlyFemales || a.sex === 'FEMALE'))
    .toArray();
  for (const a of animals) {
    await createReproEvent({
      animalId: a.id,
      type: input.type,
      sireTagId: input.sireTagId,
      observations: input.observations,
    });
  }
  return animals.length;
}

/**
 * Cambia el estado a TODOS los animales de un potrero (salteando los que ya
 * están en ese estado o son terminales: vendidos/fallecidos). Devuelve la
 * cantidad efectivamente modificada.
 */
export async function bulkStatusByLocation(
  locationId: string,
  status: AnimalStatus,
): Promise<number> {
  const animals = await db.animals
    .where('currentLocationId')
    .equals(locationId)
    .and(
      (a) => a.status !== status && a.status !== 'SOLD' && a.status !== 'DECEASED',
    )
    .toArray();
  for (const a of animals) {
    await changeAnimalStatus(a.id, status);
  }
  return animals.length;
}

// -------- Masivo sobre una selección arbitraria de animales (por id) --------

/** Elimina una lista de animales (por id). Devuelve la cantidad borrada. */
export async function bulkDeleteAnimals(animalIds: string[]): Promise<number> {
  for (const id of animalIds) {
    await deleteAnimal(id);
  }
  return animalIds.length;
}

/** Aplica un evento sanitario a una lista de animales (por id). */
export async function bulkHealthByAnimals(
  animalIds: string[],
  input: NewHealthInput,
): Promise<number> {
  const animals = await db.animals
    .where('id')
    .anyOf(animalIds)
    .and((a) => a.status !== 'SOLD' && a.status !== 'DECEASED')
    .toArray();
  for (const a of animals) {
    await addHealth(a.id, input);
  }
  return animals.length;
}

/** Cambia el estado de una lista de animales (saltea terminales y los que ya están). */
export async function bulkStatusByAnimals(
  animalIds: string[],
  status: AnimalStatus,
): Promise<number> {
  const animals = await db.animals
    .where('id')
    .anyOf(animalIds)
    .and((a) => a.status !== status && a.status !== 'SOLD' && a.status !== 'DECEASED')
    .toArray();
  for (const a of animals) {
    await changeAnimalStatus(a.id, status);
  }
  return animals.length;
}

/** Registra un evento reproductivo a una lista de animales (por id). */
export async function bulkReproEventByAnimals(
  animalIds: string[],
  input: BulkReproEventInput,
): Promise<number> {
  const onlyFemales = input.onlyFemales ?? true;
  const animals = await db.animals
    .where('id')
    .anyOf(animalIds)
    .and((a) => a.status === 'ACTIVE' && (!onlyFemales || a.sex === 'FEMALE'))
    .toArray();
  for (const a of animals) {
    await createReproEvent({
      animalId: a.id,
      type: input.type,
      sireTagId: input.sireTagId,
      observations: input.observations,
    });
  }
  return animals.length;
}
