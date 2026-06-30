import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { QueryAnimalsDto } from './dto/query-animals.dto';
import { AddWeightDto } from './dto/add-weight.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

@ApiTags('Animals')
@ApiBearerAuth()
@Controller('animals')
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo animal en el inventario' })
  @ApiCreatedResponse({ description: 'Animal registrado' })
  create(@CurrentUser('establishmentId') est: string, @Body() dto: CreateAnimalDto) {
    return this.animalsService.create(est, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar animales (filtros + paginación)' })
  @ApiOkResponse({ description: 'Listado paginado de animales' })
  findAll(@CurrentUser('establishmentId') est: string, @Query() query: QueryAnimalsDto) {
    return this.animalsService.findAll(est, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un animal con su genealogía y últimos pesajes' })
  findOne(@CurrentUser('establishmentId') est: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.animalsService.findOne(est, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos mutables del animal' })
  update(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAnimalDto,
  ) {
    return this.animalsService.update(est, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un animal del inventario' })
  @ApiNoContentResponse({ description: 'Animal eliminado' })
  async remove(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.animalsService.remove(est, id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Cambiar el estado del animal (valida transición y período de carencia)',
  })
  changeStatus(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.animalsService.changeStatus(est, id, dto);
  }

  @Post(':id/weights')
  @ApiOperation({ summary: 'Registrar un pesaje (serie temporal append-only)' })
  @ApiCreatedResponse({ description: 'Pesaje registrado' })
  addWeight(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddWeightDto,
  ) {
    return this.animalsService.addWeight(est, id, dto);
  }

  @Get(':id/weights')
  @ApiOperation({ summary: 'Histórico de pesajes del animal' })
  getWeightHistory(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.animalsService.getWeightHistory(est, id);
  }

  @Get(':id/weights/projection')
  @ApiOperation({
    summary: 'Proyección de peso (GDP + 30/60/90 días) vía PredictiveEngine',
  })
  getWeightProjection(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.animalsService.getWeightProjection(est, id);
  }
}
