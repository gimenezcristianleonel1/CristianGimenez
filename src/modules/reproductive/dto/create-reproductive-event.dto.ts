import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReproEventType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReproductiveEventDto {
  @ApiPropertyOptional({ description: 'UUID generado por el cliente (idempotencia para sync offline)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Animal (vientre) del evento', format: 'uuid' })
  @IsUUID()
  animalId!: string;

  @ApiProperty({ enum: ReproEventType, example: ReproEventType.SERVICIO })
  @IsEnum(ReproEventType)
  type!: ReproEventType;

  @ApiPropertyOptional({ example: '2026-07-01T09:00:00.000Z', description: 'Fecha del evento' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Caravana del toro (servicio)', example: '900' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sireTagId?: string;

  @ApiPropertyOptional({ description: 'Caravana de la cría (parición)', example: '1204' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  offspringTagId?: string;

  @ApiPropertyOptional({ example: 'Servicio natural' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;
}
