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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryLocationsDto } from './dto/query-locations.dto';

@ApiTags('Locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una ubicación (potrero / corral / lote)' })
  create(@CurrentUser('establishmentId') est: string, @Body() dto: CreateLocationDto) {
    return this.locationsService.create(est, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar ubicaciones (filtro por tipo + paginación)' })
  findAll(@CurrentUser('establishmentId') est: string, @Query() query: QueryLocationsDto) {
    return this.locationsService.findAll(est, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una ubicación con su ocupación actual' })
  findOne(@CurrentUser('establishmentId') est: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.locationsService.findOne(est, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una ubicación' })
  update(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationsService.update(est, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una ubicación (debe estar vacía)' })
  async remove(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.locationsService.remove(est, id);
  }
}
