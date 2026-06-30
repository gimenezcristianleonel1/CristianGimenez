import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HealthEventType } from '@prisma/client';
import { IEventPublisher } from '@core/domain/events/event-publisher.interface';
import { AnimalsRepository } from '@modules/animals/animals.repository';
import { SanitaryService } from './sanitary.service';
import { SanitaryRepository } from './sanitary.repository';

const DAY = 86_400_000;
const EST = 'est-1';

describe('SanitaryService', () => {
  let service: SanitaryService;
  let repo: { create: jest.Mock; findByAnimal: jest.Mock; findActiveWithdrawals: jest.Mock };
  let animals: { findById: jest.Mock };
  let events: { publish: jest.Mock; publishAll: jest.Mock };

  beforeEach(() => {
    repo = { create: jest.fn(), findByAnimal: jest.fn(), findActiveWithdrawals: jest.fn() };
    animals = { findById: jest.fn().mockResolvedValue({ id: 'a1', establishmentId: EST }) };
    events = { publish: jest.fn(), publishAll: jest.fn() };
    service = new SanitaryService(
      repo as unknown as SanitaryRepository,
      animals as unknown as AnimalsRepository,
      events as unknown as IEventPublisher,
    );
  });

  it('requires medication for a VACCINATION event', async () => {
    await expect(
      service.createForAnimal(EST, 'a1', { eventType: HealthEventType.VACCINATION }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('computes withdrawalUntil as appliedAt + withdrawalDays', async () => {
    repo.create.mockImplementation((data) => Promise.resolve(data));
    const appliedAt = '2026-01-01T00:00:00.000Z';

    await service.createForAnimal(EST, 'a1', {
      eventType: HealthEventType.TREATMENT,
      medication: 'Oxitetraciclina',
      dosage: '10ml',
      appliedAt,
      withdrawalDays: 21,
    });

    const persisted = repo.create.mock.calls[0][0];
    const expected = new Date(new Date(appliedAt).getTime() + 21 * DAY);
    expect(persisted.withdrawalUntil.getTime()).toBe(expected.getTime());
    expect(events.publish).toHaveBeenCalledTimes(1);
  });

  it('leaves withdrawalUntil null when there is no withdrawal period', async () => {
    repo.create.mockImplementation((data) => Promise.resolve(data));
    await service.createForAnimal(EST, 'a1', {
      eventType: HealthEventType.CHECKUP,
      withdrawalDays: 0,
    });
    expect(repo.create.mock.calls[0][0].withdrawalUntil).toBeNull();
  });

  it('reports an active withdrawal status', async () => {
    repo.findActiveWithdrawals.mockResolvedValue([
      { withdrawalUntil: new Date(Date.now() + 3 * DAY) },
    ]);
    const status = await service.getWithdrawalStatus(EST, 'a1');
    expect(status.underWithdrawal).toBe(true);
    expect(status.activeRecords).toBe(1);
  });

  it('throws 404 when the animal does not exist', async () => {
    animals.findById.mockResolvedValue(null);
    await expect(
      service.createForAnimal(EST, 'missing', {
        eventType: HealthEventType.CHECKUP,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
