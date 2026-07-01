import { Injectable } from '@nestjs/common';
import { Prisma, PregnancyStatus, ReproductiveCheck } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';

/** Acceso a datos de chequeos reproductivos, acotado por establecimiento (multi-tenant). */
@Injectable()
export class ReproductiveRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ReproductiveCheckCreateInput): Promise<ReproductiveCheck> {
    return this.prisma.reproductiveCheck.create({ data });
  }

  /** ¿Existe el animal y pertenece al establecimiento? (aislamiento multi-tenant). */
  animalBelongsToEstablishment(animalId: string, establishmentId: string): Promise<boolean> {
    return this.prisma.animal
      .count({ where: { id: animalId, establishmentId } })
      .then((n) => n > 0);
  }

  /** ¿Existe el potrero y pertenece al establecimiento? */
  locationBelongsToEstablishment(potreroId: string, establishmentId: string): Promise<boolean> {
    return this.prisma.location
      .count({ where: { id: potreroId, establishmentId } })
      .then((n) => n > 0);
  }

  /** Conteo de resultados (PRENADA / VACIA) para un potrero del establecimiento. */
  async countByResultForPotrero(
    establishmentId: string,
    potreroId: string,
  ): Promise<Array<{ result: PregnancyStatus; count: number }>> {
    const rows = await this.prisma.reproductiveCheck.groupBy({
      by: ['result'],
      where: { establishmentId, potreroId },
      _count: { _all: true },
    });
    return rows.map((r) => ({ result: r.result, count: r._count._all }));
  }
}
