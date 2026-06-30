import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Mutable fields of an animal. Identity-defining and time-series data
 * (tagId, species, sex, birthDate, weights) are intentionally NOT editable
 * here — corrections are made through dedicated, auditable operations.
 * Status changes go through the dedicated status endpoint, and location
 * changes through the movements endpoint (Paso 4).
 */
export class UpdateAnimalDto {
  @ApiPropertyOptional({ example: 'Brangus' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  breed?: string;

  @ApiPropertyOptional({ description: 'Reasignar madre' })
  @IsOptional()
  @IsUUID()
  motherId?: string;

  @ApiPropertyOptional({ description: 'Reasignar padre' })
  @IsOptional()
  @IsUUID()
  fatherId?: string;

  @ApiPropertyOptional({ description: 'Metadatos de enriquecimiento (merge superficial)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
