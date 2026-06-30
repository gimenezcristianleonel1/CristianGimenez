import { DomainEvent } from '@core/domain/events/domain-event.base';

/** Emitted when an animal is moved between locations (potreros/corrales). */
export class AnimalMovedEvent extends DomainEvent<{
  fromLocationId: string | null;
  toLocationId: string;
  reason: string | null;
  movedAt: string;
}> {
  static readonly NAME = 'animal.moved.v1';
  constructor(animalId: string, payload: AnimalMovedEvent['payload']) {
    super(AnimalMovedEvent.NAME, 'Animal', animalId, payload);
  }
}
