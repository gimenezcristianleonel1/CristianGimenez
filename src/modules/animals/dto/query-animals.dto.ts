import { ApiPropertyOptional } from '@nestjs/swagger';
import { AnimalStatus, Species } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Filters + pagination for listing animals. */
export class QueryAnimalsDto {
  @ApiPropertyOptional({ enum: Species })
  @IsOptional()
  @IsEnum(Species)
  species?: Species;

  @ApiPropertyOptional({ enum: AnimalStatus })
  @IsOptional()
  @IsEnum(AnimalStatus)
  status?: AnimalStatus;

  @ApiPropertyOptional({ description: 'Filtrar por ubicación actual' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
