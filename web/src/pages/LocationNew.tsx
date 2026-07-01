import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { createLocation } from '../db/repository';
import { locationTypeLabel } from '../lib/labels';
import type { LocationType } from '../lib/types';

export default function LocationNew() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('PASTURE');
  const [capacity, setCapacity] = useState('');
  const [areaHectares, setAreaHectares] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('El nombre es obligatorio');
    if (await db.locations.where('name').equals(name.trim()).first())
      return setError('Ya existe una ubicación con ese nombre');

    setSaving(true);
    try {
      await createLocation({
        name: name.trim(),
        type,
        capacity: capacity ? Number(capacity) : undefined,
        areaHectares: areaHectares ? Number(areaHectares) : undefined,
      });
      navigate('/locations', { replace: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Nuevo potrero / corral</h2>

      <label>Nombre *</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Potrero Norte" />

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
            value={areaHectares}
            onChange={(e) => setAreaHectares(e.target.value)}
            placeholder="12.5"
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn" disabled={saving}>
        💾 {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
