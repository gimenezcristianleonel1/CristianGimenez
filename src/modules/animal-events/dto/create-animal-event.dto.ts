import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnimalEventType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAnimalEventDto {
  @ApiPropertyOptional({ description: 'UUID generado por el cliente (idempotencia para sync offline)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: AnimalEventType, example: AnimalEventType.NOTA })
  @IsEnum(AnimalEventType)
  type!: AnimalEventType;

  @ApiPropertyOptional({ example: '2026-07-01T09:00:00.000Z', description: 'Fecha del evento' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Nota / detalle libre', example: 'Cojera leve pata trasera' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'Condición corporal (1 a 5)', example: 3.5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  score?: number;

  @ApiPropertyOptional({ description: 'Peso registrado junto al evento (kg)', example: 420 })
  @IsOptional()
  @IsPositive()
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Detalles específicos del tipo de evento' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
