import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLocationDto {
  @ApiPropertyOptional({ description: 'UUID generado por el cliente (idempotencia sync)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Potrero Norte', description: 'Nombre único de la ubicación' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: LocationType, example: LocationType.PASTURE })
  @IsEnum(LocationType)
  type!: LocationType;

  @ApiPropertyOptional({ example: 50, description: 'Capacidad máxima de animales (anti-sobrepastoreo)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: 12.5, description: 'Superficie en hectáreas' })
  @IsOptional()
  @IsPositive()
  areaHectares?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Metadatos de enriquecimiento (tipo de pastura, suelo, sensores...)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
