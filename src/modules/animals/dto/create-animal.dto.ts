import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Species, Sex } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsNotFutureDate } from '@shared/validators/is-not-future-date.validator';

export class CreateAnimalDto {
  @ApiPropertyOptional({
    description: 'UUID generado por el cliente (idempotencia para sync offline)',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'AR-0001', description: 'Caravana / arete único del animal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tagId!: string;

  @ApiProperty({ enum: Species, example: Species.BOVINE })
  @IsEnum(Species)
  species!: Species;

  @ApiProperty({ example: 'Angus' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  breed!: string;

  @ApiProperty({ enum: Sex, example: Sex.MALE })
  @IsEnum(Sex)
  sex!: Sex;

  @ApiProperty({ example: '2024-01-15', description: 'Fecha de nacimiento (no puede ser futura)' })
  @IsNotFutureDate({ message: 'birthDate cannot be in the future' })
  birthDate!: string;

  @ApiPropertyOptional({
    example: '2025-04-12',
    description: 'Fecha de ingreso al establecimiento (compra/destete/traslado). No futura.',
  })
  @IsOptional()
  @IsNotFutureDate({ message: 'entryDate cannot be in the future' })
  entryDate?: string;

  @ApiProperty({ example: 45.5, description: 'Peso inicial en kg (> 0)' })
  @IsPositive()
  initialWeightKg!: number;

  @ApiPropertyOptional({ description: 'ID de la madre (debe ser un animal hembra existente)' })
  @IsOptional()
  @IsUUID()
  motherId?: string;

  @ApiPropertyOptional({ description: 'ID del padre (debe ser un animal macho existente)' })
  @IsOptional()
  @IsUUID()
  fatherId?: string;

  @ApiPropertyOptional({ description: 'ID de la ubicación actual (potrero/corral)' })
  @IsOptional()
  @IsUUID()
  currentLocationId?: string;

  @ApiPropertyOptional({ description: 'Observaciones libres (cualquier eventualidad)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;

  @ApiPropertyOptional({
    description: 'Metadatos de enriquecimiento (genética, origen, sensores...)',
    example: { origin: 'cabaña-sur' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
