import {
  AnimalEventType,
  CheckType,
  HealthEventType,
  PregnancyStatus,
  Prisma,
  ReproEventType,
} from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';

/**
 * Registro DECLARATIVO del motor de eventos.
 *
 *  - `EVENT_TYPE_TO_ENUM` mapea el eventType libre de la IA al enum de la
 *    bitácora (`AnimalEvent.type`). Lo desconocido cae en `OTRO`, con el tipo
 *    real preservado en el JSONB → registrar acciones NUEVAS no requiere código.
 *
 *  - `EFFECT_HANDLERS` es un diccionario `eventType → efecto`. Solo las acciones
 *    que MUTAN estado (o hacen un append especializado) tienen una entrada acá.
 *    Agregar una acción con efecto = agregar una línea, sin `switch`.
 */

// ---------- Animal objetivo resuelto (con lo necesario para mutar) ----------
export interface TargetAnimal {
  id: string;
  tagId: string;
  currentLocationId: string | null;
  metadata: Record<string, unknown>;
}

export interface EffectContext {
  prisma: PrismaService;
  establishmentId: string;
  /** Animales afectados. Los handlers de creación pueden agregar los nuevos. */
  animals: TargetAnimal[];
  metadata: Record<string, unknown>;
  observations: string | null;
  resolveLocationId: (name: string) => Promise<{ id: string; name: string } | null>;
}

/** Un efecto muta la BD y devuelve el texto para responderle al operario. */
export type EffectHandler = (ctx: EffectContext) => Promise<string>;

// -------------------------- Mapa a enum de bitácora --------------------------
const EVENT_TYPE_TO_ENUM: Record<string, AnimalEventType> = {
  BAJA_MUERTE: 'MUERTE',
  MUERTE: 'MUERTE',
  BAJA: 'EGRESO',
  VENTA: 'EGRESO',
  VENDIDO: 'EGRESO',
  EGRESO: 'EGRESO',
  INGRESO: 'INGRESO',
  NACIMIENTO: 'PARTO',
  PARTO: 'PARTO',
  ABORTO: 'ABORTO',
  TRASLADO: 'CAMBIO_LOTE',
  MOVIMIENTO: 'CAMBIO_LOTE',
  CAMBIO_POTRERO: 'CAMBIO_LOTE',
  CAMBIO_LOTE: 'CAMBIO_LOTE',
  CAMBIO_CARAVANA: 'CAMBIO_CARAVANA',
  TRATAMIENTO: 'TRATAMIENTO',
  SANIDAD: 'TRATAMIENTO',
  VACUNACION: 'TRATAMIENTO',
  DESPARASITACION: 'TRATAMIENTO',
  CONDICION_CORPORAL: 'CONDICION_CORPORAL',
  REVISION_TORO: 'REVISION_TORO',
  NOTA: 'NOTA',
};

/** eventType libre → enum de la bitácora (fallback OTRO, siempre registrable). */
export const toEnumType = (t: string): AnimalEventType =>
  EVENT_TYPE_TO_ENUM[(t ?? '').toUpperCase()] ?? 'OTRO';

// ------------------------------- Utilidades ---------------------------------
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const pick = (m: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    const val = m?.[k];
    if (val != null && val !== '') return val;
  }
  return null;
};
/** Minúsculas sin acentos, para comparar texto libre de la IA. */
const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// ------------------------------- Efectos ------------------------------------

/** Cambia el estado del animal (baja por muerte / venta) y anota la fecha. */
function setStatus(status: 'DECEASED' | 'SOLD', label: string): EffectHandler {
  return async (ctx) => {
    if (!ctx.animals.length) return `No encontré el animal para "${label}".`;
    const fecha = new Date().toISOString();
    await Promise.all(
      ctx.animals.map((a) =>
        ctx.prisma.animal.update({
          where: { id: a.id },
          data: {
            status,
            metadata: {
              ...(a.metadata ?? {}),
              baja: { motivo: label, fecha },
            } as Prisma.InputJsonValue,
          },
        }),
      ),
    );
    const tags = ctx.animals.map((a) => a.tagId).join(', ');
    return `✅ ${label}: ${ctx.animals.length} animal(es) (${tags}).`;
  };
}

/** Traslada a un potrero destino: actualiza ubicación + registra el movimiento. */
const moveToLocation: EffectHandler = async (ctx) => {
  const destName = pick(ctx.metadata, ['destino', 'destination', 'potrero', 'potreroDestino', 'locationName', 'lote']);
  if (!destName) return 'No entendí a qué potrero mover.';
  const dest = await ctx.resolveLocationId(String(destName));
  if (!dest) return `No encontré el potrero "${String(destName)}".`;
  if (!ctx.animals.length) return 'No encontré los animales a mover.';
  const movedAt = new Date();
  await Promise.all(
    ctx.animals.flatMap((a) => [
      ctx.prisma.animal.update({ where: { id: a.id }, data: { currentLocationId: dest.id } }),
      ctx.prisma.animalMovement.create({
        data: {
          reason: 'REGROUPING',
          movedAt,
          animal: { connect: { id: a.id } },
          toLocation: { connect: { id: dest.id } },
          ...(a.currentLocationId ? { fromLocation: { connect: { id: a.currentLocationId } } } : {}),
          metadata: { source: 'whatsapp' } as Prisma.InputJsonValue,
        },
      }),
    ]),
  );
  return `✅ ${ctx.animals.length} animal(es) movidos a ${dest.name}.`;
};

/** Registra un evento sanitario (con carencia) por cada animal afectado. */
const applyTreatment: EffectHandler = async (ctx) => {
  if (!ctx.animals.length) return 'No encontré los animales del tratamiento.';
  const producto = pick(ctx.metadata, ['producto', 'medicamento', 'medication', 'vacuna']);
  const tipoRaw = String(pick(ctx.metadata, ['tipo', 'healthType']) ?? '').toUpperCase();
  const valid: HealthEventType[] = ['VACCINATION', 'DEWORMING', 'TREATMENT', 'SURGERY', 'CHECKUP', 'OTHER'];
  const eventType: HealthEventType = valid.includes(tipoRaw as HealthEventType)
    ? (tipoRaw as HealthEventType)
    : 'TREATMENT';
  const appliedAt = new Date();
  await Promise.all(
    ctx.animals.map((a) =>
      ctx.prisma.healthRecord.create({
        data: {
          eventType,
          medication: producto ? String(producto) : null,
          appliedAt,
          notes: ctx.observations,
          metadata: { source: 'whatsapp' } as Prisma.InputJsonValue,
          animal: { connect: { id: a.id } },
        },
      }),
    ),
  );
  return `✅ Tratamiento (${producto ? String(producto) : 'sanidad'}) en ${ctx.animals.length} animal(es).`;
};

/** Pesaje: append a la serie temporal de pesos por cada animal. */
const createWeight: EffectHandler = async (ctx) => {
  const kg = num(pick(ctx.metadata, ['weightKg', 'pesoKg', 'kg', 'peso']));
  if (kg == null) return 'No entendí los kilos del pesaje.';
  if (!ctx.animals.length) return 'No encontré el animal del pesaje.';
  await Promise.all(
    ctx.animals.map((a) =>
      ctx.prisma.weightHistory.create({
        data: {
          weightKg: new Prisma.Decimal(kg),
          measuredAt: new Date(),
          source: 'MANUAL',
          metadata: { source: 'whatsapp' } as Prisma.InputJsonValue,
          animal: { connect: { id: a.id } },
        },
      }),
    ),
  );
  return `✅ Pesaje de ${kg} kg en ${ctx.animals.length} animal(es).`;
};

/** Nacimiento: crea la cría como Animal ACTIVE y liga la madre (parición). */
const registerBirth: EffectHandler = async (ctx) => {
  const motherTag = pick(ctx.metadata, ['motherTag', 'madre', 'motherTagId', 'mother']);
  let motherId: string | null = null;
  let motherName = '';
  if (motherTag) {
    const mother = await ctx.prisma.animal.findUnique({
      where: { establishmentId_tagId: { establishmentId: ctx.establishmentId, tagId: String(motherTag) } },
      select: { id: true, tagId: true },
    });
    if (mother) {
      motherId = mother.id;
      motherName = mother.tagId;
    }
  }

  const calfTag =
    ctx.animals[0]?.tagId ??
    (pick(ctx.metadata, ['tagCria', 'calfTag', 'cria', 'tagId']) as string | null) ??
    `CRIA-${motherTag ?? 'SN'}-${Date.now().toString().slice(-6)}`;

  const sexRaw = String(pick(ctx.metadata, ['sexo', 'sex']) ?? '').toUpperCase();
  const sex: 'MALE' | 'FEMALE' =
    sexRaw.startsWith('M') || sexRaw.includes('MACHO') ? 'MALE' : 'FEMALE';
  const breed = String(pick(ctx.metadata, ['raza', 'breed']) ?? 'Sin especificar');

  try {
    const calf = await ctx.prisma.animal.create({
      data: {
        tagId: String(calfTag),
        species: 'BOVINE',
        breed,
        sex,
        birthDate: new Date(),
        initialWeightKg: new Prisma.Decimal(0),
        status: 'ACTIVE',
        metadata: { source: 'whatsapp', nacimientoPorWhatsapp: true } as Prisma.InputJsonValue,
        establishment: { connect: { id: ctx.establishmentId } },
        ...(motherId ? { mother: { connect: { id: motherId } } } : {}),
      },
      select: { id: true, tagId: true, currentLocationId: true },
    });

    // Que el log genérico registre el evento sobre la cría recién creada.
    ctx.animals.push({
      id: calf.id,
      tagId: calf.tagId,
      currentLocationId: calf.currentLocationId ?? null,
      metadata: {},
    });

    // Historia reproductiva de la madre.
    if (motherId) {
      await ctx.prisma.reproductiveEvent.create({
        data: {
          type: 'PARICION',
          offspringTagId: String(calfTag),
          observations: ctx.observations,
          animal: { connect: { id: motherId } },
          establishment: { connect: { id: ctx.establishmentId } },
        },
      });
    }

    return `✅ Nacimiento registrado: cría ${String(calfTag)}${
      motherName ? ` (madre ${motherName})` : ''
    }.`;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return `La caravana ${String(calfTag)} ya existe.`;
    }
    throw err;
  }
};

/** Evento reproductivo (servicio/destete) por cada animal afectado. */
function reproEvent(type: ReproEventType, label: string): EffectHandler {
  return async (ctx) => {
    if (!ctx.animals.length) return `No encontré los animales para "${label}".`;
    const sire = pick(ctx.metadata, ['toro', 'sire', 'sireTag', 'padre']);
    await Promise.all(
      ctx.animals.map((a) =>
        ctx.prisma.reproductiveEvent.create({
          data: {
            type,
            sireTagId: type === 'SERVICIO' && sire ? String(sire) : null,
            observations: ctx.observations,
            animal: { connect: { id: a.id } },
            establishment: { connect: { id: ctx.establishmentId } },
          },
        }),
      ),
    );
    return `✅ ${label}: ${ctx.animals.length} animal(es).`;
  };
}

/** Tacto/ecografía: crea el diagnóstico de preñez (usa el potrero del animal). */
const registerPregnancyCheck: EffectHandler = async (ctx) => {
  if (!ctx.animals.length) return 'No encontré los animales del tacto.';
  const resRaw = normalize(String(pick(ctx.metadata, ['resultado', 'result', 'prenez', 'diagnostico']) ?? ''));
  const result: PregnancyStatus | null = /pren|llena|cargada|gestante|posit/.test(resRaw)
    ? 'PRENADA'
    : /vac|negat/.test(resRaw)
      ? 'VACIA'
      : null;
  if (!result) {
    return `Anoté el tacto de ${ctx.animals.length} animal(es). Aclarame si quedó "preñada" o "vacía".`;
  }
  const checkType: CheckType = String(pick(ctx.metadata, ['tipo', 'checkType']) ?? '')
    .toUpperCase()
    .includes('ECO')
    ? 'ECOGRAFIA'
    : 'TACTO';
  let done = 0;
  for (const a of ctx.animals) {
    if (!a.currentLocationId) continue; // el diagnóstico requiere potrero
    await ctx.prisma.reproductiveCheck.create({
      data: {
        type: checkType,
        result,
        observations: ctx.observations,
        animal: { connect: { id: a.id } },
        potreroId: a.currentLocationId,
        establishment: { connect: { id: ctx.establishmentId } },
      },
    });
    done++;
  }
  const label = result === 'PRENADA' ? 'preñada(s)' : 'vacía(s)';
  const faltantes = ctx.animals.length - done;
  return `✅ Tacto: ${done} ${label}${faltantes > 0 ? ` (${faltantes} sin potrero, quedaron solo anotadas)` : ''}.`;
};

/** Castración: marca el macho como castrado (afecta la categoría → novillo). */
const castrate: EffectHandler = async (ctx) => {
  if (!ctx.animals.length) return 'No encontré el animal a castrar.';
  await Promise.all(
    ctx.animals.map((a) =>
      ctx.prisma.animal.update({
        where: { id: a.id },
        data: {
          metadata: { ...(a.metadata ?? {}), castrado: true, entero: false } as Prisma.InputJsonValue,
        },
      }),
    ),
  );
  return `✅ Castración registrada: ${ctx.animals.length} animal(es).`;
};

/** Condición corporal: guarda el puntaje en la metadata del animal. */
const bodyCondition: EffectHandler = async (ctx) => {
  const score = num(pick(ctx.metadata, ['score', 'cc', 'condicion', 'estado', 'puntaje']));
  if (score == null) return 'No entendí el puntaje de condición corporal.';
  if (!ctx.animals.length) return 'No encontré el animal.';
  await Promise.all(
    ctx.animals.map((a) =>
      ctx.prisma.animal.update({
        where: { id: a.id },
        data: {
          metadata: { ...(a.metadata ?? {}), condicionCorporal: score } as Prisma.InputJsonValue,
        },
      }),
    ),
  );
  return `✅ Condición corporal ${score} en ${ctx.animals.length} animal(es).`;
};

/** Cambio de caravana: renombra el tagId de un animal. */
const changeTag: EffectHandler = async (ctx) => {
  const nueva = pick(ctx.metadata, ['nuevaCaravana', 'nueva', 'newTag', 'nuevoTag', 'nuevoId']);
  if (!nueva) return 'No entendí la nueva caravana.';
  if (ctx.animals.length !== 1) return 'Para cambiar la caravana, indicá un solo animal.';
  const a = ctx.animals[0];
  try {
    await ctx.prisma.animal.update({ where: { id: a.id }, data: { tagId: String(nueva) } });
    return `✅ Caravana ${a.tagId} → ${String(nueva)}.`;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return `La caravana ${String(nueva)} ya existe.`;
    }
    throw err;
  }
};

// --------------------- Registro (agregar acciones = 1 línea) ----------------
const EFFECT_HANDLERS: Record<string, EffectHandler> = {
  BAJA_MUERTE: setStatus('DECEASED', 'Baja por muerte'),
  MUERTE: setStatus('DECEASED', 'Baja por muerte'),
  VENTA: setStatus('SOLD', 'Venta'),
  VENDIDO: setStatus('SOLD', 'Venta'),
  EGRESO: setStatus('SOLD', 'Egreso'),
  TRASLADO: moveToLocation,
  MOVIMIENTO: moveToLocation,
  CAMBIO_POTRERO: moveToLocation,
  CAMBIO_LOTE: moveToLocation,
  TRATAMIENTO: applyTreatment,
  SANIDAD: applyTreatment,
  VACUNACION: applyTreatment,
  DESPARASITACION: applyTreatment,
  PESAJE: createWeight,
  NACIMIENTO: registerBirth,
  PARTO: registerBirth,
  SERVICIO: reproEvent('SERVICIO', 'Servicio'),
  INSEMINACION: reproEvent('SERVICIO', 'Servicio'),
  DESTETE: reproEvent('DESTETE', 'Destete'),
  TACTO: registerPregnancyCheck,
  ECOGRAFIA: registerPregnancyCheck,
  PRENEZ: registerPregnancyCheck,
  DIAGNOSTICO_PRENEZ: registerPregnancyCheck,
  CASTRACION: castrate,
  CONDICION_CORPORAL: bodyCondition,
  CAMBIO_CARAVANA: changeTag,
};

/** Devuelve el efecto para un eventType, o null si solo se registra en bitácora. */
export const getEffect = (t: string): EffectHandler | null =>
  EFFECT_HANDLERS[(t ?? '').toUpperCase()] ?? null;
