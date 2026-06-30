import { DomainEvent } from '@core/domain/events/domain-event.base';

/** Emitted when a sanitary event (vaccination, treatment...) is recorded. */
export class HealthEventRecordedEvent extends DomainEvent<{
  eventType: string;
  medication: string | null;
  appliedAt: string;
  withdrawalUntil: string | null;
}> {
  static readonly NAME = 'animal.health_event_recorded.v1';
  constructor(animalId: string, payload: HealthEventRecordedEvent['payload']) {
    super(HealthEventRecordedEvent.NAME, 'Animal', animalId, payload);
  }
}
