import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @ApiPropertyOptional({ description: 'UUID generado por el cliente (idempotencia para sync offline)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Vacunar lote norte' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Aftosa a todos los terneros' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-07-05T09:00:00.000Z', description: 'Fecha límite' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
