import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Animal, AnimalStatus, Prisma, Sex, WeightHistory, WeightSource } from '@prisma/client';
import {
  PREDICTIVE_ENGINE,
  PredictiveEngine,
  WeightProjectionResult,
} from '@core/ai/predictive-engine.interface';
import { EVENT_PUBLISHER, IEventPublisher } from '@core/domain/events/event-publisher.interface';
import { AnimalsRepository } from './animals.repository';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { QueryAnimalsDto } from './dto/query-animals.dto';
import { AddWeightDto } from './dto/add-weight.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import {
  AnimalRegisteredEvent,
  AnimalStatusChangedEvent,
  AnimalWeighedEvent,
} from './events/animal.events';

/** Default projection horizons (days) for the GDP/weight forecast. */
const PROJECTION_HORIZONS = [30, 60, 90];

/** Allowed status transitions. SOLD and DECEASED are terminal. */
const STATUS_TRANSITIONS: Record<AnimalStatus, AnimalStatus[]> = {
  ACTIVE: [AnimalStatus.QUARANTINE, AnimalStatus.READY_FOR_SALE, AnimalStatus.SOLD, AnimalStatus.DECEASED],
  QUARANTINE: [AnimalStatus.ACTIVE, AnimalStatus.READY_FOR_SALE, AnimalStatus.SOLD, AnimalStatus.DECEASED],
  READY_FOR_SALE: [AnimalStatus.ACTIVE, AnimalStatus.QUARANTINE, AnimalStatus.SOLD, AnimalStatus.DECEASED],
  SOLD: [],
  DECEASED: [],
};

/** Statuses that imply the animal could go to consumption / be sold. */
const SALE_STATUSES: AnimalStatus[] = [AnimalStatus.READY_FOR_SALE, AnimalStatus.SOLD];

@Injectable()
export class AnimalsService {
  constructor(
    private readonly repo: AnimalsRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: IEventPublisher,
    @Inject(PREDICTIVE_ENGINE) private readonly predictiveEngine: PredictiveEngine,
  ) {}

  // ---------------------------------------------------------------- CRUD

  async create(dto: CreateAnimalDto): Promise<Animal> {
    // Unique caravan/tag.
    if (await this.repo.findByTagId(dto.tagId)) {
      throw new ConflictException(`An animal with tagId "${dto.tagId}" already exists`);
    }

    await this.assertParent(dto.motherId, Sex.FEMALE, 'mother');
    await this.assertParent(dto.fatherId, Sex.MALE, 'father');
    await this.assertLocationHasCapacity(dto.currentLocationId);

    // Generate the id up-front so the Domain Event carries the real aggregate
    // id and can be written to the outbox within the same insert transaction.
    const id = randomUUID();
    const data: Prisma.AnimalCreateInput = {
      id,
      tagId: dto.tagId,
      species: dto.species,
      breed: dto.breed,
      sex: dto.sex,
      birthDate: new Date(dto.birthDate),
      initialWeightKg: new Prisma.Decimal(dto.initialWeightKg),
      metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      ...(dto.motherId ? { mother: { connect: { id: dto.motherId } } } : {}),
      ...(dto.fatherId ? { father: { connect: { id: dto.fatherId } } } : {}),
      ...(dto.currentLocationId
        ? { currentLocation: { connect: { id: dto.currentLocationId } } }
        : {}),
    };

    const event = new AnimalRegisteredEvent(id, {
      tagId: dto.tagId,
      species: dto.species,
      breed: dto.breed,
      sex: dto.sex,
      status: AnimalStatus.ACTIVE,
    });

    // The repository writes the outbox row in the same transaction as the insert.
    const animal = await this.repo.create(data, event);
    await this.events.publish(event);
    return animal;
  }

  async findAll(query: QueryAnimalsDto): Promise<{
    data: Animal[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const where: Prisma.AnimalWhereInput = {
      ...(query.species ? { species: query.species } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.locationId ? { currentLocationId: query.locationId } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const { items, total } = await this.repo.findMany(where, skip, query.limit);
    return {
      data: items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async findOne(id: string) {
    const animal = await this.repo.findByIdWithRelations(id);
    if (!animal) {
      throw new NotFoundException(`Animal ${id} not found`);
    }
    return animal;
  }

  async update(id: string, dto: UpdateAnimalDto): Promise<Animal> {
    const animal = await this.getExistingOrThrow(id);

    if (dto.motherId !== undefined) {
      if (dto.motherId === id) throw new BadRequestException('An animal cannot be its own mother');
      await this.assertParent(dto.motherId, Sex.FEMALE, 'mother');
    }
    if (dto.fatherId !== undefined) {
      if (dto.fatherId === id) throw new BadRequestException('An animal cannot be its own father');
      await this.assertParent(dto.fatherId, Sex.MALE, 'father');
    }

    const data: Prisma.AnimalUpdateInput = {
      ...(dto.breed !== undefined ? { breed: dto.breed } : {}),
      ...(dto.motherId !== undefined ? { mother: { connect: { id: dto.motherId } } } : {}),
      ...(dto.fatherId !== undefined ? { father: { connect: { id: dto.fatherId } } } : {}),
      ...(dto.metadata !== undefined
        ? {
            metadata: {
              ...(animal.metadata as Record<string, unknown>),
              ...dto.metadata,
            } as Prisma.InputJsonValue,
          }
        : {}),
    };

    return this.repo.update(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.getExistingOrThrow(id);
    await this.repo.delete(id);
  }

  // ------------------------------------------------------------- Status

  async changeStatus(id: string, dto: ChangeStatusDto): Promise<Animal> {
    const animal = await this.getExistingOrThrow(id);
    const from = animal.status;
    const to = dto.status;

    if (from === to) {
      return animal;
    }

    if (!STATUS_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(`Invalid status transition: ${from} -> ${to}`);
    }

    // Predictive business rule: an animal under any drug-withdrawal period
    // cannot be marked ready for sale / sold (food-safety guard).
    if (SALE_STATUSES.includes(to)) {
      const active = await this.repo.findActiveWithdrawals(id);
      if (active.length > 0) {
        const until = active[0].withdrawalUntil;
        throw new ConflictException(
          `Animal ${animal.tagId} is within a drug-withdrawal period until ` +
            `${until?.toISOString()} and cannot be marked ${to}`,
        );
      }
    }

    const event = new AnimalStatusChangedEvent(id, { from, to });
    const updated = await this.repo.changeStatus(id, to, event);
    await this.events.publish(event);
    return updated;
  }

  // ------------------------------------------------------------- Weights

  async addWeight(id: string, dto: AddWeightDto): Promise<WeightHistory> {
    await this.getExistingOrThrow(id);
    const measuredAt = dto.measuredAt ? new Date(dto.measuredAt) : new Date();
    const source = dto.source ?? WeightSource.MANUAL;

    const data: Prisma.WeightHistoryUncheckedCreateInput = {
      animalId: id,
      weightKg: new Prisma.Decimal(dto.weightKg),
      measuredAt,
      source,
      metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
    };

    const event = new AnimalWeighedEvent(id, {
      weightKg: dto.weightKg,
      measuredAt: measuredAt.toISOString(),
      source,
    });
    const weight = await this.repo.addWeight(data, event);
    await this.events.publish(event);
    return weight;
  }

  getWeightHistory(id: string): Promise<WeightHistory[]> {
    return this.getExistingOrThrow(id).then(() => this.repo.getWeightHistory(id));
  }

  /**
   * Projects the animal's future weight (GDP + 30/60/90 days) using the
   * configured PredictiveEngine over its full weight time-series.
   */
  async getWeightProjection(id: string): Promise<WeightProjectionResult> {
    const animal = await this.getExistingOrThrow(id);
    const history = await this.repo.getWeightHistory(id);

    const samples = history.map((h) => ({
      weightKg: Number(h.weightKg),
      measuredAt: h.measuredAt,
    }));

    return this.predictiveEngine.projectWeight({
      animalId: id,
      breed: animal.breed,
      samples,
      horizonsInDays: PROJECTION_HORIZONS,
    });
  }

  // ------------------------------------------------------------- Helpers

  private async getExistingOrThrow(id: string): Promise<Animal> {
    const animal = await this.repo.findById(id);
    if (!animal) {
      throw new NotFoundException(`Animal ${id} not found`);
    }
    return animal;
  }

  private async assertParent(
    parentId: string | undefined,
    expectedSex: Sex,
    role: 'mother' | 'father',
  ): Promise<void> {
    if (!parentId) {
      return;
    }
    const parent = await this.repo.findById(parentId);
    if (!parent) {
      throw new BadRequestException(`The ${role} (${parentId}) does not exist`);
    }
    if (parent.sex !== expectedSex) {
      throw new BadRequestException(`The ${role} must be ${expectedSex.toLowerCase()}`);
    }
  }

  private async assertLocationHasCapacity(locationId: string | undefined): Promise<void> {
    if (!locationId) {
      return;
    }
    const location = await this.repo.findLocationById(locationId);
    if (!location) {
      throw new BadRequestException(`Location ${locationId} does not exist`);
    }
    if (location.capacity !== null) {
      const current = await this.repo.countByLocation(locationId);
      if (current >= location.capacity) {
        throw new ConflictException(
          `Location "${location.name}" is at full capacity (${location.capacity})`,
        );
      }
    }
  }
}
