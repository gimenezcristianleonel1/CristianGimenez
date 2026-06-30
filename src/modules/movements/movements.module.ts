import { Module } from '@nestjs/common';
import { AnimalsModule } from '@modules/animals/animals.module';
import { LocationsModule } from '@modules/locations/locations.module';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { MovementsRepository } from './movements.repository';

@Module({
  imports: [AnimalsModule, LocationsModule],
  controllers: [MovementsController],
  providers: [MovementsService, MovementsRepository],
  exports: [MovementsService],
})
export class MovementsModule {}
