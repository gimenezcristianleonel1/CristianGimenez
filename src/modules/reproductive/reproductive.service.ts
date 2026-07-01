import { Injectable, NotFoundException } from '@nestjs/common';
import { PregnancyStatus, Prisma, ReproductiveCheck } from '@prisma/client';
import { ReproductiveRepository } from './reproductive.repository';
import { CreateReproductiveCheckDto } from './dto/create-reproductive-check.dto';

/** Si el % de vacías supera este umbral, se sugiere una alerta al productor. */
const EMPTY_ALERT_THRESHOLD = 15;

export interface ReproductiveSummary {
  success: true;
  potreroId: string;
  totalControlados: number;
  prenadas: number;
  vacias: number;
  porcentajePrenez: number;
  porcentajeVacias: number;
  alerta: string | null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Todas las operaciones se acotan al establishmentId del usuario autenticado. */
@Injectable()
export class ReproductiveService {
  constructor(private readonly repo: ReproductiveRepository) {}

  /** Registra un chequeo individual, validando que animal y potrero sean del establecimiento. */
  async create(establishmentId: string, dto: CreateReproductiveCheckDto): Promise<ReproductiveCheck> {
    const [animalOk, potreroOk] = await Promise.all([
      this.repo.animalBelongsToEstablishment(dto.animalId, establishmentId),
      this.repo.locationBelongsToEstablishment(dto.potreroId, establishmentId),
    ]);
    if (!animalOk) throw new NotFoundException(`Animal ${dto.animalId} not found`);
    if (!potreroOk) throw new NotFoundException(`Potrero ${dto.potreroId} not found`);

    const data: Prisma.ReproductiveCheckCreateInput = {
      ...(dto.id ? { id: dto.id } : {}),
      type: dto.type,
      result: dto.result,
      observations: dto.observations ?? null,
      ...(dto.date ? { date: new Date(dto.date) } : {}),
      animal: { connect: { id: dto.animalId } },
      potreroId: dto.potreroId,
      establishment: { connect: { id: establishmentId } },
    };
    return this.repo.create(data);
  }

  /**
   * Cierre de trabajo: indicadores del lote (potrero) evaluado. Calcula de forma
   * dinámica total controlados, preñadas/vacías y sus porcentajes, con alerta
   * si el % de vacías supera el umbral.
   */
  async summary(establishmentId: string, potreroId: string): Promise<ReproductiveSummary> {
    const grouped = await this.repo.countByResultForPotrero(establishmentId, potreroId);

    const prenadas = grouped.find((g) => g.result === PregnancyStatus.PRENADA)?.count ?? 0;
    const vacias = grouped.find((g) => g.result === PregnancyStatus.VACIA)?.count ?? 0;
    const totalControlados = prenadas + vacias;

    const porcentajePrenez = totalControlados > 0 ? round1((prenadas / totalControlados) * 100) : 0;
    const porcentajeVacias = totalControlados > 0 ? round1((vacias / totalControlados) * 100) : 0;

    const alerta =
      porcentajeVacias > EMPTY_ALERT_THRESHOLD
        ? `Atención: ${porcentajeVacias}% de vacías (supera el ${EMPTY_ALERT_THRESHOLD}%). ` +
          'Conviene revisar el estado corporal, la sanidad y el manejo nutricional del rodeo.'
        : null;

    return {
      success: true,
      potreroId,
      totalControlados,
      prenadas,
      vacias,
      porcentajePrenez,
      porcentajeVacias,
      alerta,
    };
  }
}
