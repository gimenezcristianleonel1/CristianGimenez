import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { deleteLocation, updateLocation, type LocationEditInput } from '../db/repository';
import { locationTypeLabel } from '../lib/labels';
import type { LocationType } from '../lib/types';

export default function LocationEdit() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLiveQuery(() => db.locations.get(id), [id]);
  const occupancy = useLiveQuery(
    () => db.animals.where('currentLocationId').equals(id).count(),
    [id],
    0,
  );

  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('PASTURE');
  const [capacity, setCapacity] = useState('');
  const [area, setArea] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Inicializa el formulario una sola vez cuando llega el dato.
  if (location && !loaded) {
    setName(location.name);
    setType(location.type);
    setCapacity(location.capacity != null ? String(location.capacity) : '');
    setArea(location.areaHectares != null ? String(Number(location.areaHectares)) : '');
    setLoaded(true);
  }

  if (location === undefined) return <div className="empty">Cargando…</div>;
  if (location === null) return <div className="empty">Potrero no encontrado.</div>;

  async function save() {
    setError('');
    if (!name.trim()) return setError('El nombre es obligatorio');
    const cap = capacity ? Number(capacity) : null;
    if (cap != null && cap < occupancy) {
      return setError(`La capacidad no puede ser menor a la ocupación actual (${occupancy})`);
    }
    const other = await db.locations
      .where('name')
      .equals(name.trim())
      .and((l) => l.id !== id)
      .first();
    if (other) return setError('Ya existe otro potrero con ese nombre');

    const changes: LocationEditInput = {
      name: name.trim(),
      type,
      capacity: cap,
      areaHectares: area ? Number(area) : null,
    };
    setSaving(true);
    try {
      await updateLocation(id, changes);
      navigate('/locations', { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (occupancy > 0) {
      setError(`No se puede eliminar: tiene ${occupancy} animal(es) asignado(s)`);
      return;
    }
    await deleteLocation(id);
    navigate('/locations', { replace: true });
  }

  return (
    <div>
      <Link className="link" to="/locations">
        ← Potreros
      </Link>

      <form className="card" style={{ marginTop: 8 }} onSubmit={(e) => e.preventDefault()}>
        <h2>Editar potrero</h2>
        <div className="sub">Ocupación actual: {occupancy} animal(es)</div>

        <label>Nombre *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />

        <label>Tipo</label>
        <select value={type} onChange={(e) => setType(e.target.value as LocationType)}>
          {(Object.keys(locationTypeLabel) as LocationType[]).map((t) => (
            <option key={t} value={t}>
              {locationTypeLabel[t]}
            </option>
          ))}
        </select>

        <div className="row2">
          <div>
            <label>Capacidad</label>
            <input
              type="number"
              inputMode="numeric"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="50"
            />
          </div>
          <div>
            <label>Hectáreas</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="12.5"
            />
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn" disabled={saving} onClick={() => void save()}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>

        {!confirmDelete ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={occupancy > 0}
            onClick={() => setConfirmDelete(true)}
          >
            {occupancy > 0 ? 'No se puede eliminar (tiene animales)' : '🗑️ Eliminar potrero'}
          </button>
        ) : (
          <div className="row2">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void remove()}>
              Confirmar borrado
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
