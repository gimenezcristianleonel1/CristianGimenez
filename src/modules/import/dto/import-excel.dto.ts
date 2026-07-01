import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

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
}
