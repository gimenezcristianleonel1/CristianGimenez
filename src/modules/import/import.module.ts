import { Module } from '@nestjs/common';
import { AnimalsModule } from '@modules/animals/animals.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { ImportTemplatesRepository } from './import-templates.repository';

@Module({
  imports: [AnimalsModule], // reutiliza AnimalsService (validaciones + tenant) y AnimalsRepository
  controllers: [ImportController],
  providers: [ImportService, ImportTemplatesRepository],
})
export class ImportModule {}
