import { IDomainEvent } from './domain-event.base';

/**
 * Injection token for the domain event publisher.
 * Depend on this token (not on a concrete class) so the transport can be
 * swapped — in-process EventEmitter today, Outbox + Kafka tomorrow — without
 * changing any service code.
 */
export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

/**
 * Abstraction that decouples domain services from the event transport.
 */
export interface IEventPublisher {
  /** Publish a single domain event. */
  publish(event: IDomainEvent): Promise<void>;
  /** Publish many domain events atomically from the caller's perspective. */
  publishAll(events: IDomainEvent[]): Promise<void>;
}
