import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnimalStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional } from 'class-validator';

export class ChangeStatusDto {
  @ApiProperty({
    enum: AnimalStatus,
    description:
      'Nuevo estado. Marcar READY_FOR_SALE/SOLD valida que el animal no esté ' +
      'en período de carencia de ningún medicamento.',
  })
  @IsEnum(AnimalStatus)
  status!: AnimalStatus;

  @ApiPropertyOptional({ description: 'Contexto del cambio (motivo, comprador, etc.)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
