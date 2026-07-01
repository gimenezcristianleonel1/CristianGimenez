import { Injectable } from '@nestjs/common';
import { AnimalEvent, Prisma } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';

/** Acceso a datos de la bitácora del animal, acotado por establecimiento. */
@Injectable()
export class AnimalEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AnimalEventCreateInput): Promise<AnimalEvent> {
    return this.prisma.animalEvent.create({ data });
  }

  findById(id: string): Promise<AnimalEvent | null> {
    return this.prisma.animalEvent.findUnique({ where: { id } });
  }

  animalBelongsToEstablishment(animalId: string, establishmentId: string): Promise<boolean> {
    return this.prisma.animal
      .count({ where: { id: animalId, establishmentId } })
      .then((n) => n > 0);
  }

  /** Eventos de un animal, más recientes primero. */
  byAnimal(establishmentId: string, animalId: string): Promise<AnimalEvent[]> {
    return this.prisma.animalEvent.findMany({
      where: { establishmentId, animalId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
