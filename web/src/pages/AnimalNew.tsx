import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createAnimal } from '../db/repository';
import { speciesLabel, sexLabel } from '../lib/labels';
import { TEETH_OPTIONS, teethLabel } from '../lib/ev';
import type { Sex, Species } from '../lib/types';

const today = () => new Date().toISOString().slice(0, 10);

export default function AnimalNew() {
  const navigate = useNavigate();
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);

  const [tagId, setTagId] = useState('');
  const [species, setSpecies] = useState<Species>('BOVINE');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<Sex>('FEMALE');
  const [birthDate, setBirthDate] = useState(today());
  const [initialWeightKg, setInitialWeightKg] = useState('');
  const [currentLocationId, setCurrentLocationId] = useState('');
  const [motherId, setMotherId] = useState('');
  const [fatherId, setFatherId] = useState('');
  const [observations, setObservations] = useState('');
  const [teeth, setTeeth] = useState(''); // '' = automático por edad
  const [entero, setEntero] = useState(false); // macho sin castrar
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const metadata = () => {
    const m: Record<string, unknown> = {};
    if (teeth !== '') m.teeth = Number(teeth);
    if (sex === 'MALE' && entero) m.entero = true;
    return Object.keys(m).length ? m : undefined;
  };

  const byTag = (a: { tagId: string }, b: { tagId: string }) =>
    a.tagId.localeCompare(b.tagId, 'es', { numeric: true });
  const females = animals.filter((a) => a.sex === 'FEMALE').sort(byTag);
  const males = animals.filter((a) => a.sex === 'MALE').sort(byTag);

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
        motherId: motherId || null,
        fatherId: fatherId || null,
        observations: observations.trim() || undefined,
        metadata: metadata(),
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

      <label>Boqueo — dientes (opcional)</label>
      <select value={teeth} onChange={(e) => setTeeth(e.target.value)}>
        <option value="">Automático por edad</option>
        {TEETH_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {teethLabel(t)}
          </option>
        ))}
      </select>

      {sex === 'MALE' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <input type="checkbox" checked={entero} onChange={(e) => setEntero(e.target.checked)} />
          Macho entero (sin castrar)
        </label>
      )}

      <label>Potrero / Ubicación</label>
      <select value={currentLocationId} onChange={(e) => setCurrentLocationId(e.target.value)}>
        <option value="">— Sin asignar —</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <label>Madre (opcional)</label>
      <select value={motherId} onChange={(e) => setMotherId(e.target.value)}>
        <option value="">— Sin registrar —</option>
        {females.map((m) => (
          <option key={m.id} value={m.id}>
            {m.tagId} · {m.breed}
          </option>
        ))}
      </select>

      <label>Padre / Toro (opcional)</label>
      <select value={fatherId} onChange={(e) => setFatherId(e.target.value)}>
        <option value="">— Sin registrar —</option>
        {males.map((p) => (
          <option key={p.id} value={p.id}>
            {p.tagId} · {p.breed}
          </option>
        ))}
      </select>

      <label>Observaciones (opcional)</label>
      <textarea
        rows={3}
        value={observations}
        onChange={(e) => setObservations(e.target.value)}
        placeholder="Cualquier eventualidad: marcas, temperamento, notas sanitarias…"
      />

      {error && <div className="error">{error}</div>}

      <button className="btn" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
