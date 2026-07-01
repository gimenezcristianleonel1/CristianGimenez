import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportsRepository } from './reports.repository';
import { cowEquivalent, EvAnimalInput } from './cow-equivalent';

/** Umbral de carga (EV/Ha) a partir del cual se sugiere revisar sobrepastoreo. */
const OVERLOAD_EV_HA = 1.2;

export interface PotreroCarga {
  id: string;
  nombre: string;
  tipo: string;
  hectareas: number | null;
  totalAnimales: number;
  totalEV: number;
  /** Carga animal real = totalEV / hectáreas. `null` si el potrero no tiene hectáreas. */
  cargaEvHa: number | null;
  alerta: string | null;
}

export interface PotrerosCargaResponse {
  success: true;
  potreros: PotreroCarga[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const toNumber = (d: Prisma.Decimal | null | undefined): number | null =>
  d === null || d === undefined ? null : Number(d);

/** Todas las operaciones se acotan al establishmentId del usuario autenticado. */
@Injectable()
export class ReportsService {
  constructor(private readonly repo: ReportsRepository) {}

  /**
   * Carga animal real de cada potrero, expresada en Equivalente Vaca por hectárea.
   * Suma el EV de cada animal residente (según categoría inferida) y lo divide
   * por la superficie del potrero.
   */
  async potrerosCarga(establishmentId: string): Promise<PotrerosCargaResponse> {
    const potreros = await this.repo.findPotrerosWithResidents(establishmentId);

    const result: PotreroCarga[] = potreros.map((p) => {
      const totalEV = p.currentResidents.reduce((acc, animal) => {
        const input: EvAnimalInput = {
          sex: animal.sex,
          birthDate: animal.birthDate,
          weightKg: toNumber(animal.weightHistory[0]?.weightKg ?? animal.initialWeightKg),
          metadata: animal.metadata as Record<string, unknown> | null,
        };
        return acc + cowEquivalent(input);
      }, 0);

      const hectareas = toNumber(p.areaHectares);
      const cargaEvHa = hectareas && hectareas > 0 ? round2(totalEV / hectareas) : null;

      let alerta: string | null = null;
      if (hectareas === null || hectareas <= 0) {
        alerta = 'El potrero no tiene hectáreas cargadas: no se puede calcular la carga (EV/Ha).';
      } else if (cargaEvHa !== null && cargaEvHa > OVERLOAD_EV_HA) {
        alerta = `Carga alta (${cargaEvHa} EV/Ha): revisá el riesgo de sobrepastoreo.`;
      }

      return {
        id: p.id,
        nombre: p.name,
        tipo: p.type,
        hectareas,
        totalAnimales: p.currentResidents.length,
        totalEV: round2(totalEV),
        cargaEvHa,
        alerta,
      };
    });

    return { success: true, potreros: result };
  }
}
