import { NotFoundException } from '@nestjs/common';
import { CheckType, PregnancyStatus, ReproEventType } from '@prisma/client';
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
    createEvent: jest.Mock;
    findEventById: jest.Mock;
    countChecksByResult: jest.Mock;
    countEventsByType: jest.Mock;
    eventsByAnimal: jest.Mock;
    checksByAnimal: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      create: jest.fn((data) => Promise.resolve({ id: 'chk-1', ...data })),
      findById: jest.fn().mockResolvedValue(null),
      animalBelongsToEstablishment: jest.fn().mockResolvedValue(true),
      locationBelongsToEstablishment: jest.fn().mockResolvedValue(true),
      countByResultForPotrero: jest.fn(),
      createEvent: jest.fn((data) => Promise.resolve({ id: 'ev-1', ...data })),
      findEventById: jest.fn().mockResolvedValue(null),
      countChecksByResult: jest.fn().mockResolvedValue([]),
      countEventsByType: jest.fn().mockResolvedValue([]),
      eventsByAnimal: jest.fn().mockResolvedValue([]),
      checksByAnimal: jest.fn().mockResolvedValue([]),
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

  describe('createEvent', () => {
    const dto = { animalId: 'a-1', type: ReproEventType.SERVICIO, sireTagId: '900' };

    it('registra el evento cuando el animal es del establecimiento', async () => {
      await service.createEvent(EST, dto);
      const arg = repo.createEvent.mock.calls[0][0];
      expect(arg.type).toBe(ReproEventType.SERVICIO);
      expect(arg.sireTagId).toBe('900');
      expect(arg.establishment.connect.id).toBe(EST);
    });

    it('rechaza (404) si el animal no es del establecimiento (aislamiento)', async () => {
      repo.animalBelongsToEstablishment.mockResolvedValue(false);
      await expect(service.createEvent(EST, dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.createEvent).not.toHaveBeenCalled();
    });

    it('es idempotente: id de cliente ya existente devuelve el evento sin duplicar', async () => {
      const existing = { id: 'dup', establishmentId: EST };
      repo.findEventById.mockResolvedValue(existing);
      const r = await service.createEvent(EST, { ...dto, id: 'dup' });
      expect(r).toBe(existing);
      expect(repo.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('indices', () => {
    it('calcula % preñez/parición/destete sobre servicios y la merma', async () => {
      repo.countChecksByResult.mockResolvedValue([
        { result: PregnancyStatus.PRENADA, count: 90 },
        { result: PregnancyStatus.VACIA, count: 10 },
      ]);
      repo.countEventsByType.mockResolvedValue([
        { type: ReproEventType.SERVICIO, count: 100 },
        { type: ReproEventType.PARICION, count: 85 },
        { type: ReproEventType.DESTETE, count: 80 },
      ]);
      const r = await service.indices(EST);
      expect(r.base).toBe('servicios');
      expect(r.porcentajePrenez).toBe(90); // 90/100
      expect(r.porcentajeParicion).toBe(85);
      expect(r.porcentajeDestete).toBe(80);
      expect(r.merma).toBe(10); // 90 - 80
    });

    it('sin servicios usa los tactos como denominador', async () => {
      repo.countChecksByResult.mockResolvedValue([
        { result: PregnancyStatus.PRENADA, count: 8 },
        { result: PregnancyStatus.VACIA, count: 2 },
      ]);
      repo.countEventsByType.mockResolvedValue([]);
      const r = await service.indices(EST);
      expect(r.base).toBe('tactos');
      expect(r.porcentajePrenez).toBe(80); // 8/10
    });
  });

  describe('timeline', () => {
    it('mezcla eventos y chequeos ordenados por fecha desc', async () => {
      repo.eventsByAnimal.mockResolvedValue([
        { type: ReproEventType.SERVICIO, date: new Date('2026-01-10'), sireTagId: '900' },
        { type: ReproEventType.PARICION, date: new Date('2026-10-05'), offspringTagId: '1204' },
      ]);
      repo.checksByAnimal.mockResolvedValue([
        { type: CheckType.TACTO, date: new Date('2026-03-01'), result: PregnancyStatus.PRENADA },
      ]);
      const r = await service.timeline(EST, 'a-1');
      expect(r.items.map((i) => i.kind)).toEqual(['PARICION', 'TACTO', 'SERVICIO']);
      expect(r.items[0].detail).toBe('Cría 1204');
      expect(r.items[2].detail).toBe('Toro 900');
    });

    it('rechaza (404) si el animal no es del establecimiento', async () => {
      repo.animalBelongsToEstablishment.mockResolvedValue(false);
      await expect(service.timeline(EST, 'a-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
