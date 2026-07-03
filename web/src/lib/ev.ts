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
// Clasificación oficial (Argentina), recalculada en vivo por edad, cronometría
// dentaria (boqueo) e historia reproductiva:
//
//   Hembras
//     Ternera ....... del nacimiento al destete (~6–9 meses).
//     Vaquillona .... destetada hasta su 1ª parición o hasta los 2–3 años.
//     Vaca .......... parió al menos una vez, o boca con más de 4 dientes.
//   Machos
//     Ternero ....... al pie de la madre (hasta ~6–9 meses).
//     Novillito ..... castrado con hasta 4 dientes (aprox. 1–2 años).
//     Novillo ....... castrado con más de 4 dientes.
//     MEJ ........... macho entero joven, hasta 2 dientes.
//     Toro .......... macho entero con más de 2 dientes (o reproductor).
//
//   Cronometría dentaria (dientes incisivos permanentes):
//     hasta 1 año = 0 · 1–2 años = 2 · 2–3 años = 4 · 3–4 años = 6 · +4 años = 8

export type AnimalStage =
  | 'TERNERA'
  | 'VAQUILLONA'
  | 'VACA'
  | 'TERNERO'
  | 'NOVILLITO'
  | 'NOVILLO'
  | 'MEJ'
  | 'TORO';

export const STAGE_LABEL: Record<AnimalStage, string> = {
  TERNERA: 'Ternera',
  VAQUILLONA: 'Vaquillona',
  VACA: 'Vaca',
  TERNERO: 'Ternero',
  NOVILLITO: 'Novillito',
  NOVILLO: 'Novillo',
  MEJ: 'MEJ (macho entero joven)',
  TORO: 'Toro',
};

export interface ReproCounts {
  servicios: number;
  pariciones: number;
  destetes: number;
  /** Ternero al pie: última parición posterior al último destete. */
  calfAtFoot: boolean;
}
const NO_REPRO: ReproCounts = {
  servicios: 0,
  pariciones: 0,
  destetes: 0,
  calfAtFoot: false,
};

const STAGE_TO_GROUP: Record<AnimalStage, CategoryGroup> = {
  TERNERA: 'terneros',
  TERNERO: 'terneros',
  VAQUILLONA: 'vaquillonas',
  VACA: 'vacas',
  NOVILLITO: 'novillos',
  NOVILLO: 'novillos',
  MEJ: 'novillos',
  TORO: 'toros',
};

const WEANING_MONTHS = 8; // destete aproximado (6–9 meses)

export function ageInMonths(birthDate: string, now: Date = new Date()): number {
  const b = new Date(birthDate);
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Edad legible y compacta:
 *   ≥ 1 año  → "X años y Y meses" (o solo "X años" si no sobran meses)
 *   1–11 m   → "X meses"
 *   < 1 mes  → "X días"
 */
export function formatAge(birthDate: string, now: Date = new Date()): string {
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return '—';
  const months = ageInMonths(birthDate, now);
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const rem = months % 12;
    const y = `${years} año${years === 1 ? '' : 's'}`;
    return rem ? `${y} y ${rem} mes${rem === 1 ? '' : 'es'}` : y;
  }
  if (months >= 1) return `${months} mes${months === 1 ? '' : 'es'}`;
  const days = Math.max(0, Math.floor((now.getTime() - b.getTime()) / 86_400_000));
  return `${days} día${days === 1 ? '' : 's'}`;
}

/** Dientes incisivos permanentes estimados por edad (cronometría dentaria). */
export function teethFromAge(months: number): 0 | 2 | 4 | 6 | 8 {
  if (months < 12) return 0;
  if (months < 24) return 2;
  if (months < 36) return 4;
  if (months < 48) return 6;
  return 8;
}

export const TEETH_OPTIONS: Array<0 | 2 | 4 | 6 | 8> = [0, 2, 4, 6, 8];
export function teethLabel(n: number): string {
  if (n <= 0) return 'Dientes de leche (0)';
  if (n >= 8) return 'Boca llena (8)';
  return `${n} dientes`;
}

function readMeta(metadata: Record<string, unknown> | undefined) {
  const meta = metadata ?? {};
  const raw = typeof meta.category === 'string' ? meta.category.toUpperCase() : null;
  const category = raw && raw in EV_BY_CATEGORY ? (raw as CowCategory) : null;
  const teethRaw = typeof meta.teeth === 'number' ? meta.teeth : Number(meta.teeth);
  const teeth = Number.isFinite(teethRaw) && teethRaw >= 0 && teethRaw <= 8 ? teethRaw : null;
  return {
    category,
    teeth,
    hasCalfAtFoot: meta.hasCalfAtFoot === true,
    entero: meta.entero === true || meta.reproductor === true,
    isBull: meta.isBull === true || meta.reproductor === true || meta.role === 'TORO',
  };
}

/** Dientes efectivos: el boqueo cargado a mano, o el estimado por edad. */
export function effectiveTeeth(
  animal: Pick<Animal, 'birthDate' | 'metadata'>,
  now: Date = new Date(),
): number {
  const meta = readMeta(animal.metadata);
  return meta.teeth ?? teethFromAge(ageInMonths(animal.birthDate, now));
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
 * Estado fino del animal, calculado en vivo por edad + boqueo + eventos
 * reproductivos. Si hay una categoría fijada a mano (metadata.category), se respeta.
 */
export function classifyStage(
  animal: Pick<Animal, 'sex' | 'birthDate' | 'metadata'>,
  repro: ReproCounts = NO_REPRO,
  now: Date = new Date(),
): AnimalStage {
  const meta = readMeta(animal.metadata);
  if (meta.category) return categoryToStage(meta.category, animal.sex);

  const months = ageInMonths(animal.birthDate, now);
  const teeth = meta.teeth ?? teethFromAge(months);
  const weaned = repro.destetes > 0 || months >= WEANING_MONTHS;

  if (animal.sex === 'FEMALE') {
    if (repro.pariciones >= 1 || teeth > 4) return 'VACA';
    if (!weaned) return 'TERNERA';
    return 'VAQUILLONA';
  }

  // Machos
  if (meta.isBull) return 'TORO';
  if (!weaned) return 'TERNERO';
  if (meta.entero) return teeth <= 2 ? 'MEJ' : 'TORO';
  return teeth <= 4 ? 'NOVILLITO' : 'NOVILLO';
}

function stageToCategory(stage: AnimalStage, hasCalfAtFoot: boolean): CowCategory {
  switch (stage) {
    case 'TERNERA':
    case 'TERNERO':
      return 'TERNERO';
    case 'VAQUILLONA':
      return 'VAQUILLONA';
    case 'VACA':
      return hasCalfAtFoot ? 'VACA_CON_TERNERO' : 'VACA_SECA';
    case 'NOVILLITO':
      return 'NOVILLITO';
    case 'NOVILLO':
    case 'MEJ':
      return 'NOVILLO'; // torito / macho entero joven ≈ 0.8 EV
    case 'TORO':
      return 'TORO';
  }
}

/**
 * Cuenta servicios, pariciones y destetes por animal, y determina si tiene
 * ternero al pie (última parición posterior al último destete registrado).
 */
export function reproCountsByAnimal(events: ReproEventRow[]): Map<string, ReproCounts> {
  const map = new Map<string, ReproCounts>();
  const lastParicion = new Map<string, string>();
  const lastDestete = new Map<string, string>();
  for (const e of events) {
    const cur = map.get(e.animalId) ?? {
      servicios: 0,
      pariciones: 0,
      destetes: 0,
      calfAtFoot: false,
    };
    if (e.type === 'SERVICIO') cur.servicios += 1;
    else if (e.type === 'PARICION') {
      cur.pariciones += 1;
      const prev = lastParicion.get(e.animalId);
      if (!prev || e.date > prev) lastParicion.set(e.animalId, e.date);
    } else if (e.type === 'DESTETE') {
      cur.destetes += 1;
      const prev = lastDestete.get(e.animalId);
      if (!prev || e.date > prev) lastDestete.set(e.animalId, e.date);
    }
    map.set(e.animalId, cur);
  }
  // Ternero al pie: parió y todavía no la destetó (o la parición es más reciente).
  for (const [animalId, counts] of map) {
    const par = lastParicion.get(animalId);
    const des = lastDestete.get(animalId);
    counts.calfAtFoot = !!par && (!des || par > des);
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

/** ¿Tiene ternero al pie? Automático por eventos (parición vs. destete) o marca manual. */
export function hasCalfAtFoot(
  animal: Pick<Animal, 'metadata'>,
  repro: ReproCounts = NO_REPRO,
): boolean {
  return repro.calfAtFoot || readMeta(animal.metadata).hasCalfAtFoot;
}

export function cowEquivalent(
  animal: Pick<Animal, 'sex' | 'birthDate' | 'metadata'>,
  repro: ReproCounts = NO_REPRO,
): number {
  return EV_BY_CATEGORY[stageToCategory(classifyStage(animal, repro), hasCalfAtFoot(animal, repro))];
}
