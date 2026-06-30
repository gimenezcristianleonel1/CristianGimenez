import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HealthEventType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsNotFutureDate } from '@shared/validators/is-not-future-date.validator';

export class CreateHealthRecordDto {
  @ApiProperty({ enum: HealthEventType, example: HealthEventType.VACCINATION })
  @IsEnum(HealthEventType)
  eventType!: HealthEventType;

  @ApiPropertyOptional({
    example: 'Aftosa',
    description: 'Medicamento/vacuna. Requerido para VACCINATION, DEWORMING y TREATMENT.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  medication?: string;

  @ApiPropertyOptional({ example: '5 ml' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  dosage?: string;

  @ApiPropertyOptional({
    example: '2026-06-30T09:00:00.000Z',
    description: 'Fecha de aplicación (por defecto: ahora). No puede ser futura.',
  })
  @IsOptional()
  @IsNotFutureDate()
  appliedAt?: string;

  @ApiPropertyOptional({
    example: 21,
    default: 0,
    description: 'Período de carencia en días (espera antes de consumo/venta).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  withdrawalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ description: 'Diagnóstico estructurado / lecturas adicionales' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
