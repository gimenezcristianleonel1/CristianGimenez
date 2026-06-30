import { Injectable } from '@nestjs/common';
import { HealthRecord, Prisma } from '@prisma/client';
import { IDomainEvent } from '@core/domain/events/domain-event.base';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { toOutboxRow } from '@infrastructure/events/outbox.mapper';

@Injectable()
export class SanitaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Append a health record and persist its Domain Event atomically. */
  create(
    data: Prisma.HealthRecordUncheckedCreateInput,
    event: IDomainEvent,
  ): Promise<HealthRecord> {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.healthRecord.create({ data });
      await tx.outboxEvent.createMany({ data: [toOutboxRow(event)] });
      return record;
    });
  }

  findByAnimal(animalId: string): Promise<HealthRecord[]> {
    return this.prisma.healthRecord.findMany({
      where: { animalId },
      orderBy: { appliedAt: 'desc' },
    });
  }

  findActiveWithdrawals(animalId: string, at: Date = new Date()): Promise<HealthRecord[]> {
    return this.prisma.healthRecord.findMany({
      where: { animalId, withdrawalUntil: { gt: at } },
      orderBy: { withdrawalUntil: 'desc' },
    });
  }
}
