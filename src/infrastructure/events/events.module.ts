import { Global, Module } from '@nestjs/common';
import { EVENT_PUBLISHER } from '@core/domain/events/event-publisher.interface';
import { InProcessEventPublisher } from './in-process-event-publisher';

/**
 * Wires the domain-event transport. Domain services inject the abstract
 * EVENT_PUBLISHER token, never the concrete class — so the implementation can
 * be swapped without touching business code.
 */
@Global()
@Module({
  providers: [{ provide: EVENT_PUBLISHER, useClass: InProcessEventPublisher }],
  exports: [EVENT_PUBLISHER],
})
export class EventsModule {}
