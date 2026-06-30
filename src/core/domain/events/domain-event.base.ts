import { randomUUID } from 'node:crypto';

/**
 * Base contract for every Domain Event in the system.
 *
 * A Domain Event is an immutable fact describing something relevant that
 * already happened in the domain (e.g. "AnimalRegistered", "AnimalWeighed").
 * Events are the backbone of the Event-Driven Architecture: today they are
 * persisted to a transactional Outbox and dispatched in-process, but the same
 * payload can later be relayed to a message broker (Kafka/RabbitMQ), IoT
 * pipelines or ML feature stores WITHOUT touching the core domain logic.
 */
export interface IDomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique identifier of this specific event occurrence (idempotency key). */
  readonly eventId: string;
  /** Stable, versioned name, e.g. "animal.registered.v1". Used for routing. */
  readonly eventName: string;
  /** Type of the aggregate the event belongs to, e.g. "Animal". */
  readonly aggregateType: string;
  /** Identifier of the aggregate the event belongs to (e.g. animal id). */
  readonly aggregateId: string;
  /** Moment the fact occurred (UTC). */
  readonly occurredAt: Date;
  /** Serialisable, schema-stable payload of the event. */
  readonly payload: Readonly<TPayload>;
}

/**
 * Convenience base class that fills in the boilerplate metadata.
 * Concrete events extend it and expose a strongly-typed payload.
 */
export abstract class DomainEvent<TPayload extends Record<string, unknown>>
  implements IDomainEvent<TPayload>
{
  public readonly eventId: string;
  public readonly occurredAt: Date;

  protected constructor(
    public readonly eventName: string,
    public readonly aggregateType: string,
    public readonly aggregateId: string,
    public readonly payload: Readonly<TPayload>,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
  }
}
