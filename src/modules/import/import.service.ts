import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Sex, Species } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { CreateAnimalDto } from '@modules/animals/dto/create-animal.dto';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { AnimalsService } from '@modules/animals/animals.service';
import { AnimalsRepository } from '@modules/animals/animals.repository';
import { ImportTemplatesRepository } from './import-templates.repository';
import { GeminiVisionService, VisionRow } from './gemini-vision.service';
import {
  APP_FIELDS,
  AppField,
  FIELD_LABELS,
  hasRequiredFields,
  matchHeaders,
  normalizeSex,
  normalizeSpecies,
  signatureOf,
} from './header-matching';

const MAX_ROWS = 5000;

export interface ImportResult {
  status: 'OK';
  total: number;
  imported: number;
  skipped: number; // duplicados (caravana ya existente)
  errors: Array<{ row: number; message: string }>;
  mappingUsed: Partial<Record<AppField, string>>;
  savedTemplate: boolean;
}

export interface RequiresMappingResult {
  status: 'REQUIERE_MAPEO';
  columns: string[];
  suggestedMapping: Partial<Record<AppField, string>>;
  fields: Array<{ field: AppField; label: string; required: boolean }>;
  sampleRows: Array<Record<string, unknown>>;
}

export interface PhotoImportResult {
  matched: Array<{ filename: string; tagId: string; animalId: string }>;
  unmatched: string[];
}

/** Fila ya normalizada a nuestro esquema, para revisar/editar antes de guardar. */
export interface ExtractedRow {
  tagId: string;
  species: Species;
  breed: string;
  sex: Sex;
  birthDate: string; // yyyy-mm-dd ('' si no se detectó)
  initialWeightKg: number | null;
  /** Campos que la IA/planilla no supo con certeza (para resaltar en la tabla). */
  issues: AppField[];
}

export interface ExtractResult {
  status: 'REVISAR';
  source: 'image' | 'excel';
  rows: ExtractedRow[];
}

/** Fila tal como la envía el frontend tras editar (todo texto, laxo). */
export interface ImportRowInput {
  tagId?: string;
  species?: string;
  breed?: string;
  sex?: string;
  birthDate?: string;
  initialWeightKg?: string | number | null;
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animalsService: AnimalsService,
    private readonly animalsRepo: AnimalsRepository,
    private readonly templates: ImportTemplatesRepository,
    private readonly vision: GeminiVisionService,
  ) {}

  // ---------------------------------------------------------------- Excel

  async importExcel(
    establishmentId: string,
    buffer: Buffer,
    providedMapping?: Partial<Record<AppField, string>>,
    saveTemplate = true,
    locationId?: string,
  ): Promise<ImportResult | RequiresMappingResult> {
    // Si se pide asignar a un potrero, validamos una sola vez que sea del establecimiento.
    if (locationId) {
      const location = await this.animalsRepo.findLocationById(locationId);
      if (!location || location.establishmentId !== establishmentId) {
        throw new BadRequestException('El potrero indicado no existe en tu establecimiento');
      }
    }

    const { headers, rows } = await this.parseWorkbook(buffer);
    if (headers.length === 0) {
      throw new BadRequestException('El archivo no tiene encabezados válidos');
    }

    const signature = signatureOf(headers);

    // Prioridad del mapeo: el que envía el usuario > plantilla guardada > automático.
    let mapping = providedMapping;
    let savedTemplate = false;

    if (!mapping) {
      const template = await this.templates.findBySignature(establishmentId, signature);
      if (template) {
        mapping = template.mapping as Partial<Record<AppField, string>>;
      }
    }
    if (!mapping) {
      mapping = matchHeaders(headers).mapping;
    }

    // Si no se puede identificar al menos la caravana, pedimos mapeo manual.
    if (!hasRequiredFields(mapping)) {
      return this.buildRequiresMapping(headers, matchHeaders(headers).mapping, rows);
    }

    // Si el usuario confirmó un mapeo, lo aprendemos para la próxima vez.
    if (providedMapping && saveTemplate) {
      await this.templates.upsert(
        establishmentId,
        signature,
        mapping as unknown as Prisma.InputJsonValue,
      );
      savedTemplate = true;
    }

    const result: ImportResult = {
      status: 'OK',
      total: rows.length,
      imported: 0,
      skipped: 0,
      errors: [],
      mappingUsed: mapping,
      savedTemplate,
    };

    let rowNumber = 1; // fila 1 = encabezados
    for (const row of rows) {
      rowNumber++;
      const dto = this.rowToDto(row, mapping, locationId);
      if (!dto) {
        result.errors.push({ row: rowNumber, message: 'Falta la caravana' });
        continue;
      }
      try {
        // Reutiliza la lógica de negocio (validaciones + eventos + tenant scoping).
        await this.animalsService.create(establishmentId, dto);
        result.imported++;
      } catch (err) {
        if (err instanceof ConflictException) {
          result.skipped++; // caravana ya existente en este establecimiento
        } else {
          result.errors.push({
            row: rowNumber,
            message: err instanceof Error ? err.message : 'Error desconocido',
          });
        }
      }
    }

    return result;
  }

  private rowToDto(
    row: Record<string, unknown>,
    mapping: Partial<Record<AppField, string>>,
    locationId?: string,
  ): CreateAnimalDto | null {
    const get = (field: AppField): unknown => {
      const header = mapping[field];
      return header ? row[header] : undefined;
    };

    const tagId = String(get('tagId') ?? '').trim();
    if (!tagId) return null;

    const breedRaw = String(get('breed') ?? '').trim();
    const weight = this.parseNumber(get('initialWeightKg'));
    const birth = this.parseDate(get('birthDate'));

    return {
      tagId,
      species: mapping.species ? normalizeSpecies(get('species')) : Species.BOVINE,
      breed: breedRaw || 'Sin especificar',
      sex: mapping.sex ? normalizeSex(get('sex')) : Sex.FEMALE,
      birthDate: (birth ?? new Date()).toISOString(),
      initialWeightKg: weight && weight > 0 ? weight : 1,
      ...(locationId ? { currentLocationId: locationId } : {}),
    };
  }

  private buildRequiresMapping(
    headers: string[],
    suggested: Partial<Record<AppField, string>>,
    rows: Array<Record<string, unknown>>,
  ): RequiresMappingResult {
    return {
      status: 'REQUIERE_MAPEO',
      columns: headers,
      suggestedMapping: suggested,
      fields: APP_FIELDS.map((field) => ({
        field,
        label: FIELD_LABELS[field],
        required: field === 'tagId',
      })),
      sampleRows: rows.slice(0, 3),
    };
  }

  // ----------------------------------------- Importar con revisión (IA / Excel)

  /** Lee una imagen (JPG/PNG) con IA y devuelve filas para revisar (NO guarda). */
  async extractFromImage(file: Express.Multer.File): Promise<ExtractResult> {
    if (!this.vision.enabled) {
      throw new BadRequestException(
        'La lectura por foto no está configurada (falta la API key de Gemini).',
      );
    }
    const base64 = file.buffer.toString('base64');
    const raw = await this.vision.extractRows(base64, file.mimetype || 'image/jpeg');
    const rows = raw.map((r) => this.normalizeExtractedRow(r)).filter((r) => this.rowHasData(r));
    return { status: 'REVISAR', source: 'image', rows };
  }

  /**
   * Parsea un Excel y devuelve filas para revisar (NO guarda). Si no puede
   * identificar la caravana, pide el mapeo de columnas como en la importación.
   */
  async extractFromExcel(
    establishmentId: string,
    buffer: Buffer,
    providedMapping?: Partial<Record<AppField, string>>,
  ): Promise<ExtractResult | RequiresMappingResult> {
    const { headers, rows } = await this.parseWorkbook(buffer);
    if (headers.length === 0) {
      throw new BadRequestException('El archivo no tiene encabezados válidos');
    }
    const signature = signatureOf(headers);

    let mapping = providedMapping;
    if (!mapping) {
      const template = await this.templates.findBySignature(establishmentId, signature);
      if (template) mapping = template.mapping as Partial<Record<AppField, string>>;
    }
    if (!mapping) mapping = matchHeaders(headers).mapping;

    if (!hasRequiredFields(mapping)) {
      return this.buildRequiresMapping(headers, matchHeaders(headers).mapping, rows);
    }

    const extracted = rows.map((row) => this.rowToExtracted(row, mapping!));
    return { status: 'REVISAR', source: 'excel', rows: extracted };
  }

  /** Guarda las filas ya revisadas/editadas por el usuario. */
  async saveRows(
    establishmentId: string,
    rows: ImportRowInput[],
    locationId?: string,
  ): Promise<ImportResult> {
    if (locationId) {
      const location = await this.animalsRepo.findLocationById(locationId);
      if (!location || location.establishmentId !== establishmentId) {
        throw new BadRequestException('El potrero indicado no existe en tu establecimiento');
      }
    }

    const result: ImportResult = {
      status: 'OK',
      total: rows.length,
      imported: 0,
      skipped: 0,
      errors: [],
      mappingUsed: {},
      savedTemplate: false,
    };

    let n = 0;
    for (const row of rows) {
      n++;
      const dto = this.extractedToDto(row, locationId);
      if (!dto) {
        result.errors.push({ row: n, message: 'Falta la caravana' });
        continue;
      }
      try {
        await this.animalsService.create(establishmentId, dto);
        result.imported++;
      } catch (err) {
        if (err instanceof ConflictException) {
          result.skipped++;
        } else {
          result.errors.push({
            row: n,
            message: err instanceof Error ? err.message : 'Error desconocido',
          });
        }
      }
    }
    return result;
  }

  /** Normaliza una fila cruda (de la IA) al esquema y marca lo incierto. */
  private normalizeExtractedRow(v: VisionRow): ExtractedRow {
    const issues: AppField[] = [];
    const has = (x: unknown): boolean => x != null && String(x).trim() !== '';

    const tagId = String(v.tagId ?? '').trim();
    if (!tagId) issues.push('tagId');

    if (!has(v.species)) issues.push('species');
    if (!has(v.breed)) issues.push('breed');
    if (!has(v.sex)) issues.push('sex');

    const birth = this.parseDate(v.birthDate);
    if (!birth) issues.push('birthDate');

    const weight = this.parseNumber(v.initialWeightKg);
    if (weight == null || weight <= 0) issues.push('initialWeightKg');

    return {
      tagId,
      species: has(v.species) ? normalizeSpecies(v.species) : Species.BOVINE,
      breed: has(v.breed) ? String(v.breed).trim() : 'Sin especificar',
      sex: has(v.sex) ? normalizeSex(v.sex) : Sex.FEMALE,
      birthDate: birth ? birth.toISOString().slice(0, 10) : '',
      initialWeightKg: weight != null && weight > 0 ? weight : null,
      issues,
    };
  }

  /** Fila de Excel (con mapeo) → fila normalizada para revisar. */
  private rowToExtracted(
    row: Record<string, unknown>,
    mapping: Partial<Record<AppField, string>>,
  ): ExtractedRow {
    const get = (field: AppField): unknown => {
      const header = mapping[field];
      return header ? row[header] : undefined;
    };
    return this.normalizeExtractedRow({
      tagId: get('tagId') as string,
      species: get('species') as string,
      breed: get('breed') as string,
      sex: get('sex') as string,
      birthDate: get('birthDate') as string,
      initialWeightKg: get('initialWeightKg') as string,
    });
  }

  private rowHasData(r: ExtractedRow): boolean {
    return !!(r.tagId || r.breed !== 'Sin especificar' || r.birthDate || r.initialWeightKg);
  }

  /** Fila revisada → DTO de creación (con defaults seguros). */
  private extractedToDto(
    row: ImportRowInput,
    locationId?: string,
  ): CreateAnimalDto | null {
    const tagId = String(row.tagId ?? '').trim();
    if (!tagId) return null;
    const weight = this.parseNumber(row.initialWeightKg);
    const birth = this.parseDate(row.birthDate);
    return {
      tagId,
      species: row.species ? normalizeSpecies(row.species) : Species.BOVINE,
      breed: String(row.breed ?? '').trim() || 'Sin especificar',
      sex: row.sex ? normalizeSex(row.sex) : Sex.FEMALE,
      birthDate: (birth ?? new Date()).toISOString(),
      initialWeightKg: weight && weight > 0 ? weight : 1,
      ...(locationId ? { currentLocationId: locationId } : {}),
    };
  }

  private async parseWorkbook(
    buffer: Buffer,
  ): Promise<{ headers: string[]; rows: Array<Record<string, unknown>> }> {
    const workbook = new ExcelJS.Workbook();
    try {
      // Cast por diferencias de tipos entre @types/node (Buffer) y exceljs.
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel (.xlsx)');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo no tiene hojas');

    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, col) => {
      headers[col] = String(this.cellValue(cell.value) ?? '').trim();
    });

    const rows: Array<Record<string, unknown>> = [];
    const lastRow = Math.min(sheet.rowCount, MAX_ROWS + 1);
    for (let r = 2; r <= lastRow; r++) {
      const excelRow = sheet.getRow(r);
      const obj: Record<string, unknown> = {};
      let hasValue = false;
      headers.forEach((header, col) => {
        if (!header) return;
        const value = this.cellValue(excelRow.getCell(col).value);
        obj[header] = value;
        if (value !== null && value !== undefined && String(value).trim() !== '') hasValue = true;
      });
      if (hasValue) rows.push(obj);
    }

    return { headers: headers.filter((h) => h && h.length > 0), rows };
  }

  /** Extrae un valor primitivo de una celda de ExcelJS (maneja fechas/fórmulas/rich text). */
  private cellValue(value: ExcelJS.CellValue): unknown {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value;
    if (typeof value === 'object') {
      const v = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
      if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
      if ('text' in v && v.text !== undefined) return v.text;
      if ('result' in v) return v.result;
    }
    return value;
  }

  private parseNumber(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = parseFloat(value.replace(',', '.').replace(/[^0-9.\-]/g, ''));
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  private parseDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value > new Date() ? new Date() : value; // no futuras
    }
    if (typeof value === 'string') {
      const s = value.trim();
      const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
      if (dmy) {
        const [, d, m, yRaw] = dmy;
        const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
        const dt = new Date(Number(y), Number(m) - 1, Number(d));
        return Number.isNaN(dt.getTime()) || dt > new Date() ? null : dt;
      }
      const dt = new Date(s);
      if (!Number.isNaN(dt.getTime())) return dt > new Date() ? new Date() : dt;
    }
    return null;
  }

  // ---------------------------------------------------------------- Fotos

  async importPhotos(
    establishmentId: string,
    files: Array<{ originalname: string; mimetype: string; buffer: Buffer }>,
  ): Promise<PhotoImportResult> {
    const result: PhotoImportResult = { matched: [], unmatched: [] };

    for (const file of files) {
      const animal = await this.findAnimalByFilename(establishmentId, file.originalname);
      if (!animal) {
        result.unmatched.push(file.originalname);
        continue;
      }
      await this.prisma.animalPhoto.upsert({
        where: { animalId: animal.id },
        update: { data: file.buffer, mimeType: file.mimetype, filename: file.originalname },
        create: {
          animalId: animal.id,
          data: file.buffer,
          mimeType: file.mimetype,
          filename: file.originalname,
        },
      });
      result.matched.push({ filename: file.originalname, tagId: animal.tagId, animalId: animal.id });
    }

    return result;
  }

  /** Busca un animal del establecimiento cuya caravana coincida con el nombre del archivo. */
  private async findAnimalByFilename(establishmentId: string, filename: string) {
    const stem = filename.replace(/\.[^.]+$/, '').trim();
    const digits = stem.match(/\d+/g)?.join('') ?? '';
    const candidates = Array.from(new Set([stem, digits].filter((c) => c.length > 0)));

    for (const candidate of candidates) {
      const animal = await this.animalsRepo.findByTagId(establishmentId, candidate);
      if (animal) return animal;
    }
    return null;
  }

  async getPhoto(
    establishmentId: string,
    animalId: string,
  ): Promise<{ mimeType: string; data: Buffer }> {
    const animal = await this.animalsRepo.findById(animalId);
    if (!animal || animal.establishmentId !== establishmentId) {
      throw new NotFoundException(`Animal ${animalId} not found`);
    }
    const photo = await this.prisma.animalPhoto.findUnique({ where: { animalId } });
    if (!photo) {
      throw new NotFoundException('El animal no tiene foto');
    }
    return { mimeType: photo.mimeType, data: Buffer.from(photo.data) };
  }

  // ---------------------------------------------------------------- Export

  async exportAnimals(establishmentId: string): Promise<Buffer> {
    const animals = await this.animalsRepo.findAllByEstablishment(establishmentId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gestión Ganadera';
    const sheet = workbook.addWorksheet('Animales');
    sheet.columns = [
      { header: 'Caravana', key: 'tagId', width: 16 },
      { header: 'Especie', key: 'species', width: 12 },
      { header: 'Raza', key: 'breed', width: 16 },
      { header: 'Sexo', key: 'sex', width: 10 },
      { header: 'Fecha de nacimiento', key: 'birthDate', width: 18 },
      { header: 'Peso inicial (kg)', key: 'initialWeightKg', width: 16 },
      { header: 'Estado', key: 'status', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const a of animals) {
      sheet.addRow({
        tagId: a.tagId,
        species: a.species,
        breed: a.breed,
        sex: a.sex,
        birthDate: a.birthDate.toISOString().slice(0, 10),
        initialWeightKg: Number(a.initialWeightKg),
        status: a.status,
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
