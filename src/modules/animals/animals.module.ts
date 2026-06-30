import { Module } from '@nestjs/common';
import { AnimalsController } from './animals.controller';
import { AnimalsService } from './animals.service';
import { AnimalsRepository } from './animals.repository';

@Module({
  controllers: [AnimalsController],
  providers: [AnimalsService, AnimalsRepository],
  exports: [AnimalsService, AnimalsRepository],
})
export class AnimalsModule {}
