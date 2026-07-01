import { ConflictException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { AnimalsService } from '@modules/animals/animals.service';
import { AnimalsRepository } from '@modules/animals/animals.repository';
import { ImportService, ImportResult, RequiresMappingResult } from './import.service';
import { ImportTemplatesRepository } from './import-templates.repository';

const EST = 'est-1';
const OTHER_EST = 'est-2';

async function makeXlsx(headers: string[], rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1');
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('ImportService (multi-tenant)', () => {
  let service: ImportService;
  let prisma: { animalPhoto: { upsert: jest.Mock } };
  let animalsService: { create: jest.Mock };
  let animalsRepo: { findByTagId: jest.Mock; findById: jest.Mock; findAllByEstablishment: jest.Mock };
  let templates: { findBySignature: jest.Mock; upsert: jest.Mock };

  beforeEach(() => {
    prisma = { animalPhoto: { upsert: jest.fn().mockResolvedValue({}) } };
    animalsService = { create: jest.fn().mockResolvedValue({ id: 'x' }) };
    animalsRepo = {
      findByTagId: jest.fn(),
      findById: jest.fn(),
      findAllByEstablishment: jest.fn().mockResolvedValue([]),
    };
    templates = { findBySignature: jest.fn().mockResolvedValue(null), upsert: jest.fn() };

    service = new ImportService(
      prisma as unknown as PrismaService,
      animalsService as unknown as AnimalsService,
      animalsRepo as unknown as AnimalsRepository,
      templates as unknown as ImportTemplatesRepository,
    );
  });

  it('importa animales SIEMPRE bajo el establishmentId del usuario (aislamiento)', async () => {
    const buffer = await makeXlsx(
      ['Caravana', 'Raza', 'Peso'],
      [
        ['AR-1', 'Angus', 300],
        ['AR-2', 'Hereford', 280],
      ],
    );

    const res = (await service.importExcel(EST, buffer)) as ImportResult;

    expect(res.status).toBe('OK');
    expect(res.imported).toBe(2);
    expect(animalsService.create).toHaveBeenCalledTimes(2);
    // Cada creación se hace con el establishmentId del que importa (no otro).
    for (const call of animalsService.create.mock.calls) {
      expect(call[0]).toBe(EST);
      expect(call[0]).not.toBe(OTHER_EST);
    }
    expect(animalsService.create).toHaveBeenCalledWith(
      EST,
      expect.objectContaining({ tagId: 'AR-1', breed: 'Angus' }),
    );
  });

  it('pide REQUIERE_MAPEO cuando los encabezados son desconocidos', async () => {
    const buffer = await makeXlsx(['Columna X', 'Dato Raro'], [['a', 'b']]);
    const res = (await service.importExcel(EST, buffer)) as RequiresMappingResult;
    expect(res.status).toBe('REQUIERE_MAPEO');
    expect(res.columns).toEqual(['Columna X', 'Dato Raro']);
    expect(animalsService.create).not.toHaveBeenCalled();
  });

  it('cuenta como "skipped" las caravanas duplicadas (409)', async () => {
    animalsService.create.mockRejectedValueOnce(new ConflictException('dup')).mockResolvedValue({});
    const buffer = await makeXlsx(
      ['Caravana'],
      [['DUP'], ['NUEVO']],
    );
    const res = (await service.importExcel(EST, buffer)) as ImportResult;
    expect(res.skipped).toBe(1);
    expect(res.imported).toBe(1);
  });

  it('guarda la plantilla cuando el usuario confirma un mapeo manual', async () => {
    const buffer = await makeXlsx(['Bicho', 'Kilos'], [['T1', 250]]);
    await service.importExcel(EST, buffer, { tagId: 'Bicho', initialWeightKg: 'Kilos' }, true);
    expect(templates.upsert).toHaveBeenCalledTimes(1);
    expect(templates.upsert.mock.calls[0][0]).toBe(EST); // scoped al establecimiento
  });

  it('asocia fotos por nombre de archivo buscando SÓLO en el establecimiento', async () => {
    animalsRepo.findByTagId.mockImplementation((est: string, tag: string) =>
      est === EST && tag === '2044'
        ? Promise.resolve({ id: 'a1', tagId: '2044', establishmentId: EST })
        : Promise.resolve(null),
    );

    const res = await service.importPhotos(EST, [
      { originalname: 'caravana_2044.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('img') },
      { originalname: '9999.png', mimetype: 'image/png', buffer: Buffer.from('img') },
    ]);

    expect(res.matched).toEqual([{ filename: 'caravana_2044.jpg', tagId: '2044', animalId: 'a1' }]);
    expect(res.unmatched).toEqual(['9999.png']);
    // La búsqueda de caravana se hizo con el establishmentId del usuario.
    for (const call of animalsRepo.findByTagId.mock.calls) {
      expect(call[0]).toBe(EST);
    }
    expect(prisma.animalPhoto.upsert).toHaveBeenCalledTimes(1);
  });
});
