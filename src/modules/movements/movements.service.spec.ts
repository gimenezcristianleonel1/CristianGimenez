import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AnimalStatus } from '@prisma/client';
import { IEventPublisher } from '@core/domain/events/event-publisher.interface';
import { AnimalsRepository } from '@modules/animals/animals.repository';
import { LocationsRepository } from '@modules/locations/locations.repository';
import { MovementsService } from './movements.service';
import { MovementsRepository } from './movements.repository';

describe('MovementsService', () => {
  let service: MovementsService;
  let repo: { move: jest.Mock; findByAnimal: jest.Mock };
  let animals: { findById: jest.Mock };
  let locations: { findById: jest.Mock; countResidents: jest.Mock };
  let events: { publish: jest.Mock; publishAll: jest.Mock };

  const EST = 'est-1';
  const animal = {
    id: 'a1',
    tagId: 'AR-1',
    status: AnimalStatus.ACTIVE,
    currentLocationId: 'loc-from',
    establishmentId: EST,
  };

  beforeEach(() => {
    repo = { move: jest.fn().mockResolvedValue({ id: 'm1' }), findByAnimal: jest.fn() };
    animals = { findById: jest.fn().mockResolvedValue(animal) };
    locations = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'loc-to', name: 'Dest', capacity: 10, establishmentId: EST }),
      countResidents: jest.fn().mockResolvedValue(0),
    };
    events = { publish: jest.fn(), publishAll: jest.fn() };
    service = new MovementsService(
      repo as unknown as MovementsRepository,
      animals as unknown as AnimalsRepository,
      locations as unknown as LocationsRepository,
      events as unknown as IEventPublisher,
    );
  });

  it('moves the animal and publishes the moved event', async () => {
    await service.moveAnimal(EST, 'a1', { toLocationId: 'loc-to' });
    expect(repo.move).toHaveBeenCalledTimes(1);
    const data = repo.move.mock.calls[0][0];
    expect(data.fromLocationId).toBe('loc-from');
    expect(data.toLocationId).toBe('loc-to');
    expect(events.publish).toHaveBeenCalledTimes(1);
  });

  it('rejects moving into a destination at full capacity', async () => {
    locations.countResidents.mockResolvedValue(10); // capacity == 10
    await expect(service.moveAnimal(EST, 'a1', { toLocationId: 'loc-to' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.move).not.toHaveBeenCalled();
  });

  it('rejects moving to the same location the animal is already in', async () => {
    await expect(service.moveAnimal(EST, 'a1', { toLocationId: 'loc-from' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects moving a terminal (SOLD/DECEASED) animal', async () => {
    animals.findById.mockResolvedValue({ ...animal, status: AnimalStatus.SOLD });
    await expect(service.moveAnimal(EST, 'a1', { toLocationId: 'loc-to' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws 404 when the animal does not exist', async () => {
    animals.findById.mockResolvedValue(null);
    await expect(service.moveAnimal(EST, 'missing', { toLocationId: 'loc-to' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
