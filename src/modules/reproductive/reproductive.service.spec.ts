import { NotFoundException } from '@nestjs/common';
import { CheckType, PregnancyStatus } from '@prisma/client';
import { ReproductiveService } from './reproductive.service';
import { ReproductiveRepository } from './reproductive.repository';

const EST = 'est-1';

describe('ReproductiveService', () => {
  let service: ReproductiveService;
  let repo: {
    create: jest.Mock;
    findById: jest.Mock;
    animalBelongsToEstablishment: jest.Mock;
    locationBelongsToEstablishment: jest.Mock;
    countByResultForPotrero: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      create: jest.fn((data) => Promise.resolve({ id: 'chk-1', ...data })),
      findById: jest.fn().mockResolvedValue(null),
      animalBelongsToEstablishment: jest.fn().mockResolvedValue(true),
      locationBelongsToEstablishment: jest.fn().mockResolvedValue(true),
      countByResultForPotrero: jest.fn(),
    };
    service = new ReproductiveService(repo as unknown as ReproductiveRepository);
  });

  describe('create', () => {
    const dto = {
      animalId: 'a-1',
      potreroId: 'p-1',
      type: CheckType.TACTO,
      result: PregnancyStatus.PRENADA,
    };

    it('registra el chequeo cuando animal y potrero son del establecimiento', async () => {
      await service.create(EST, dto);
      expect(repo.create).toHaveBeenCalledTimes(1);
      const arg = repo.create.mock.calls[0][0];
      expect(arg.establishment.connect.id).toBe(EST);
      expect(arg.animal.connect.id).toBe('a-1');
      expect(arg.potreroId).toBe('p-1');
    });

    it('rechaza (404) si el animal no pertenece al establecimiento (aislamiento)', async () => {
      repo.animalBelongsToEstablishment.mockResolvedValue(false);
      await expect(service.create(EST, dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rechaza (404) si el potrero no pertenece al establecimiento', async () => {
      repo.locationBelongsToEstablishment.mockResolvedValue(false);
      await expect(service.create(EST, dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('es idempotente: si el id del cliente ya existe, devuelve el chequeo sin duplicar', async () => {
      const existing = { id: 'dup', establishmentId: EST };
      repo.findById.mockResolvedValue(existing);
      const res = await service.create(EST, { ...dto, id: 'dup' });
      expect(res).toBe(existing);
      expect(repo.create).not.toHaveBeenCalled();
      // No revalida ni intenta insertar: corta por idempotencia.
      expect(repo.animalBelongsToEstablishment).not.toHaveBeenCalled();
    });
  });

  describe('summary', () => {
    it('calcula totales, porcentajes y alerta cuando %vacías > 15', async () => {
      // 8 preñadas + 2 vacías = 10 → 20% vacías (supera el 15%)
      repo.countByResultForPotrero.mockResolvedValue([
        { result: PregnancyStatus.PRENADA, count: 8 },
        { result: PregnancyStatus.VACIA, count: 2 },
      ]);
      const r = await service.summary(EST, 'p-1');
      expect(r.totalControlados).toBe(10);
      expect(r.prenadas).toBe(8);
      expect(r.vacias).toBe(2);
      expect(r.porcentajePrenez).toBe(80);
      expect(r.porcentajeVacias).toBe(20);
      expect(r.alerta).toContain('20%');
    });

    it('no emite alerta cuando %vacías <= 15', async () => {
      repo.countByResultForPotrero.mockResolvedValue([
        { result: PregnancyStatus.PRENADA, count: 9 },
        { result: PregnancyStatus.VACIA, count: 1 },
      ]);
      const r = await service.summary(EST, 'p-1');
      expect(r.porcentajeVacias).toBe(10);
      expect(r.alerta).toBeNull();
    });

    it('sin controles devuelve ceros y sin alerta', async () => {
      repo.countByResultForPotrero.mockResolvedValue([]);
      const r = await service.summary(EST, 'p-1');
      expect(r.totalControlados).toBe(0);
      expect(r.porcentajePrenez).toBe(0);
      expect(r.porcentajeVacias).toBe(0);
      expect(r.alerta).toBeNull();
    });
  });
});
