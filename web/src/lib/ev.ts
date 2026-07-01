import type { Animal, Sex } from './types';

/**
 * Cálculo de Equivalente Vaca (EV), espejo del helper del backend
 * (src/modules/reports/cow-equivalent.ts). Permite mostrar la carga por
 * potrero de forma 100% offline, calculada localmente desde IndexedDB.
 *
 *   Vaca con ternero al pie ... 1.00 EV
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

export const CATEGORY_LABEL: Record<CowCategory, string> = {
  VACA_CON_TERNERO: 'Vaca con ternero',
  VACA_SECA: 'Vaca seca',
  VAQUILLONA: 'Vaquillona',
  TERNERO: 'Ternero/a',
  NOVILLITO: 'Novillito',
  NOVILLO: 'Novillo',
  TORO: 'Toro',
};

const WEANING_MAX_MONTHS = 12;
const YOUNG_MAX_MONTHS = 24;
const HEIFER_MAX_MONTHS = 30;

export function ageInMonths(birthDate: string, now: Date = new Date()): number {
  const b = new Date(birthDate);
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  return Math.max(0, months);
}

function readMeta(metadata: Record<string, unknown> | undefined) {
  const meta = metadata ?? {};
  const raw = typeof meta.category === 'string' ? meta.category.toUpperCase() : null;
  const category = raw && raw in EV_BY_CATEGORY ? (raw as CowCategory) : null;
  return {
    category,
    hasCalfAtFoot: meta.hasCalfAtFoot === true,
    isBull: meta.isBull === true || meta.reproductor === true || meta.role === 'TORO',
  };
}

export function classifyCategory(
  sex: Sex,
  birthDate: string,
  metadata?: Record<string, unknown>,
  now: Date = new Date(),
): CowCategory {
  const meta = readMeta(metadata);
  if (meta.category) return meta.category;

  const months = ageInMonths(birthDate, now);
  if (sex === 'MALE') {
    if (meta.isBull) return 'TORO';
    if (months < WEANING_MAX_MONTHS) return 'TERNERO';
    if (months < YOUNG_MAX_MONTHS) return 'NOVILLITO';
    return 'NOVILLO';
  }
  if (months < WEANING_MAX_MONTHS) return 'TERNERO';
  if (months < HEIFER_MAX_MONTHS) return 'VAQUILLONA';
  return meta.hasCalfAtFoot ? 'VACA_CON_TERNERO' : 'VACA_SECA';
}

export function cowEquivalent(animal: Pick<Animal, 'sex' | 'birthDate' | 'metadata'>): number {
  return EV_BY_CATEGORY[classifyCategory(animal.sex, animal.birthDate, animal.metadata)];
}
