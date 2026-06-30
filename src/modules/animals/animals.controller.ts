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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { QueryAnimalsDto } from './dto/query-animals.dto';
import { AddWeightDto } from './dto/add-weight.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

@ApiTags('Animals')
@Controller('animals')
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo animal en el inventario' })
  @ApiCreatedResponse({ description: 'Animal registrado' })
  create(@Body() dto: CreateAnimalDto) {
    return this.animalsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar animales (filtros + paginación)' })
  @ApiOkResponse({ description: 'Listado paginado de animales' })
  findAll(@Query() query: QueryAnimalsDto) {
    return this.animalsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un animal con su genealogía y últimos pesajes' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.animalsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos mutables del animal' })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateAnimalDto) {
    return this.animalsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un animal del inventario' })
  @ApiNoContentResponse({ description: 'Animal eliminado' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.animalsService.remove(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Cambiar el estado del animal (valida transición y período de carencia)',
  })
  changeStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ChangeStatusDto) {
    return this.animalsService.changeStatus(id, dto);
  }

  @Post(':id/weights')
  @ApiOperation({ summary: 'Registrar un pesaje (serie temporal append-only)' })
  @ApiCreatedResponse({ description: 'Pesaje registrado' })
  addWeight(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AddWeightDto) {
    return this.animalsService.addWeight(id, dto);
  }

  @Get(':id/weights')
  @ApiOperation({ summary: 'Histórico de pesajes del animal' })
  getWeightHistory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.animalsService.getWeightHistory(id);
  }

  @Get(':id/weights/projection')
  @ApiOperation({
    summary: 'Proyección de peso (GDP + 30/60/90 días) vía PredictiveEngine',
  })
  getWeightProjection(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.animalsService.getWeightProjection(id);
  }
}
