import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

/** Acceso a datos de reportes, siempre acotado por establecimiento (multi-tenant). */
@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Todos los potreros del establecimiento con sus residentes ACTIVOS actuales
   * y el último pesaje de cada uno (para el cálculo de carga en EV/Ha).
   */
  findPotrerosWithResidents(establishmentId: string) {
    return this.prisma.location.findMany({
      where: { establishmentId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        areaHectares: true,
        currentResidents: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            sex: true,
            birthDate: true,
            initialWeightKg: true,
            metadata: true,
            weightHistory: {
              orderBy: { measuredAt: 'desc' },
              take: 1,
              select: { weightKg: true },
            },
          },
        },
      },
    });
  }
}
