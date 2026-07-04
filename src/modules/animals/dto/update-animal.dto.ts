import { ApiPropertyOptional } from '@nestjs/swagger';
import { Sex, Species } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsNotFutureDate } from '@shared/validators/is-not-future-date.validator';

/**
 * Campos editables de un animal. La ubicación se cambia por el endpoint de
 * movimientos (para dejar traza); el estado por el endpoint de estado.
 */
export class UpdateAnimalDto {
  @ApiPropertyOptional({ example: 'AR-0001', description: 'Caravana (única por establecimiento)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tagId?: string;

  @ApiPropertyOptional({ enum: Species })
  @IsOptional()
  @IsEnum(Species)
  species?: Species;

  @ApiPropertyOptional({ example: 'Brangus' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  breed?: string;

  @ApiPropertyOptional({ enum: Sex })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional({ example: '2024-01-15', description: 'No puede ser futura' })
  @IsOptional()
  @IsNotFutureDate({ message: 'birthDate cannot be in the future' })
  birthDate?: string;

  @ApiPropertyOptional({ example: '2025-04-12', description: 'Fecha de ingreso. No futura.' })
  @IsOptional()
  @IsNotFutureDate({ message: 'entryDate cannot be in the future' })
  entryDate?: string;

  @ApiPropertyOptional({ example: 46.2, description: 'Peso inicial en kg (> 0)' })
  @IsOptional()
  @IsPositive()
  initialWeightKg?: number;

  @ApiPropertyOptional({ description: 'Reasignar madre' })
  @IsOptional()
  @IsUUID()
  motherId?: string;

  @ApiPropertyOptional({ description: 'Reasignar padre' })
  @IsOptional()
  @IsUUID()
  fatherId?: string;

  @ApiPropertyOptional({ description: 'Observaciones libres (cualquier eventualidad)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;

  @ApiPropertyOptional({ description: 'Metadatos de enriquecimiento (merge superficial)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
