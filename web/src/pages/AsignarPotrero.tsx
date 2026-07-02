import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { bulkMoveAnimals } from '../db/repository';
import { speciesLabel } from '../lib/labels';

/**
 * Asignación MASIVA de animales a un potrero.
 * Por defecto lista las caravanas SIN potrero asignado (para ubicarlas), y
 * también permite mover en bloque desde otro potrero. Selección múltiple con
 * "seleccionar todos" y buscador por caravana/raza.
 */
export default function AsignarPotrero() {
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);

  const [source, setSource] = useState('none'); // 'none' = sin potrero · <id>
  const [dest, setDest] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState('');

  const potreros = [...locations].sort((a, b) => a.name.localeCompare(b.name));
  const unassignedCount = animals.filter((a) => a.status === 'ACTIVE' && !a.currentLocationId).length;

  const term = q.trim().toLowerCase();
  const candidates = useMemo(
    () =>
      animals
        .filter((a) => a.status === 'ACTIVE')
        .filter((a) => (source === 'none' ? !a.currentLocationId : a.currentLocationId === source))
        .filter((a) => a.currentLocationId !== dest || !dest)
        .filter(
          (a) =>
            !term ||
            a.tagId.toLowerCase().includes(term) ||
            a.breed.toLowerCase().includes(term),
        )
        .sort((a, b) => a.tagId.localeCompare(b.tagId, 'es', { numeric: true })),
    [animals, source, dest, term],
  );

  const candidateIds = candidates.map((a) => a.id);
  const selectedCount = candidateIds.filter((id) => sel.has(id)).length;
  const allSelected = candidates.length > 0 && selectedCount === candidates.length;
  const destName = potreros.find((p) => p.id === dest)?.name ?? '';

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectAll = () => setSel(new Set(candidateIds));
  const selectNone = () => setSel(new Set());

  async function assign() {
    setError('');
    setDone(null);
    if (!dest) return setError('Elegí el potrero de destino');
    const ids = candidateIds.filter((id) => sel.has(id));
    if (ids.length === 0) return setError('Seleccioná al menos un animal');
    setSaving(true);
    try {
      const n = await bulkMoveAnimals(ids, dest, 'REGROUPING');
      setDone(n);
      setSel(new Set());
    } catch {
      setError('No se pudo asignar. Probá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="section-title">
        <h2>Asignar animales a un potrero</h2>
      </div>

      <div className="card">
        <label>Destino (potrero)</label>
        <select value={dest} onChange={(e) => setDest(e.target.value)}>
          <option value="">— Elegí el potrero —</option>
          {potreros.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label style={{ marginTop: 10 }}>¿De dónde salen?</label>
        <select value={source} onChange={(e) => { setSource(e.target.value); selectNone(); }}>
          <option value="none">Sin potrero asignado ({unassignedCount})</option>
          {potreros
            .filter((p) => p.id !== dest)
            .map((p) => (
              <option key={p.id} value={p.id}>
                Desde: {p.name}
              </option>
            ))}
        </select>
      </div>

      {done !== null && (
        <div className="ok">
          Listo: se asignaron <strong>{done}</strong> animal(es){destName ? ` a ${destName}` : ''}.
        </div>
      )}

      <input
        placeholder="Buscar por caravana o raza…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 10 }}
      />

      <div className="section-title" style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: '1rem' }}>
          {source === 'none' ? 'Caravanas sin potrero' : 'Animales del potrero'} ({candidates.length})
        </h2>
        {candidates.length > 0 && (
          <button className="btn-link" onClick={allSelected ? selectNone : selectAll}>
            {allSelected ? 'Ninguno' : 'Seleccionar todos'}
          </button>
        )}
      </div>

      {candidates.length === 0 ? (
        <div className="empty">
          {source === 'none'
            ? 'No hay animales sin potrero. ¡Están todos ubicados!'
            : 'Ese potrero no tiene animales activos.'}
        </div>
      ) : (
        candidates.map((a) => {
          const checked = sel.has(a.id);
          return (
            <label
              key={a.id}
              className="list-item"
              style={{ cursor: 'pointer', borderColor: checked ? 'var(--brand)' : undefined }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(a.id)} />
                <div>
                  <div className="title">{a.tagId}</div>
                  <div className="sub">
                    {speciesLabel[a.species]} · {a.breed}
                  </div>
                </div>
              </div>
              {a._dirty ? <span className="badge dirty">sin sync</span> : null}
            </label>
          );
        })
      )}

      {error && <div className="error">{error}</div>}

      {candidates.length > 0 && (
        <button
          className="btn"
          disabled={saving || !dest || selectedCount === 0}
          onClick={() => void assign()}
          style={{ position: 'sticky', bottom: 12, marginTop: 12 }}
        >
          {saving
            ? 'Asignando…'
            : `Asignar ${selectedCount} animal(es)${destName ? ` a ${destName}` : ''}`}
        </button>
      )}
    </div>
  );
}
