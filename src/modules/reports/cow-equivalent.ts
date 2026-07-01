import { Sex } from '@prisma/client';

/**
 * Cálculo de Equivalente Vaca (EV) por animal.
 *
 * La "categoría" no es una columna del sistema, así que se infiere a partir de
 * datos que sí tenemos: sexo + edad (a partir de birthDate) y, opcionalmente,
 * banderas en `metadata` (para casos que la edad/sexo no distinguen, como toro
 * vs. novillo, o vaca con ternero al pie vs. vaca seca).
 *
 * Valores de referencia (planteo típico del NEA):
 *   Vaca con ternero al pie ... 1.00 EV (unidad de referencia)
 *   Vaca seca / vacía ......... 0.80 EV
 *   Vaquillona de reposición .. 0.70 EV
 *   Ternero/a (destete) ....... 0.60 EV
 *   Novillito (recría) ........ 0.70 EV
 *   Novillo / torito .......... 0.80 EV
 *   Toro (reproductor) ........ 1.30 EV
 */
export type CowCategory =
  | 'VACA_CON_TERNERO'
  | 'VACA_SECA'
  | 'VAQUILLONA'
  | 'TERNERO'
  | 'NOVILLITO'
  | 'NOVILLO'
  | 'TORO';

export const EV_BY_CATEGORY: Record<CowCategory, number> = {
  VACA_CON_TERNERO: 1.0,
  VACA_SECA: 0.8,
  VAQUILLONA: 0.7,
  TERNERO: 0.6,
  NOVILLITO: 0.7,
  NOVILLO: 0.8,
  TORO: 1.3,
};

/** Umbrales de edad (meses) usados para inferir la categoría. */
const WEANING_MAX_MONTHS = 12; // hasta acá se considera ternero/a
const YOUNG_MAX_MONTHS = 24; // recría (novillito) / vaquillona joven
const HEIFER_MAX_MONTHS = 30; // hembra sin cría todavía "vaquillona de reposición"

export interface EvAnimalInput {
  sex: Sex;
  birthDate: Date;
  /** Peso actual en kg (último pesaje o peso al alta). Opcional. */
  weightKg?: number | null;
  /** Enriquecimiento: puede traer overrides (category, hasCalfAtFoot, isBull). */
  metadata?: Record<string, unknown> | null;
}

/** Edad en meses completos entre birthDate y `now`. */
export function ageInMonths(birthDate: Date, now: Date = new Date()): number {
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
  if (now.getDate() < birthDate.getDate()) months -= 1;
  return Math.max(0, months);
}

function readMeta(metadata: Record<string, unknown> | null | undefined) {
  const meta = metadata ?? {};
  const rawCategory = typeof meta.category === 'string' ? meta.category.toUpperCase() : null;
  const category =
    rawCategory && rawCategory in EV_BY_CATEGORY ? (rawCategory as CowCategory) : null;
  return {
    category,
    hasCalfAtFoot: meta.hasCalfAtFoot === true,
    isBull: meta.isBull === true || meta.reproductor === true || meta.role === 'TORO',
  };
}

/**
 * Determina la categoría del animal. Prioriza `metadata.category` si viene
 * explícita y válida; de lo contrario la infiere por sexo + edad + banderas.
 */
export function classifyCategory(a: EvAnimalInput, now: Date = new Date()): CowCategory {
  const meta = readMeta(a.metadata);
  if (meta.category) return meta.category;

  const months = ageInMonths(a.birthDate, now);

  if (a.sex === Sex.MALE) {
    if (meta.isBull) return 'TORO';
    if (months < WEANING_MAX_MONTHS) return 'TERNERO';
    if (months < YOUNG_MAX_MONTHS) return 'NOVILLITO';
    return 'NOVILLO';
  }

  // Hembra
  if (months < WEANING_MAX_MONTHS) return 'TERNERO'; // ternera: mismo EV (0.60)
  if (months < HEIFER_MAX_MONTHS) return 'VAQUILLONA';
  return meta.hasCalfAtFoot ? 'VACA_CON_TERNERO' : 'VACA_SECA';
}

/** EV del animal (número redondeado a 2 decimales). */
export function cowEquivalent(a: EvAnimalInput, now: Date = new Date()): number {
  return EV_BY_CATEGORY[classifyCategory(a, now)];
}
