import { DomainEvent } from '@core/domain/events/domain-event.base';

const AGGREGATE = 'Animal';

/** Emitted when a new animal is registered in the inventory. */
export class AnimalRegisteredEvent extends DomainEvent<{
  tagId: string;
  species: string;
  breed: string;
  sex: string;
  status: string;
}> {
  static readonly NAME = 'animal.registered.v1';
  constructor(animalId: string, payload: AnimalRegisteredEvent['payload']) {
    super(AnimalRegisteredEvent.NAME, AGGREGATE, animalId, payload);
  }
}

/** Emitted when a new weight measurement is recorded (time-series append). */
export class AnimalWeighedEvent extends DomainEvent<{
  weightKg: number;
  measuredAt: string;
  source: string;
}> {
  static readonly NAME = 'animal.weighed.v1';
  constructor(animalId: string, payload: AnimalWeighedEvent['payload']) {
    super(AnimalWeighedEvent.NAME, AGGREGATE, animalId, payload);
  }
}

/** Emitted when an animal's lifecycle status changes. */
export class AnimalStatusChangedEvent extends DomainEvent<{
  from: string;
  to: string;
}> {
  static readonly NAME = 'animal.status_changed.v1';
  constructor(animalId: string, payload: AnimalStatusChangedEvent['payload']) {
    super(AnimalStatusChangedEvent.NAME, AGGREGATE, animalId, payload);
  }
}
