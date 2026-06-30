import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HealthEventType, HealthRecord, Prisma } from '@prisma/client';
import { EVENT_PUBLISHER, IEventPublisher } from '@core/domain/events/event-publisher.interface';
import { AnimalsRepository } from '@modules/animals/animals.repository';
import { SanitaryRepository } from './sanitary.repository';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';
import { HealthEventRecordedEvent } from './events/health.events';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Event types that must specify the applied medication/product. */
const MEDICATION_REQUIRED: HealthEventType[] = [
  HealthEventType.VACCINATION,
  HealthEventType.DEWORMING,
  HealthEventType.TREATMENT,
];

export interface WithdrawalStatus {
  animalId: string;
  underWithdrawal: boolean;
  withdrawalUntil: string | null;
  activeRecords: number;
}

@Injectable()
export class SanitaryService {
  constructor(
    private readonly repo: SanitaryRepository,
    private readonly animals: AnimalsRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: IEventPublisher,
  ) {}

  async createForAnimal(animalId: string, dto: CreateHealthRecordDto): Promise<HealthRecord> {
    await this.assertAnimalExists(animalId);

    if (MEDICATION_REQUIRED.includes(dto.eventType) && !dto.medication) {
      throw new BadRequestException(
        `medication is required for event type ${dto.eventType}`,
      );
    }

    const appliedAt = dto.appliedAt ? new Date(dto.appliedAt) : new Date();
    const withdrawalDays = dto.withdrawalDays ?? 0;
    const withdrawalUntil =
      withdrawalDays > 0 ? new Date(appliedAt.getTime() + withdrawalDays * MS_PER_DAY) : null;

    const data: Prisma.HealthRecordUncheckedCreateInput = {
      ...(dto.id ? { id: dto.id } : {}),
      animalId,
      eventType: dto.eventType,
      medication: dto.medication ?? null,
      dosage: dto.dosage ?? null,
      appliedAt,
      withdrawalDays,
      withdrawalUntil,
      notes: dto.notes ?? null,
      metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
    };

    const event = new HealthEventRecordedEvent(animalId, {
      eventType: dto.eventType,
      medication: dto.medication ?? null,
      appliedAt: appliedAt.toISOString(),
      withdrawalUntil: withdrawalUntil ? withdrawalUntil.toISOString() : null,
    });

    const record = await this.repo.create(data, event);
    await this.events.publish(event);
    return record;
  }

  async findForAnimal(animalId: string): Promise<HealthRecord[]> {
    await this.assertAnimalExists(animalId);
    return this.repo.findByAnimal(animalId);
  }

  /** Whether the animal is currently within any drug-withdrawal period. */
  async getWithdrawalStatus(animalId: string): Promise<WithdrawalStatus> {
    await this.assertAnimalExists(animalId);
    const active = await this.repo.findActiveWithdrawals(animalId);
    return {
      animalId,
      underWithdrawal: active.length > 0,
      withdrawalUntil: active[0]?.withdrawalUntil?.toISOString() ?? null,
      activeRecords: active.length,
    };
  }

  private async assertAnimalExists(animalId: string): Promise<void> {
    const animal = await this.animals.findById(animalId);
    if (!animal) {
      throw new NotFoundException(`Animal ${animalId} not found`);
    }
  }
}
