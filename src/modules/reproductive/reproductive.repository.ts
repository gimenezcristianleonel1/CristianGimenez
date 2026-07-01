import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PregnancyStatus,
  ReproductiveCheck,
  ReproductiveEvent,
  ReproEventType,
} from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';

/** Acceso a datos de chequeos reproductivos, acotado por establecimiento (multi-tenant). */
@Injectable()
export class ReproductiveRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ReproductiveCheckCreateInput): Promise<ReproductiveCheck> {
    return this.prisma.reproductiveCheck.create({ data });
  }

  findById(id: string): Promise<ReproductiveCheck | null> {
    return this.prisma.reproductiveCheck.findUnique({ where: { id } });
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

  // --------------------------------------------------- Eventos del ciclo

  createEvent(data: Prisma.ReproductiveEventCreateInput): Promise<ReproductiveEvent> {
    return this.prisma.reproductiveEvent.create({ data });
  }

  findEventById(id: string): Promise<ReproductiveEvent | null> {
    return this.prisma.reproductiveEvent.findUnique({ where: { id } });
  }

  /** Conteo de chequeos por resultado en TODO el establecimiento (para índices). */
  async countChecksByResult(
    establishmentId: string,
  ): Promise<Array<{ result: PregnancyStatus; count: number }>> {
    const rows = await this.prisma.reproductiveCheck.groupBy({
      by: ['result'],
      where: { establishmentId },
      _count: { _all: true },
    });
    return rows.map((r) => ({ result: r.result, count: r._count._all }));
  }

  /** Conteo de eventos por tipo en el establecimiento (servicios/pariciones/destetes). */
  async countEventsByType(
    establishmentId: string,
  ): Promise<Array<{ type: ReproEventType; count: number }>> {
    const rows = await this.prisma.reproductiveEvent.groupBy({
      by: ['type'],
      where: { establishmentId },
      _count: { _all: true },
    });
    return rows.map((r) => ({ type: r.type, count: r._count._all }));
  }

  /** Chequeos (tacto/ecografía) de un animal, más recientes primero. */
  checksByAnimal(establishmentId: string, animalId: string): Promise<ReproductiveCheck[]> {
    return this.prisma.reproductiveCheck.findMany({
      where: { establishmentId, animalId },
      orderBy: { date: 'desc' },
    });
  }

  /** Eventos (servicio/parición/destete) de un animal, más recientes primero. */
  eventsByAnimal(establishmentId: string, animalId: string): Promise<ReproductiveEvent[]> {
    return this.prisma.reproductiveEvent.findMany({
      where: { establishmentId, animalId },
      orderBy: { date: 'desc' },
    });
  }

  /** Descendencia de un animal (hijos por vía materna o paterna), del establecimiento. */
  offspringOf(establishmentId: string, animalId: string) {
    return this.prisma.animal.findMany({
      where: {
        establishmentId,
        OR: [{ motherId: animalId }, { fatherId: animalId }],
      },
      orderBy: { birthDate: 'desc' },
      select: { id: true, tagId: true, sex: true, birthDate: true, status: true },
    });
  }
}
