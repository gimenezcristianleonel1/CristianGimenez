import { Module } from '@nestjs/common';
import { AnimalEventsController } from './animal-events.controller';
import { AnimalEventsService } from './animal-events.service';
import { AnimalEventsRepository } from './animal-events.repository';

@Module({
  controllers: [AnimalEventsController],
  providers: [AnimalEventsService, AnimalEventsRepository],
  exports: [AnimalEventsService],
})
export class AnimalEventsModule {}
