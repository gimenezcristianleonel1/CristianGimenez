import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { ReproductiveService } from './reproductive.service';
import { CreateReproductiveCheckDto } from './dto/create-reproductive-check.dto';
import { ReproductiveSummaryQueryDto } from './dto/summary-query.dto';

@ApiTags('Reproductive')
@ApiBearerAuth()
@Controller('reproductive')
export class ReproductiveController {
  constructor(private readonly reproductiveService: ReproductiveService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un chequeo reproductivo individual (tacto / ecografía)' })
  create(@CurrentUser('establishmentId') est: string, @Body() dto: CreateReproductiveCheckDto) {
    return this.reproductiveService.create(est, dto);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Cierre de trabajo: indicadores de preñez/vacías del lote (potrero) evaluado',
  })
  @ApiOkResponse({ description: 'Total controlados, preñadas/vacías, porcentajes y alerta' })
  summary(
    @CurrentUser('establishmentId') est: string,
    @Query() query: ReproductiveSummaryQueryDto,
  ) {
    return this.reproductiveService.summary(est, query.potreroId);
  }
}
