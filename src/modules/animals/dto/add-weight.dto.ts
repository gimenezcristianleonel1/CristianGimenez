import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeightSource } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsPositive, IsUUID } from 'class-validator';
import { IsNotFutureDate } from '@shared/validators/is-not-future-date.validator';

export class AddWeightDto {
  @ApiPropertyOptional({ description: 'UUID generado por el cliente (idempotencia sync)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 180.5, description: 'Peso medido en kg (> 0)' })
  @IsPositive()
  weightKg!: number;

  @ApiPropertyOptional({
    example: '2026-06-30T10:00:00.000Z',
    description: 'Momento del pesaje (por defecto: ahora). No puede ser futuro.',
  })
  @IsOptional()
  @IsNotFutureDate()
  measuredAt?: string;

  @ApiPropertyOptional({ enum: WeightSource, default: WeightSource.MANUAL })
  @IsOptional()
  @IsEnum(WeightSource)
  source?: WeightSource;

  @ApiPropertyOptional({ description: 'Lecturas de sensor / variables ambientales' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
