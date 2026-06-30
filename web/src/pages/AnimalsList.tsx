import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { speciesLabel, statusLabel } from '../lib/labels';

export default function AnimalsList() {
  const [q, setQ] = useState('');
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);

  const term = q.trim().toLowerCase();
  const filtered = term
    ? animals.filter(
        (a) => a.tagId.toLowerCase().includes(term) || a.breed.toLowerCase().includes(term),
      )
    : animals;

  return (
    <div>
      <div className="section-title">
        <h2>Animales ({filtered.length})</h2>
      </div>

      <input
        placeholder="Buscar por caravana o raza…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {filtered.length === 0 ? (
        <div className="empty">
          No hay animales todavía.
          <br />
          Tocá el botón + para registrar el primero.
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
                  {speciesLabel[a.species]} · {a.breed}
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
