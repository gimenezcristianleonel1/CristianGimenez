import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createAnimal } from '../db/repository';
import { speciesLabel, sexLabel } from '../lib/labels';
import type { Sex, Species } from '../lib/types';

const today = () => new Date().toISOString().slice(0, 10);

export default function AnimalNew() {
  const navigate = useNavigate();
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);

  const [tagId, setTagId] = useState('');
  const [species, setSpecies] = useState<Species>('BOVINE');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<Sex>('FEMALE');
  const [birthDate, setBirthDate] = useState(today());
  const [initialWeightKg, setInitialWeightKg] = useState('');
  const [currentLocationId, setCurrentLocationId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!tagId.trim()) return setError('La caravana es obligatoria');
    if (!breed.trim()) return setError('La raza es obligatoria');
    const weight = Number(initialWeightKg);
    if (!(weight > 0)) return setError('El peso inicial debe ser mayor a 0');
    if (new Date(birthDate).getTime() > Date.now())
      return setError('La fecha de nacimiento no puede ser futura');
    if (await db.animals.where('tagId').equals(tagId.trim()).first())
      return setError('Ya existe un animal con esa caravana');

    setSaving(true);
    try {
      const id = await createAnimal({
        tagId: tagId.trim(),
        species,
        breed: breed.trim(),
        sex,
        birthDate: new Date(birthDate).toISOString(),
        initialWeightKg: weight,
        currentLocationId: currentLocationId || null,
      });
      navigate(`/animals/${id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Registrar animal</h2>

      <label>Caravana / Arete *</label>
      <input value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="AR-0001" />

      <div className="row2">
        <div>
          <label>Especie</label>
          <select value={species} onChange={(e) => setSpecies(e.target.value as Species)}>
            {Object.entries(speciesLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Sexo</label>
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            {Object.entries(sexLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label>Raza *</label>
      <input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Angus" />

      <div className="row2">
        <div>
          <label>Nacimiento</label>
          <input type="date" value={birthDate} max={today()} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div>
          <label>Peso inicial (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={initialWeightKg}
            onChange={(e) => setInitialWeightKg(e.target.value)}
            placeholder="45"
          />
        </div>
      </div>

      <label>Potrero / Ubicación</label>
      <select value={currentLocationId} onChange={(e) => setCurrentLocationId(e.target.value)}>
        <option value="">— Sin asignar —</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      {error && <div className="error">{error}</div>}

      <button className="btn" disabled={saving}>
        💾 {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
