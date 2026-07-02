import type { Animal, Sex, ReproEventRow } from './types';

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

/**
 * Agrupación de categorías tal como se muestra en el Dashboard ("Stock por
 * categoría"). Se comparte con la lista de animales para poder filtrar al tocar
 * una categoría.
 */
export type CategoryGroup = 'vacas' | 'vaquillonas' | 'terneros' | 'novillos' | 'toros';

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  vacas: 'Vacas',
  vaquillonas: 'Vaquillonas',
  terneros: 'Terneros/as',
  novillos: 'Novillos',
  toros: 'Toros',
};

// -------------------------------------------------------------- Estados finos
//
// Progresión automática (por edad) y por hitos reproductivos:
//   Hembra: Ternera → Vaquillona → Vaquilla → (1er servicio) Vaquilla en
//           servicio → (1ra parición) Vaquilla de 1ª parición → (2do
//           servicio / 2da parición) Vaca.
//   Macho:  Ternero → Novillito → Novillo (o Toro si es reproductor).

export type AnimalStage =
  | 'TERNERA'
  | 'VAQUILLONA'
  | 'VAQUILLA'
  | 'VAQUILLA_1P'
  | 'VACA'
  | 'TERNERO'
  | 'NOVILLITO'
  | 'NOVILLO'
  | 'TORO';

export const STAGE_LABEL: Record<AnimalStage, string> = {
  TERNERA: 'Ternera',
  VAQUILLONA: 'Vaquillona',
  VAQUILLA: 'Vaquilla',
  VAQUILLA_1P: 'Vaquilla de 1ª parición',
  VACA: 'Vaca',
  TERNERO: 'Ternero',
  NOVILLITO: 'Novillito',
  NOVILLO: 'Novillo',
  TORO: 'Toro',
};

export interface ReproCounts {
  servicios: number;
  pariciones: number;
}
const NO_REPRO: ReproCounts = { servicios: 0, pariciones: 0 };

const STAGE_TO_GROUP: Record<AnimalStage, CategoryGroup> = {
  TERNERA: 'terneros',
  TERNERO: 'terneros',
  VAQUILLONA: 'vaquillonas',
  VAQUILLA: 'vaquillonas',
  VAQUILLA_1P: 'vacas',
  VACA: 'vacas',
  NOVILLITO: 'novillos',
  NOVILLO: 'novillos',
  TORO: 'toros',
};

// Umbrales de edad (meses).
const F_TERNERA_MAX = 18; // hasta 1½ año: ternera
const F_VAQUILLONA_MAX = 24; // 1½–2 años: vaquillona
const F_ASSUME_COW = 36; // ≥3 años sin datos reproductivos: se asume vaca
const M_TERNERO_MAX = 12;
const M_NOVILLITO_MAX = 24;

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

function categoryToStage(category: CowCategory, sex: Sex): AnimalStage {
  switch (category) {
    case 'VACA_CON_TERNERO':
    case 'VACA_SECA':
      return 'VACA';
    case 'VAQUILLONA':
      return 'VAQUILLONA';
    case 'TERNERO':
      return sex === 'FEMALE' ? 'TERNERA' : 'TERNERO';
    case 'NOVILLITO':
      return 'NOVILLITO';
    case 'NOVILLO':
      return 'NOVILLO';
    case 'TORO':
      return 'TORO';
  }
}

/**
 * Estado fino del animal, calculado en vivo por edad + eventos reproductivos.
 * Si el animal tiene una categoría fijada a mano (metadata.category), se respeta.
 */
export function classifyStage(
  animal: Pick<Animal, 'sex' | 'birthDate' | 'metadata'>,
  repro: ReproCounts = NO_REPRO,
  now: Date = new Date(),
): AnimalStage {
  const meta = readMeta(animal.metadata);
  if (meta.category) return categoryToStage(meta.category, animal.sex);

  const months = ageInMonths(animal.birthDate, now);

  if (animal.sex === 'MALE') {
    if (meta.isBull) return 'TORO';
    if (months < M_TERNERO_MAX) return 'TERNERO';
    if (months < M_NOVILLITO_MAX) return 'NOVILLITO';
    return 'NOVILLO';
  }

  // Hembra: los hitos reproductivos mandan sobre la edad.
  if (repro.pariciones >= 2 || repro.servicios >= 2) return 'VACA';
  if (repro.pariciones >= 1) return 'VAQUILLA_1P';
  if (repro.servicios >= 1) return 'VAQUILLA';

  if (months < F_TERNERA_MAX) return 'TERNERA';
  if (months < F_VAQUILLONA_MAX) return 'VAQUILLONA';
  if (months < F_ASSUME_COW) return 'VAQUILLA';
  return 'VACA';
}

function stageToCategory(stage: AnimalStage, hasCalfAtFoot: boolean): CowCategory {
  switch (stage) {
    case 'TERNERA':
    case 'TERNERO':
      return 'TERNERO';
    case 'VAQUILLONA':
    case 'VAQUILLA':
      return 'VAQUILLONA';
    case 'VAQUILLA_1P':
      return 'VACA_CON_TERNERO'; // 1ra parición: cría al pie
    case 'VACA':
      return hasCalfAtFoot ? 'VACA_CON_TERNERO' : 'VACA_SECA';
    case 'NOVILLITO':
      return 'NOVILLITO';
    case 'NOVILLO':
      return 'NOVILLO';
    case 'TORO':
      return 'TORO';
  }
}

/** Cuenta servicios y pariciones por animal a partir de los eventos reproductivos. */
export function reproCountsByAnimal(events: ReproEventRow[]): Map<string, ReproCounts> {
  const map = new Map<string, ReproCounts>();
  for (const e of events) {
    const cur = map.get(e.animalId) ?? { servicios: 0, pariciones: 0 };
    if (e.type === 'SERVICIO') cur.servicios += 1;
    else if (e.type === 'PARICION') cur.pariciones += 1;
    map.set(e.animalId, cur);
  }
  return map;
}

export function classifyCategory(
  sex: Sex,
  birthDate: string,
  metadata?: Record<string, unknown>,
  now: Date = new Date(),
): CowCategory {
  const meta = readMeta(metadata);
  const stage = classifyStage({ sex, birthDate, metadata }, NO_REPRO, now);
  return stageToCategory(stage, meta.hasCalfAtFoot);
}

/** Grupo (Dashboard) al que pertenece un animal, considerando su historia reproductiva. */
export function groupOfAnimal(
  animal: Pick<Animal, 'sex' | 'birthDate' | 'metadata'>,
  repro: ReproCounts = NO_REPRO,
  now: Date = new Date(),
): CategoryGroup {
  return STAGE_TO_GROUP[classifyStage(animal, repro, now)];
}

export function cowEquivalent(
  animal: Pick<Animal, 'sex' | 'birthDate' | 'metadata'>,
  repro: ReproCounts = NO_REPRO,
): number {
  const meta = readMeta(animal.metadata);
  return EV_BY_CATEGORY[stageToCategory(classifyStage(animal, repro), meta.hasCalfAtFoot)];
}
