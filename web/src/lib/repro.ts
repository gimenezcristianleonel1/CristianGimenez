import type { ReproCheckRow, ReproEventRow } from './types';

/** Filtros reproductivos usados en la lista de animales (?repro=...). */
export type ReproFilter = 'prenada' | 'vacia' | 'servicio' | 'paricion' | 'destete';

export const REPRO_LABEL: Record<ReproFilter, string> = {
  prenada: 'Preñadas',
  vacia: 'Vacías',
  servicio: 'En servicio',
  paricion: 'Paridas',
  destete: 'Destetadas',
};

export function isReproFilter(v: string | null): v is ReproFilter {
  return v != null && v in REPRO_LABEL;
}

/**
 * Conjunto de animalId que cumplen el estado reproductivo pedido.
 *  - prenada/vacia: según el ÚLTIMO diagnóstico (tacto/eco) del animal.
 *  - servicio/paricion/destete: si tiene al menos un evento de ese tipo.
 */
export function animalsForReproFilter(
  filter: ReproFilter,
  checks: ReproCheckRow[],
  events: ReproEventRow[],
): Set<string> {
  if (filter === 'prenada' || filter === 'vacia') {
    const latest = new Map<string, { date: string; result: string }>();
    for (const c of checks) {
      const cur = latest.get(c.animalId);
      if (!cur || c.date > cur.date) latest.set(c.animalId, { date: c.date, result: c.result });
    }
    const want = filter === 'prenada' ? 'PRENADA' : 'VACIA';
    return new Set(
      [...latest.entries()].filter(([, v]) => v.result === want).map(([id]) => id),
    );
  }
  const type = filter === 'servicio' ? 'SERVICIO' : filter === 'paricion' ? 'PARICION' : 'DESTETE';
  return new Set(events.filter((e) => e.type === type).map((e) => e.animalId));
}
