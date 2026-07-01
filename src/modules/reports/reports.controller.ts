import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('potreros-carga')
  @ApiOperation({
    summary: 'Carga animal real de cada potrero en Equivalente Vaca por hectárea (EV/Ha)',
  })
  @ApiOkResponse({ description: 'Listado de potreros con su EV total y carga (EV/Ha)' })
  potrerosCarga(@CurrentUser('establishmentId') est: string) {
    return this.reportsService.potrerosCarga(est);
  }
}
