import { Sex, Species } from '@prisma/client';

/** Campos de nuestro esquema que la importación puede completar. */
export type AppField =
  | 'tagId'
  | 'species'
  | 'breed'
  | 'sex'
  | 'birthDate'
  | 'entryDate'
  | 'initialWeightKg';

export const APP_FIELDS: AppField[] = [
  'tagId',
  'species',
  'breed',
  'sex',
  'birthDate',
  'entryDate',
  'initialWeightKg',
];

/** El único campo imprescindible para poder importar una fila. */
export const REQUIRED_FIELDS: AppField[] = ['tagId'];

/** Etiquetas legibles (para el selector de mapeo del frontend). */
export const FIELD_LABELS: Record<AppField, string> = {
  tagId: 'Caravana / Arete',
  species: 'Especie',
  breed: 'Raza',
  sex: 'Sexo',
  birthDate: 'Fecha de nacimiento',
  entryDate: 'Fecha de ingreso',
  initialWeightKg: 'Peso inicial (kg)',
};

/** Sinónimos (ya normalizados) por campo — el corazón del fuzzy matching. */
const FIELD_SYNONYMS: Record<AppField, string[]> = {
  tagId: [
    'caravana',
    'n caravana',
    'nro caravana',
    'numero caravana',
    'numero de caravana',
    'arete',
    'rp',
    'id animal',
    'idanimal',
    'identificacion',
    'tag',
    'chapeta',
    'crotal',
  ],
  species: ['especie', 'tipo', 'tipo animal', 'especie animal'],
  breed: ['raza', 'breed'],
  sex: ['sexo', 'genero', 'sex'],
  birthDate: [
    'fecha nacimiento',
    'fecha de nacimiento',
    'nacimiento',
    'fecha nac',
    'fnac',
    'dob',
    'birth date',
    'birthdate',
  ],
  entryDate: [
    'fecha de ingreso',
    'fecha ingreso',
    'f ingreso',
    'ingreso',
    'fecha de entrada',
    'fecha entrada',
    'entrada',
    'fecha de compra',
    'fecha compra',
    'alta',
    'fecha alta',
  ],
  initialWeightKg: [
    'peso',
    'peso inicial',
    'peso kg',
    'peso alta',
    'peso ingreso',
    'peso de ingreso',
    'p ingreso',
    'kilos',
    'weight',
    'kg',
  ],
};

/** Normaliza un texto: minúsculas, sin acentos, sin símbolos, espacios simples. */
export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita diacriticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function matchesSynonym(normalizedHeader: string, synonym: string): boolean {
  if (synonym.includes(' ')) {
    return normalizedHeader.includes(synonym);
  }
  // Sinónimo de una sola palabra: comparación por token (evita falsos positivos).
  return normalizedHeader.split(' ').includes(synonym);
}

export interface HeaderMatchResult {
  /** Mapeo detectado: campoApp -> encabezado original del archivo. */
  mapping: Partial<Record<AppField, string>>;
  /** Encabezados que no se pudieron mapear a ningún campo. */
  unmatchedColumns: string[];
}

/**
 * Mapea automáticamente los encabezados de un archivo a nuestros campos.
 * Dos pasadas: primero coincidencia exacta, luego coincidencia flexible.
 */
export function matchHeaders(headers: string[]): HeaderMatchResult {
  const mapping: Partial<Record<AppField, string>> = {};
  const used = new Set<string>();

  const tryAssign = (predicate: (nh: string, syn: string) => boolean) => {
    for (const field of APP_FIELDS) {
      if (mapping[field]) continue;
      for (const header of headers) {
        if (used.has(header)) continue;
        const nh = normalizeHeader(header);
        if (FIELD_SYNONYMS[field].some((syn) => predicate(nh, syn))) {
          mapping[field] = header;
          used.add(header);
          break;
        }
      }
    }
  };

  tryAssign((nh, syn) => nh === syn); // pasada 1: exacta
  tryAssign(matchesSynonym); // pasada 2: flexible

  const unmatchedColumns = headers.filter((h) => !used.has(h));
  return { mapping, unmatchedColumns };
}

/** Firma estable de una estructura de encabezados (para reconocerla luego). */
export function signatureOf(headers: string[]): string {
  return headers.map(normalizeHeader).sort().join('|');
}

/** ¿El mapeo cubre los campos requeridos (al menos la caravana)? */
export function hasRequiredFields(mapping: Partial<Record<AppField, string>>): boolean {
  return REQUIRED_FIELDS.every((f) => !!mapping[f]);
}

/** Normaliza el valor de "especie" a nuestro enum. */
export function normalizeSpecies(value: unknown): Species {
  const v = normalizeHeader(String(value ?? ''));
  if (/(bovino|vacuno|vaca|ternero|novillo|toro|vaquillona|res)/.test(v)) return Species.BOVINE;
  if (/(porcino|cerdo|chancho|lechon)/.test(v)) return Species.PORCINE;
  if (/(ovino|oveja|cordero|borrego)/.test(v)) return Species.OVINE;
  if (/(caprino|cabra|chivo|cabrito)/.test(v)) return Species.CAPRINE;
  if (/(equino|caballo|yegua|potro)/.test(v)) return Species.EQUINE;
  return Species.BOVINE; // por defecto para ganadería
}

/** Normaliza el valor de "sexo" a nuestro enum. */
export function normalizeSex(value: unknown): Sex {
  const v = normalizeHeader(String(value ?? ''));
  if (/(macho|toro|novillo|padre|^m$|male|masculino)/.test(v)) return Sex.MALE;
  if (/(hembra|vaca|vaquillona|madre|^h$|^f$|female|femenino)/.test(v)) return Sex.FEMALE;
  return Sex.FEMALE;
}
