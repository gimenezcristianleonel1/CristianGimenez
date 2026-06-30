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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryLocationsDto } from './dto/query-locations.dto';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una ubicación (potrero / corral / lote)' })
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar ubicaciones (filtro por tipo + paginación)' })
  findAll(@Query() query: QueryLocationsDto) {
    return this.locationsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una ubicación con su ocupación actual' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.locationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una ubicación' })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una ubicación (debe estar vacía)' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.locationsService.remove(id);
  }
}
