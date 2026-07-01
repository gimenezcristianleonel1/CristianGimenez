import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { AnimalEventsService } from './animal-events.service';
import { CreateAnimalEventDto } from './dto/create-animal-event.dto';

@ApiTags('AnimalEvents')
@ApiBearerAuth()
@Controller('animals/:animalId/events')
export class AnimalEventsController {
  constructor(private readonly service: AnimalEventsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un evento en la bitácora del animal (nota, CC, recorrida...)' })
  create(
    @CurrentUser('establishmentId') est: string,
    @Param('animalId', new ParseUUIDPipe()) animalId: string,
    @Body() dto: CreateAnimalEventDto,
  ) {
    return this.service.create(est, animalId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Historial de eventos del animal (más recientes primero)' })
  list(
    @CurrentUser('establishmentId') est: string,
    @Param('animalId', new ParseUUIDPipe()) animalId: string,
  ) {
    return this.service.listByAnimal(est, animalId);
  }
}
