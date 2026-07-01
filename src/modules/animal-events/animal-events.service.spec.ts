import { ConflictException, NotFoundException } from '@nestjs/common';
import { AnimalEventType } from '@prisma/client';
import { AnimalEventsService } from './animal-events.service';
import { AnimalEventsRepository } from './animal-events.repository';

const EST = 'est-1';

describe('AnimalEventsService', () => {
  let service: AnimalEventsService;
  let repo: {
    create: jest.Mock;
    findById: jest.Mock;
    animalBelongsToEstablishment: jest.Mock;
    byAnimal: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      create: jest.fn((data) => Promise.resolve({ id: 'ev-1', ...data })),
      findById: jest.fn().mockResolvedValue(null),
      animalBelongsToEstablishment: jest.fn().mockResolvedValue(true),
      byAnimal: jest.fn().mockResolvedValue([]),
    };
    service = new AnimalEventsService(repo as unknown as AnimalEventsRepository);
  });

  it('registra una nota con fecha en la bitácora del animal', async () => {
    await service.create(EST, 'a-1', { type: AnimalEventType.NOTA, note: 'Cojera leve' });
    const arg = repo.create.mock.calls[0][0];
    expect(arg.type).toBe(AnimalEventType.NOTA);
    expect(arg.note).toBe('Cojera leve');
    expect(arg.establishment.connect.id).toBe(EST);
    expect(arg.animal.connect.id).toBe('a-1');
  });

  it('registra condición corporal (score) y peso', async () => {
    await service.create(EST, 'a-1', {
      type: AnimalEventType.CONDICION_CORPORAL,
      score: 3.5,
      weightKg: 420,
    });
    const arg = repo.create.mock.calls[0][0];
    expect(Number(arg.score)).toBe(3.5);
    expect(Number(arg.weightKg)).toBe(420);
  });

  it('rechaza (404) si el animal no es del establecimiento (aislamiento)', async () => {
    repo.animalBelongsToEstablishment.mockResolvedValue(false);
    await expect(
      service.create(EST, 'a-1', { type: AnimalEventType.NOTA }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('es idempotente: id de cliente ya existente devuelve el evento sin duplicar', async () => {
    const existing = { id: 'dup', establishmentId: EST };
    repo.findById.mockResolvedValue(existing);
    const r = await service.create(EST, 'a-1', { id: 'dup', type: AnimalEventType.NOTA });
    expect(r).toBe(existing);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('una colisión de id con otro establecimiento es un conflicto (no 500)', async () => {
    repo.findById.mockResolvedValue({ id: 'dup', establishmentId: 'otro' });
    await expect(
      service.create(EST, 'a-1', { id: 'dup', type: AnimalEventType.NOTA }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lista valida pertenencia del animal al establecimiento', async () => {
    repo.animalBelongsToEstablishment.mockResolvedValue(false);
    await expect(service.listByAnimal(EST, 'a-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
