import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';

@ApiTags('Movements')
@ApiBearerAuth()
@Controller('animals/:animalId/movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post()
  @ApiOperation({ summary: 'Trasladar un animal a otro potrero/corral' })
  @ApiCreatedResponse({ description: 'Movimiento registrado y ubicación actual actualizada' })
  move(
    @CurrentUser('establishmentId') est: string,
    @Param('animalId', new ParseUUIDPipe()) animalId: string,
    @Body() dto: CreateMovementDto,
  ) {
    return this.movementsService.moveAnimal(est, animalId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Historial de movimientos del animal' })
  findAll(
    @CurrentUser('establishmentId') est: string,
    @Param('animalId', new ParseUUIDPipe()) animalId: string,
  ) {
    return this.movementsService.findForAnimal(est, animalId);
  }
}
