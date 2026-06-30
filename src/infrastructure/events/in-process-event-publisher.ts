import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IDomainEvent } from '@core/domain/events/domain-event.base';
import { IEventPublisher } from '@core/domain/events/event-publisher.interface';

/**
 * In-process implementation of {@link IEventPublisher}.
 *
 * Propagates Domain Events on the in-process EventEmitter so the MVP can react
 * immediately (early-warning alerts, projections refresh, audit logging)
 * without a message broker.
 *
 * Durability is handled separately and transactionally: the repositories write
 * each event to the `outbox_events` table in the SAME transaction as the state
 * change (Transactional Outbox). A future relay/worker reads that table and
 * forwards events to Kafka/RabbitMQ/IoT/ML — at which point only THIS class is
 * swapped, leaving every domain service untouched.
 */
@Injectable()
export class InProcessEventPublisher implements IEventPublisher {
  private readonly logger = new Logger(InProcessEventPublisher.name);

  constructor(private readonly emitter: EventEmitter2) {}

  async publish(event: IDomainEvent): Promise<void> {
    await this.publishAll([event]);
  }

  async publishAll(events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      this.logger.debug(`Propagating ${event.eventName} (${event.aggregateId})`);
      this.emitter.emit(event.eventName, event);
    }
  }
}
