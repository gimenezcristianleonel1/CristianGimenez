import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/** Campos de texto (multipart) que acompañan al archivo Excel. */
export class ImportExcelDto {
  @ApiPropertyOptional({
    description:
      'Mapeo confirmado por el usuario como JSON, p.ej. {"tagId":"N° Caravana","initialWeightKg":"Peso"}. ' +
      'Si se envía, se usa ese mapeo y se guarda como plantilla del establecimiento.',
  })
  @IsOptional()
  @IsString()
  mapping?: string;

  @ApiPropertyOptional({ description: 'Guardar el mapeo como plantilla (por defecto true).' })
  @IsOptional()
  @IsString()
  saveTemplate?: string;

  @ApiPropertyOptional({
    description: 'ID del potrero/ubicación al que asignar todos los animales importados.',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}
