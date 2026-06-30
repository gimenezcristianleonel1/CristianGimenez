import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Animal, AnimalStatus, Sex, Species } from '@prisma/client';
import { IEventPublisher } from '@core/domain/events/event-publisher.interface';
import { PredictiveEngine } from '@core/ai/predictive-engine.interface';
import { AnimalsService } from './animals.service';
import { AnimalsRepository } from './animals.repository';

type Mock<T> = { [K in keyof T]: jest.Mock };

function buildAnimal(overrides: Partial<Animal> = {}): Animal {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    tagId: 'AR-0001',
    species: Species.BOVINE,
    breed: 'Angus',
    sex: Sex.MALE,
    birthDate: new Date('2024-01-01'),
    initialWeightKg: '45' as unknown as Animal['initialWeightKg'],
    status: AnimalStatus.ACTIVE,
    motherId: null,
    fatherId: null,
    currentLocationId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AnimalsService', () => {
  let service: AnimalsService;
  let repo: Mock<AnimalsRepository>;
  let events: Mock<IEventPublisher>;
  let engine: Mock<PredictiveEngine>;

  beforeEach(() => {
    repo = {
      findByTagId: jest.fn(),
      findById: jest.fn(),
      findByIdWithRelations: jest.fn(),
      findMany: jest.fn(),
      countByLocation: jest.fn(),
      findLocationById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      changeStatus: jest.fn(),
      addWeight: jest.fn(),
      getWeightHistory: jest.fn(),
      findActiveWithdrawals: jest.fn(),
    } as unknown as Mock<AnimalsRepository>;
    events = { publish: jest.fn(), publishAll: jest.fn() } as unknown as Mock<IEventPublisher>;
    engine = { projectWeight: jest.fn() } as unknown as Mock<PredictiveEngine>;

    service = new AnimalsService(
      repo as unknown as AnimalsRepository,
      events as unknown as IEventPublisher,
      engine as unknown as PredictiveEngine,
    );
  });

  describe('create', () => {
    it('rejects a duplicate caravan/tag with 409', async () => {
      repo.findByTagId.mockResolvedValue(buildAnimal());
      await expect(
        service.create({
          tagId: 'AR-0001',
          species: Species.BOVINE,
          breed: 'Angus',
          sex: Sex.MALE,
          birthDate: '2024-01-01',
          initialWeightKg: 45,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('changeStatus', () => {
    it('rejects an invalid transition from a terminal status', async () => {
      repo.findById.mockResolvedValue(buildAnimal({ status: AnimalStatus.SOLD }));
      await expect(
        service.changeStatus('id', { status: AnimalStatus.ACTIVE }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.changeStatus).not.toHaveBeenCalled();
    });

    it('blocks READY_FOR_SALE while a drug-withdrawal period is active', async () => {
      repo.findById.mockResolvedValue(buildAnimal({ status: AnimalStatus.ACTIVE }));
      repo.findActiveWithdrawals.mockResolvedValue([
        { withdrawalUntil: new Date(Date.now() + 5 * 86_400_000) },
      ]);
      await expect(
        service.changeStatus('id', { status: AnimalStatus.READY_FOR_SALE }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.changeStatus).not.toHaveBeenCalled();
    });

    it('performs a valid transition and publishes the status-changed event', async () => {
      const animal = buildAnimal({ status: AnimalStatus.ACTIVE });
      repo.findById.mockResolvedValue(animal);
      repo.changeStatus.mockResolvedValue({ ...animal, status: AnimalStatus.QUARANTINE });

      const result = await service.changeStatus('id', { status: AnimalStatus.QUARANTINE });

      expect(repo.changeStatus).toHaveBeenCalledWith('id', AnimalStatus.QUARANTINE, expect.anything());
      expect(events.publish).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(AnimalStatus.QUARANTINE);
    });

    it('allows READY_FOR_SALE when there is no active withdrawal', async () => {
      const animal = buildAnimal({ status: AnimalStatus.ACTIVE });
      repo.findById.mockResolvedValue(animal);
      repo.findActiveWithdrawals.mockResolvedValue([]);
      repo.changeStatus.mockResolvedValue({ ...animal, status: AnimalStatus.READY_FOR_SALE });

      const result = await service.changeStatus('id', { status: AnimalStatus.READY_FOR_SALE });
      expect(result.status).toBe(AnimalStatus.READY_FOR_SALE);
    });
  });

  describe('findOne', () => {
    it('throws 404 when the animal does not exist', async () => {
      repo.findByIdWithRelations.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
