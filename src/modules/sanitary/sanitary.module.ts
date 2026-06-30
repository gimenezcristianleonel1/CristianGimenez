import { Module } from '@nestjs/common';
import { AnimalsModule } from '@modules/animals/animals.module';
import { SanitaryController } from './sanitary.controller';
import { SanitaryService } from './sanitary.service';
import { SanitaryRepository } from './sanitary.repository';

@Module({
  imports: [AnimalsModule], // reuse AnimalsRepository to validate animal existence
  controllers: [SanitaryController],
  providers: [SanitaryService, SanitaryRepository],
  exports: [SanitaryService],
})
export class SanitaryModule {}
