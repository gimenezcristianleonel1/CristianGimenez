import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createReproCheck } from '../db/repository';
import type { CheckType } from '../lib/types';

const round1 = (n: number): number => Math.round(n * 10) / 10;
const EMPTY_ALERT_THRESHOLD = 15;

export default function Reproductivo() {
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);
  const checks = useLiveQuery(() => db.reproChecks.toArray(), [], []);

  const [potreroId, setPotreroId] = useState('');
  const [type, setType] = useState<CheckType>('TACTO');

  const potreros = [...locations].sort((a, b) => a.name.localeCompare(b.name));
  const residents = animals
    .filter((a) => a.status === 'ACTIVE' && a.currentLocationId === potreroId)
    .sort((a, b) => a.tagId.localeCompare(b.tagId, 'es', { numeric: true }));

  // Chequeos del potrero seleccionado (para el resumen y el estado de cada animal).
  const potreroChecks = useMemo(
    () => checks.filter((c) => c.potreroId === potreroId),
    [checks, potreroId],
  );
  const checkByAnimal = useMemo(() => {
    const m = new Map<string, (typeof potreroChecks)[number]>();
    for (const c of potreroChecks) m.set(c.animalId, c);
    return m;
  }, [potreroChecks]);

  const prenadas = potreroChecks.filter((c) => c.result === 'PRENADA').length;
  const vacias = potreroChecks.filter((c) => c.result === 'VACIA').length;
  const total = prenadas + vacias;
  const pctPrenez = total > 0 ? round1((prenadas / total) * 100) : 0;
  const pctVacias = total > 0 ? round1((vacias / total) * 100) : 0;
  const alerta = pctVacias > EMPTY_ALERT_THRESHOLD;

  const register = async (animalId: string, result: 'PRENADA' | 'VACIA') => {
    await createReproCheck({ animalId, potreroId, type, result });
  };

  return (
    <div>
      <div className="section-title">
        <h2>Reproductivo</h2>
      </div>

      <label htmlFor="potrero">Potrero (lote a evaluar)</label>
      <select id="potrero" value={potreroId} onChange={(e) => setPotreroId(e.target.value)}>
        <option value="">— Elegí un potrero —</option>
        {potreros.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {potreroId && (
        <>
          <label>Tipo de trabajo</label>
          <div className="tabs">
            <button
              className={`tab ${type === 'TACTO' ? 'active' : ''}`}
              onClick={() => setType('TACTO')}
            >
              Tacto
            </button>
            <button
              className={`tab ${type === 'ECOGRAFIA' ? 'active' : ''}`}
              onClick={() => setType('ECOGRAFIA')}
            >
              Ecografía
            </button>
          </div>

          {/* Resumen en vivo del lote */}
          <div className="card">
            <h2>Resumen del lote</h2>
            <div className="grid2">
              <div className="stat">
                <div className="n">{total}</div>
                <div className="l">Controlados</div>
              </div>
              <div className="stat">
                <div className="n" style={{ color: 'var(--brand)' }}>
                  {pctPrenez}%
                </div>
                <div className="l">Preñez ({prenadas})</div>
              </div>
              <div className="stat">
                <div className="n" style={{ color: 'var(--danger)' }}>
                  {pctVacias}%
                </div>
                <div className="l">Vacías ({vacias})</div>
              </div>
              <div className="stat">
                <div className="n">{residents.length - total}</div>
                <div className="l">Sin controlar</div>
              </div>
            </div>
            {alerta && (
              <div className="alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
                Atención: {pctVacias}% de vacías (supera el {EMPTY_ALERT_THRESHOLD}%). Conviene
                revisar estado corporal, sanidad y nutrición del rodeo.
              </div>
            )}
          </div>

          {/* Trabajo animal por animal */}
          {residents.length === 0 ? (
            <div className="empty">No hay animales activos en este potrero.</div>
          ) : (
            residents.map((a) => {
              const done = checkByAnimal.get(a.id);
              return (
                <div className="list-item" key={a.id} style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div className="title">{a.tagId}</div>
                    <div className="sub">{a.breed}</div>
                  </div>
                  {done ? (
                    <span className={`badge ${done.result === 'VACIA' ? 'danger' : ''}`}>
                      {done.result === 'PRENADA' ? 'Preñada' : 'Vacía'}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-sm" onClick={() => void register(a.id, 'PRENADA')}>
                        Preñada
                      </button>
                      <button
                        className="btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => void register(a.id, 'VACIA')}
                      >
                        Vacía
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
