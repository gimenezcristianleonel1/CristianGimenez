import { Injectable } from '@nestjs/common';
import { AnimalMovement, Prisma } from '@prisma/client';
import { IDomainEvent } from '@core/domain/events/domain-event.base';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { toOutboxRow } from '@infrastructure/events/outbox.mapper';

@Injectable()
export class MovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically: append the (immutable) movement record, update the animal's
   * current location, and persist the Domain Event to the outbox — all in one
   * transaction so the denormalised `currentLocationId` can never drift from
   * the movement history.
   */
  move(
    data: Prisma.AnimalMovementUncheckedCreateInput,
    event: IDomainEvent,
  ): Promise<AnimalMovement> {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.animalMovement.create({ data });
      await tx.animal.update({
        where: { id: data.animalId },
        data: { currentLocationId: data.toLocationId },
      });
      await tx.outboxEvent.createMany({ data: [toOutboxRow(event)] });
      return movement;
    });
  }

  findByAnimal(animalId: string): Promise<AnimalMovement[]> {
    return this.prisma.animalMovement.findMany({
      where: { animalId },
      orderBy: { movedAt: 'desc' },
    });
  }
}
