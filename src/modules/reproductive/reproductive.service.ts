import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PregnancyStatus,
  Prisma,
  ReproductiveCheck,
  ReproductiveEvent,
  ReproEventType,
} from '@prisma/client';
import { ReproductiveRepository } from './reproductive.repository';
import { CreateReproductiveCheckDto } from './dto/create-reproductive-check.dto';
import { CreateReproductiveEventDto } from './dto/create-reproductive-event.dto';

/** Si el % de vacías supera este umbral, se sugiere una alerta al productor. */
const EMPTY_ALERT_THRESHOLD = 15;

export interface ReproductiveIndices {
  success: true;
  servicios: number;
  prenadas: number;
  vacias: number;
  pariciones: number;
  destetes: number;
  /** % preñez sobre servicios (o sobre tactos si no hay servicios cargados). */
  porcentajePrenez: number;
  porcentajeParicion: number;
  /** Índice clave: terneros destetados / vientres servidos. */
  porcentajeDestete: number;
  /** Pérdida entre preñez y destete (merma). */
  merma: number;
  /** Denominador usado para los porcentajes ("servicios" o "tactos"). */
  base: 'servicios' | 'tactos';
  alerta: string | null;
}

export interface OffspringItem {
  id: string;
  tagId: string;
  sex: string;
  birthDate: string;
  status: string;
}
export interface MaternityResponse {
  success: true;
  animalId: string;
  offspring: OffspringItem[];
  totals: {
    hijos: number;
    machos: number;
    hembras: number;
    activos: number;
    servicios: number;
    pariciones: number;
    destetes: number;
    vecesPrenada: number;
  };
}

export type TimelineKind = 'SERVICIO' | 'TACTO' | 'ECOGRAFIA' | 'PARICION' | 'DESTETE';
export interface TimelineItem {
  date: string;
  kind: TimelineKind;
  detail: string;
}
export interface AnimalTimeline {
  success: true;
  animalId: string;
  items: TimelineItem[];
}

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
    // Idempotencia para el sync offline: un reintento con el mismo id de cliente
    // devuelve el chequeo ya guardado (no falla ni duplica, la cola no se traba).
    if (dto.id) {
      const existing = await this.repo.findById(dto.id);
      if (existing) return this.ownedOrConflict(existing, establishmentId);
    }

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

    try {
      return await this.repo.create(data);
    } catch (err) {
      if (dto.id && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.repo.findById(dto.id);
        if (existing) return this.ownedOrConflict(existing, establishmentId);
      }
      throw err;
    }
  }

  /** Devuelve el chequeo si es del establecimiento; si no, es una colisión ajena. */
  private ownedOrConflict(check: ReproductiveCheck, establishmentId: string): ReproductiveCheck {
    if (check.establishmentId !== establishmentId) {
      throw new ConflictException(`ReproductiveCheck ${check.id} already exists`);
    }
    return check;
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

  // --------------------------------------------------- Eventos del ciclo

  /** Registra un evento del ciclo (servicio/parición/destete), idempotente y tenant-scoped. */
  async createEvent(
    establishmentId: string,
    dto: CreateReproductiveEventDto,
  ): Promise<ReproductiveEvent> {
    if (dto.id) {
      const existing = await this.repo.findEventById(dto.id);
      if (existing) return this.eventOwnedOrConflict(existing, establishmentId);
    }

    const animalOk = await this.repo.animalBelongsToEstablishment(dto.animalId, establishmentId);
    if (!animalOk) throw new NotFoundException(`Animal ${dto.animalId} not found`);

    const data: Prisma.ReproductiveEventCreateInput = {
      ...(dto.id ? { id: dto.id } : {}),
      type: dto.type,
      observations: dto.observations ?? null,
      sireTagId: dto.sireTagId ?? null,
      offspringTagId: dto.offspringTagId ?? null,
      ...(dto.date ? { date: new Date(dto.date) } : {}),
      animal: { connect: { id: dto.animalId } },
      establishment: { connect: { id: establishmentId } },
    };

    try {
      return await this.repo.createEvent(data);
    } catch (err) {
      if (dto.id && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.repo.findEventById(dto.id);
        if (existing) return this.eventOwnedOrConflict(existing, establishmentId);
      }
      throw err;
    }
  }

  private eventOwnedOrConflict(
    event: ReproductiveEvent,
    establishmentId: string,
  ): ReproductiveEvent {
    if (event.establishmentId !== establishmentId) {
      throw new ConflictException(`ReproductiveEvent ${event.id} already exists`);
    }
    return event;
  }

  /**
   * Índices reproductivos automáticos del establecimiento. Denominador preferido:
   * los servicios (vientres entorados); si no hay servicios cargados, cae a los
   * tactos (preñadas + vacías) para no dar 0.
   */
  async indices(establishmentId: string): Promise<ReproductiveIndices> {
    const [checks, events] = await Promise.all([
      this.repo.countChecksByResult(establishmentId),
      this.repo.countEventsByType(establishmentId),
    ]);

    const prenadas = checks.find((c) => c.result === PregnancyStatus.PRENADA)?.count ?? 0;
    const vacias = checks.find((c) => c.result === PregnancyStatus.VACIA)?.count ?? 0;
    const servicios = events.find((e) => e.type === ReproEventType.SERVICIO)?.count ?? 0;
    const pariciones = events.find((e) => e.type === ReproEventType.PARICION)?.count ?? 0;
    const destetes = events.find((e) => e.type === ReproEventType.DESTETE)?.count ?? 0;

    const base: 'servicios' | 'tactos' = servicios > 0 ? 'servicios' : 'tactos';
    const denom = servicios > 0 ? servicios : prenadas + vacias;

    const porcentajePrenez = denom > 0 ? round1((prenadas / denom) * 100) : 0;
    const porcentajeParicion = denom > 0 ? round1((pariciones / denom) * 100) : 0;
    const porcentajeDestete = denom > 0 ? round1((destetes / denom) * 100) : 0;
    const merma = round1(porcentajePrenez - porcentajeDestete);

    let alerta: string | null = null;
    if (denom > 0 && merma > 10) {
      alerta = `Merma de ${merma} puntos entre preñez y destete: revisá pérdidas por aborto, mortandad neonatal o del ternero.`;
    }

    return {
      success: true,
      servicios,
      prenadas,
      vacias,
      pariciones,
      destetes,
      porcentajePrenez,
      porcentajeParicion,
      porcentajeDestete,
      merma,
      base,
      alerta,
    };
  }

  /** Historia reproductiva de un animal: eventos + chequeos en una sola línea de tiempo. */
  async timeline(establishmentId: string, animalId: string): Promise<AnimalTimeline> {
    const animalOk = await this.repo.animalBelongsToEstablishment(animalId, establishmentId);
    if (!animalOk) throw new NotFoundException(`Animal ${animalId} not found`);

    const [events, checks] = await Promise.all([
      this.repo.eventsByAnimal(establishmentId, animalId),
      this.repo.checksByAnimal(establishmentId, animalId),
    ]);

    const items: TimelineItem[] = [
      ...events.map((e) => ({
        date: e.date.toISOString(),
        kind: e.type as TimelineKind,
        detail: this.eventDetail(e),
      })),
      ...checks.map((c) => ({
        date: c.date.toISOString(),
        kind: c.type as TimelineKind,
        detail: c.result === PregnancyStatus.PRENADA ? 'Preñada' : 'Vacía',
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return { success: true, animalId, items };
  }

  private eventDetail(e: ReproductiveEvent): string {
    if (e.type === ReproEventType.SERVICIO) return e.sireTagId ? `Toro ${e.sireTagId}` : 'Servicio';
    if (e.type === ReproEventType.PARICION) {
      return e.offspringTagId ? `Cría ${e.offspringTagId}` : 'Parición';
    }
    return 'Destete';
  }

  /**
   * Hoja de vida reproductiva de una madre (o padre): su descendencia por
   * genealogía (caravana única) más los totales del ciclo.
   */
  async maternity(establishmentId: string, animalId: string): Promise<MaternityResponse> {
    const animalOk = await this.repo.animalBelongsToEstablishment(animalId, establishmentId);
    if (!animalOk) throw new NotFoundException(`Animal ${animalId} not found`);

    const [offspring, events, checks] = await Promise.all([
      this.repo.offspringOf(establishmentId, animalId),
      this.repo.eventsByAnimal(establishmentId, animalId),
      this.repo.checksByAnimal(establishmentId, animalId),
    ]);

    return {
      success: true,
      animalId,
      offspring: offspring.map((o) => ({
        id: o.id,
        tagId: o.tagId,
        sex: o.sex,
        birthDate: o.birthDate.toISOString(),
        status: o.status,
      })),
      totals: {
        hijos: offspring.length,
        machos: offspring.filter((o) => o.sex === 'MALE').length,
        hembras: offspring.filter((o) => o.sex === 'FEMALE').length,
        activos: offspring.filter((o) => o.status === 'ACTIVE').length,
        servicios: events.filter((e) => e.type === ReproEventType.SERVICIO).length,
        pariciones: events.filter((e) => e.type === ReproEventType.PARICION).length,
        destetes: events.filter((e) => e.type === ReproEventType.DESTETE).length,
        vecesPrenada: checks.filter((c) => c.result === PregnancyStatus.PRENADA).length,
      },
    };
  }
}
