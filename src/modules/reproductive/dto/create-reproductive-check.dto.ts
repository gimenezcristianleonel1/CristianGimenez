import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CheckType, PregnancyStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReproductiveCheckDto {
  @ApiPropertyOptional({ description: 'UUID generado por el cliente (idempotencia para sync offline)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Animal controlado', format: 'uuid' })
  @IsUUID()
  animalId!: string;

  @ApiProperty({ description: 'Potrero donde estaba el lote al momento del trabajo', format: 'uuid' })
  @IsUUID()
  potreroId!: string;

  @ApiProperty({ enum: CheckType, example: CheckType.TACTO })
  @IsEnum(CheckType)
  type!: CheckType;

  @ApiProperty({
    enum: PregnancyStatus,
    example: PregnancyStatus.PRENADA,
    description: 'Resultado del diagnóstico (PRENADA = preñada, VACIA = vacía)',
  })
  @IsEnum(PregnancyStatus)
  result!: PregnancyStatus;

  @ApiPropertyOptional({ example: '2026-07-01T09:00:00.000Z', description: 'Fecha del trabajo' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 'Cuerpo lúteo presente' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;
}
