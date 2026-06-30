import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementReason } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsNotFutureDate } from '@shared/validators/is-not-future-date.validator';

export class CreateMovementDto {
  @ApiProperty({ description: 'Ubicación destino (potrero/corral/lote)' })
  @IsUUID()
  toLocationId!: string;

  @ApiPropertyOptional({ enum: MovementReason, example: MovementReason.ROTATION })
  @IsOptional()
  @IsEnum(MovementReason)
  reason?: MovementReason;

  @ApiPropertyOptional({
    example: '2026-06-30T09:00:00.000Z',
    description: 'Momento del traslado (por defecto: ahora). No puede ser futuro.',
  })
  @IsOptional()
  @IsNotFutureDate()
  movedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
