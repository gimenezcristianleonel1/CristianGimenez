import { randomUUID } from 'node:crypto';

/**
 * Base contract for every Domain Event in the system.
 *
 * A Domain Event is an immutable fact describing something relevant that
 * already happened in the domain (e.g. "AnimalWeighed", "AnimalTreated").
 * Events are the backbone of the Event-Driven Architecture: today they are
 * dispatched in-process, but the same payload can later be persisted in an
 * Outbox table and relayed to a message broker (Kafka/RabbitMQ), IoT
 * pipelines or ML feature stores WITHOUT touching the core domain logic.
 */
export interface IDomainEvent {
  /** Unique identifier of this specific event occurrence. */
  readonly eventId: string;
  /** Stable, versioned name, e.g. "animal.weighed.v1". Used for routing. */
  readonly eventName: string;
  /** Moment the fact occurred (UTC). */
  readonly occurredAt: Date;
  /** Identifier of the aggregate the event belongs to (e.g. animal id). */
  readonly aggregateId: string;
  /** Serialisable, schema-stable payload of the event. */
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Convenience base class that fills in the boilerplate metadata.
 * Concrete events extend it and expose a strongly-typed payload.
 */
export abstract class DomainEvent<TPayload extends Record<string, unknown>>
  implements IDomainEvent
{
  public readonly eventId: string;
  public readonly occurredAt: Date;

  protected constructor(
    public readonly eventName: string,
    public readonly aggregateId: string,
    public readonly payload: Readonly<TPayload>,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
  }
}
