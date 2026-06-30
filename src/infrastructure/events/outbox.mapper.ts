import { Prisma } from '@prisma/client';
import { IDomainEvent } from '@core/domain/events/domain-event.base';

/**
 * Maps a Domain Event to the row shape persisted in the `outbox_events` table.
 * Kept as a pure function so it can be reused both by the standalone publisher
 * and inside a state-change transaction (true transactional Outbox).
 */
export function toOutboxRow(event: IDomainEvent): Prisma.OutboxEventCreateManyInput {
  return {
    eventId: event.eventId,
    eventName: event.eventName,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: event.payload as Prisma.InputJsonValue,
    occurredAt: event.occurredAt,
  };
}
