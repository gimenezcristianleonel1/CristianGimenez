import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SanitaryService } from './sanitary.service';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';

@ApiTags('Sanidad')
@Controller('animals/:animalId/health')
export class SanitaryController {
  constructor(private readonly sanitaryService: SanitaryService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un evento sanitario (vacuna, desparasitación, tratamiento, cirugía)',
  })
  @ApiCreatedResponse({ description: 'Evento sanitario registrado' })
  create(
    @Param('animalId', new ParseUUIDPipe()) animalId: string,
    @Body() dto: CreateHealthRecordDto,
  ) {
    return this.sanitaryService.createForAnimal(animalId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Historial sanitario del animal' })
  findAll(@Param('animalId', new ParseUUIDPipe()) animalId: string) {
    return this.sanitaryService.findForAnimal(animalId);
  }

  @Get('withdrawal-status')
  @ApiOperation({ summary: 'Estado de carencia actual del animal (apto para consumo/venta)' })
  withdrawalStatus(@Param('animalId', new ParseUUIDPipe()) animalId: string) {
    return this.sanitaryService.getWithdrawalStatus(animalId);
  }
}
