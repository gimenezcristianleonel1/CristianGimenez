import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { ImportExcelDto } from './dto/import-excel.dto';
import { ImportRowsDto } from './dto/import-rows.dto';
import { AppField } from './header-matching';

const EXCEL_LIMIT = 10 * 1024 * 1024; // 10 MB
const IMAGE_LIMIT = 8 * 1024 * 1024; // 8 MB c/u
const MAX_IMAGES = 50;

@ApiTags('Import')
@ApiBearerAuth()
@Controller('animals')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Importar animales desde un Excel (fuzzy matching de columnas + aprendizaje de plantillas)',
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EXCEL_LIMIT } }))
  importExcel(
    @CurrentUser('establishmentId') est: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ImportExcelDto,
  ) {
    if (!file) {
      throw new BadRequestException('Adjuntá un archivo Excel en el campo "file"');
    }
    const mapping = this.parseMapping(dto.mapping);
    const saveTemplate = dto.saveTemplate !== 'false';
    return this.importService.importExcel(est, file.buffer, mapping, saveTemplate, dto.locationId);
  }

  @Post('import/photos')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir varias fotos y asociarlas por nombre de archivo a la caravana del animal',
  })
  @UseInterceptors(FilesInterceptor('files', MAX_IMAGES, { limits: { fileSize: IMAGE_LIMIT } }))
  importPhotos(
    @CurrentUser('establishmentId') est: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Adjuntá una o más imágenes en el campo "files"');
    }
    return this.importService.importPhotos(est, files);
  }

  @Post('import/image')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Leer con IA una foto (JPG/PNG) de una planilla y devolver filas para revisar',
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_LIMIT } }))
  extractImage(
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Adjuntá una imagen en el campo "file"');
    }
    return this.importService.extractFromImage(file);
  }

  @Post('import/preview')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Parsear un Excel y devolver las filas para revisar/editar antes de guardar',
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EXCEL_LIMIT } }))
  previewExcel(
    @CurrentUser('establishmentId') est: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ImportExcelDto,
  ) {
    if (!file) {
      throw new BadRequestException('Adjuntá un archivo Excel en el campo "file"');
    }
    const mapping = this.parseMapping(dto.mapping);
    return this.importService.extractFromExcel(est, file.buffer, mapping);
  }

  @Post('import/rows')
  @ApiOperation({ summary: 'Guardar las filas ya revisadas/editadas por el usuario' })
  saveRows(@CurrentUser('establishmentId') est: string, @Body() dto: ImportRowsDto) {
    return this.importService.saveRows(est, dto.rows, dto.locationId);
  }

  @Get('export/xlsx')
  @ApiOperation({ summary: 'Exportar todos los animales del establecimiento a Excel' })
  async exportExcel(
    @CurrentUser('establishmentId') est: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.importService.exportAnimals(est);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="animales.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id/photo')
  @ApiOperation({ summary: 'Obtener la foto de un animal' })
  async getPhoto(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { mimeType, data } = await this.importService.getPhoto(est, id);
    res.set({ 'Content-Type': mimeType, 'Content-Length': data.length });
    res.end(data);
  }

  private parseMapping(raw?: string): Partial<Record<AppField, string>> | undefined {
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Partial<Record<AppField, string>>;
      }
      throw new Error('mapping debe ser un objeto');
    } catch {
      throw new BadRequestException('El campo "mapping" no es un JSON válido');
    }
  }
}
