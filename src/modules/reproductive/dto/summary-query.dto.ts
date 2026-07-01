import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ReproductiveSummaryQueryDto {
  @ApiProperty({ description: 'Potrero (lote) a evaluar', format: 'uuid' })
  @IsUUID()
  potreroId!: string;
}
