import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

/** Una fila revisada/editada por el usuario (todo texto; se normaliza al guardar). */
export class ImportRowDto {
  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @IsString()
  species?: string;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsOptional()
  @IsString()
  sex?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  initialWeightKg?: string;
}

export class ImportRowsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];

  @IsOptional()
  @IsUUID()
  locationId?: string;
}
