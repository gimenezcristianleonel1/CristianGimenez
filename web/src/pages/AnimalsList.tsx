import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { speciesLabel, statusLabel } from '../lib/labels';

export default function AnimalsList() {
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState(''); // '' = todos · 'none' = sin potrero · <id>
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);

  const term = q.trim().toLowerCase();
  const filtered = animals.filter((a) => {
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
        <h2>Animales ({filtered.length})</h2>
      </div>

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
                  {speciesLabel[a.species]} · {a.breed} · 📍 {locName(a.currentLocationId)}
                </div>
              </div>
              <span className="badge">{statusLabel[a.status]}</span>
            </Link>
          ))
      )}

      <Link className="fab" to="/animals/new" aria-label="Registrar animal">
        +
      </Link>
    </div>
  );
}
