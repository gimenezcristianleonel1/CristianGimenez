import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { speciesLabel, statusLabel } from '../lib/labels';
import { groupOfAnimal, GROUP_LABEL, type CategoryGroup } from '../lib/ev';

export default function AnimalsList() {
  const [q, setQ] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);

  const rawCat = searchParams.get('cat');
  const cat = (rawCat && rawCat in GROUP_LABEL ? rawCat : null) as CategoryGroup | null;

  // Filtro por potrero manejado por la URL ('' = todos · 'none' = sin potrero · <id>).
  const loc = searchParams.get('loc') ?? '';
  const setLoc = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set('loc', v);
    else next.delete('loc');
    setSearchParams(next, { replace: true });
  };

  const clearCat = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('cat');
    setSearchParams(next, { replace: true });
  };

  const term = q.trim().toLowerCase();
  const filtered = animals.filter((a) => {
    // Al filtrar por categoría solo aplican los animales activos (así se ve en el resumen).
    if (cat && (a.status !== 'ACTIVE' || groupOfAnimal(a) !== cat)) return false;
    if (loc === 'none' && a.currentLocationId) return false;
    if (loc && loc !== 'none' && a.currentLocationId !== loc) return false;
    if (term && !a.tagId.toLowerCase().includes(term) && !a.breed.toLowerCase().includes(term)) {
      return false;
    }
    return true;
  });

  const locName = (id?: string | null) =>
    id ? (locations.find((l) => l.id === id)?.name ?? '—') : 'Sin potrero';

  return (
    <div>
      <div className="section-title">
        <h2>
          {cat ? GROUP_LABEL[cat] : 'Animales'} ({filtered.length})
        </h2>
      </div>

      {cat && (
        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}
        >
          <span className="sub" style={{ flex: 1 }}>
            Mostrando la categoría <strong>{GROUP_LABEL[cat]}</strong>. Tocá un animal para ver su
            historial.
          </span>
          <button className="btn-sm" onClick={clearCat}>
            Ver todos
          </button>
        </div>
      )}

      {/* Filtro por potrero */}
      <label>Potrero</label>
      <select value={loc} onChange={(e) => setLoc(e.target.value)} style={{ marginBottom: 10 }}>
        <option value="">Todos los potreros</option>
        {locations.map((l) => {
          const count = animals.filter((a) => a.currentLocationId === l.id).length;
          return (
            <option key={l.id} value={l.id}>
              {l.name} ({count})
            </option>
          );
        })}
        <option value="none">Sin potrero ({animals.filter((a) => !a.currentLocationId).length})</option>
      </select>

      <input
        placeholder="Buscar por caravana o raza…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {filtered.length === 0 ? (
        <div className="empty">
          {animals.length === 0
            ? 'No hay animales todavía. Tocá + para registrar el primero.'
            : 'No hay animales que coincidan con el filtro.'}
        </div>
      ) : (
        filtered
          .sort((a, b) => a.tagId.localeCompare(b.tagId))
          .map((a) => (
            <Link key={a.id} to={`/animals/${a.id}`} className="list-item">
              <div>
                <div className="title">
                  {a.tagId}{' '}
                  {a._dirty ? <span className="badge dirty">sin sincronizar</span> : null}
                </div>
                <div className="sub">
                  {speciesLabel[a.species]} · {a.breed} · {locName(a.currentLocationId)}
                </div>
              </div>
              <span className="badge">{statusLabel[a.status]}</span>
            </Link>
          ))
      )}

      <Link className="fab" to="/animals/new" aria-label="Registrar animal">
        <span>Nuevo animal</span>
      </Link>
    </div>
  );
}
