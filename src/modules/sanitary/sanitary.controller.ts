import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { SanitaryService } from './sanitary.service';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';

@ApiTags('Sanidad')
@ApiBearerAuth()
@Controller('animals/:animalId/health')
export class SanitaryController {
  constructor(private readonly sanitaryService: SanitaryService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un evento sanitario (vacuna, desparasitación, tratamiento, cirugía)',
  })
  @ApiCreatedResponse({ description: 'Evento sanitario registrado' })
  create(
    @CurrentUser('establishmentId') est: string,
    @Param('animalId', new ParseUUIDPipe()) animalId: string,
    @Body() dto: CreateHealthRecordDto,
  ) {
    return this.sanitaryService.createForAnimal(est, animalId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Historial sanitario del animal' })
  findAll(
    @CurrentUser('establishmentId') est: string,
    @Param('animalId', new ParseUUIDPipe()) animalId: string,
  ) {
    return this.sanitaryService.findForAnimal(est, animalId);
  }

  @Get('withdrawal-status')
  @ApiOperation({ summary: 'Estado de carencia actual del animal (apto para consumo/venta)' })
  withdrawalStatus(
    @CurrentUser('establishmentId') est: string,
    @Param('animalId', new ParseUUIDPipe()) animalId: string,
  ) {
    return this.sanitaryService.getWithdrawalStatus(est, animalId);
  }
}
