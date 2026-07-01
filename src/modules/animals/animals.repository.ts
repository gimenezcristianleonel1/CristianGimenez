import { Injectable } from '@nestjs/common';
import { Animal, AnimalStatus, Location, Prisma, WeightHistory } from '@prisma/client';
import { IDomainEvent } from '@core/domain/events/domain-event.base';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { toOutboxRow } from '@infrastructure/events/outbox.mapper';

/**
 * Data-access layer for the Animal aggregate.
 * State-changing methods persist their Domain Events to the Outbox within the
 * SAME database transaction (true Transactional Outbox) — guaranteeing the
 * event is never lost nor emitted for a rolled-back change.
 */
@Injectable()
export class AnimalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTagId(establishmentId: string, tagId: string): Promise<Animal | null> {
    return this.prisma.animal.findUnique({
      where: { establishmentId_tagId: { establishmentId, tagId } },
    });
  }

  findById(id: string): Promise<Animal | null> {
    return this.prisma.animal.findUnique({ where: { id } });
  }

  findByIdWithRelations(id: string) {
    return this.prisma.animal.findUnique({
      where: { id },
      include: {
        currentLocation: true,
        mother: { select: { id: true, tagId: true } },
        father: { select: { id: true, tagId: true } },
        weightHistory: { orderBy: { measuredAt: 'desc' }, take: 10 },
      },
    });
  }

  async findMany(
    where: Prisma.AnimalWhereInput,
    skip: number,
    take: number,
  ): Promise<{ items: Animal[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.animal.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.animal.count({ where }),
    ]);
    return { items, total };
  }

  countByLocation(locationId: string): Promise<number> {
    return this.prisma.animal.count({ where: { currentLocationId: locationId } });
  }

  /** Todos los animales de un establecimiento (para exportar). */
  findAllByEstablishment(establishmentId: string): Promise<Animal[]> {
    return this.prisma.animal.findMany({
      where: { establishmentId },
      orderBy: { tagId: 'asc' },
    });
  }

  findLocationById(id: string): Promise<Location | null> {
    return this.prisma.location.findUnique({ where: { id } });
  }

  /** Create an animal and persist its registration event atomically. */
  create(data: Prisma.AnimalCreateInput, event: IDomainEvent): Promise<Animal> {
    return this.prisma.$transaction(async (tx) => {
      const animal = await tx.animal.create({ data });
      await tx.outboxEvent.createMany({ data: [toOutboxRow(event)] });
      return animal;
    });
  }

  update(id: string, data: Prisma.AnimalUpdateInput): Promise<Animal> {
    return this.prisma.animal.update({ where: { id }, data });
  }

  delete(id: string): Promise<Animal> {
    return this.prisma.animal.delete({ where: { id } });
  }

  /** Change status and persist the status-changed event atomically. */
  changeStatus(id: string, status: AnimalStatus, event: IDomainEvent): Promise<Animal> {
    return this.prisma.$transaction(async (tx) => {
      const animal = await tx.animal.update({ where: { id }, data: { status } });
      await tx.outboxEvent.createMany({ data: [toOutboxRow(event)] });
      return animal;
    });
  }

  /** Append a weight measurement and persist the weighed event atomically. */
  addWeight(
    data: Prisma.WeightHistoryUncheckedCreateInput,
    event: IDomainEvent,
  ): Promise<WeightHistory> {
    return this.prisma.$transaction(async (tx) => {
      const weight = await tx.weightHistory.create({ data });
      await tx.outboxEvent.createMany({ data: [toOutboxRow(event)] });
      return weight;
    });
  }

  getWeightHistory(animalId: string): Promise<WeightHistory[]> {
    return this.prisma.weightHistory.findMany({
      where: { animalId },
      orderBy: { measuredAt: 'asc' },
    });
  }

  /**
   * Returns active drug-withdrawal health records (withdrawalUntil in the
   * future) for an animal — used to block "ready for sale" transitions.
   */
  findActiveWithdrawals(animalId: string, at: Date = new Date()) {
    return this.prisma.healthRecord.findMany({
      where: { animalId, withdrawalUntil: { gt: at } },
      orderBy: { withdrawalUntil: 'desc' },
    });
  }
}
