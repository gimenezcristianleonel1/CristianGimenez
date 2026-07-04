import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  addHealth,
  addWeight,
  changeAnimalStatus,
  createAnimal,
  createAnimalEvent,
  createReproEvent,
} from '../db/repository';
import { sexLabel, speciesLabel } from '../lib/labels';
import type { Animal, Sex, Species } from '../lib/types';

/** Acciones que se registran a diario en el campo. */
type FieldAction =
  | 'VACCINATION'
  | 'DEWORMING'
  | 'TREATMENT'
  | 'WEIGHT'
  | 'SERVICE'
  | 'NOTE'
  | 'DEATH'
  | 'BIRTH';

const ACTIONS: Array<{ key: FieldAction; label: string }> = [
  { key: 'VACCINATION', label: 'Vacunación' },
  { key: 'DEWORMING', label: 'Desparasitación' },
  { key: 'TREATMENT', label: 'Tratamiento' },
  { key: 'WEIGHT', label: 'Pesaje' },
  { key: 'SERVICE', label: 'Servicio' },
  { key: 'NOTE', label: 'Nota' },
  { key: 'DEATH', label: 'Muerte' },
  { key: 'BIRTH', label: 'Nacimiento' },
];

const HEALTH_ACTIONS: FieldAction[] = ['VACCINATION', 'DEWORMING', 'TREATMENT'];
const todayStr = () => new Date().toISOString().slice(0, 10);
/**
 * Fecha (yyyy-mm-dd) → ISO. Para HOY usa el instante actual (así nunca queda en
 * el futuro y pasa la validación del backend); para días pasados, el mediodía
 * local (evita corrimientos de día por zona horaria).
 */
const toIso = (d: string): string =>
  d >= todayStr() ? new Date().toISOString() : new Date(`${d}T12:00:00`).toISOString();

/** Buscador de animal por caravana (combobox offline sobre IndexedDB). */
function AnimalPicker({
  animals,
  value,
  onChange,
  placeholder = 'Buscar por caravana…',
}: {
  animals: Animal[];
  value: Animal | null;
  onChange: (a: Animal | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return animals.slice(0, 8);
    return animals.filter((a) => a.tagId.toLowerCase().includes(q)).slice(0, 8);
  }, [animals, query]);

  if (value) {
    return (
      <div className="picker-selected">
        <span>
          <strong>{value.tagId}</strong> · {speciesLabel[value.species]} · {sexLabel[value.sex]}
        </span>
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            onChange(null);
            setQuery('');
          }}
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="picker">
      <input
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && matches.length > 0 && (
        <div className="picker-list">
          {matches.map((a) => (
            <button
              type="button"
              key={a.id}
              className="picker-item"
              onClick={() => {
                onChange(a);
                setOpen(false);
              }}
            >
              <strong>{a.tagId}</strong>
              <span className="sub">
                {speciesLabel[a.species]} · {sexLabel[a.sex]} · {a.breed}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && matches.length === 0 && (
        <div className="picker-empty">Sin coincidencias para “{query}”.</div>
      )}
    </div>
  );
}

/**
 * Registro rápido de trabajo hecho en el campo sobre un animal existente
 * (o uno nuevo si nació): vacuna, desparasitación, tratamiento, pesaje,
 * servicio, nota, muerte o nacimiento. Todo offline-first (se encola y sincroniza).
 */
export default function FieldRecorder() {
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);

  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<FieldAction>('VACCINATION');
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Animal objetivo (acciones sobre existente).
  const [animal, setAnimal] = useState<Animal | null>(null);

  // Campos específicos de sanidad / pesaje / nota / servicio.
  const [medication, setMedication] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState('0');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [sireTagId, setSireTagId] = useState('');

  // Campos de "Nacimiento" (alta de un animal nuevo).
  const [tagId, setTagId] = useState('');
  const [sex, setSex] = useState<Sex>('FEMALE');
  const [species, setSpecies] = useState<Species>('BOVINE');
  const [breed, setBreed] = useState('');
  const [birthWeight, setBirthWeight] = useState('');
  const [locationId, setLocationId] = useState('');
  const [mother, setMother] = useState<Animal | null>(null);

  const activeAnimals = useMemo(
    () =>
      [...animals]
        .filter((a) => a.status !== 'SOLD' && a.status !== 'DECEASED')
        .sort((a, b) => a.tagId.localeCompare(b.tagId, 'es', { numeric: true })),
    [animals],
  );
  const females = useMemo(
    () => activeAnimals.filter((a) => a.sex === 'FEMALE'),
    [activeAnimals],
  );

  function resetFields() {
    setAnimal(null);
    setMedication('');
    setWithdrawalDays('0');
    setWeight('');
    setNote('');
    setSireTagId('');
    setTagId('');
    setBreed('');
    setBirthWeight('');
    setMother(null);
    setError('');
  }

  function pickAction(a: FieldAction) {
    setAction(a);
    resetFields();
    setMsg('');
  }

  async function save() {
    setError('');
    setMsg('');
    const iso = toIso(date);

    // --- Nacimiento: alta de animal nuevo -----------------------------------
    if (action === 'BIRTH') {
      const tag = tagId.trim();
      if (!tag) return setError('La caravana de la cría es obligatoria');
      if (await db.animals.where('tagId').equals(tag).first()) {
        return setError('Ya existe un animal con esa caravana');
      }
      const w = Number(birthWeight);
      setBusy(true);
      try {
        await createAnimal({
          tagId: tag,
          species,
          breed: breed.trim() || 'Sin especificar',
          sex,
          birthDate: iso,
          entryDate: iso,
          initialWeightKg: w > 0 ? w : 1,
          currentLocationId: locationId || mother?.currentLocationId || undefined,
          motherId: mother?.id ?? undefined,
        });
        // Si se indicó la madre, registramos su parición (queda con cría al pie).
        if (mother) {
          await createReproEvent({
            animalId: mother.id,
            type: 'PARICION',
            offspringTagId: tag,
            date: iso,
          });
        }
        setMsg(`Nacimiento registrado: ${tag}${mother ? ` (madre ${mother.tagId})` : ''}.`);
        resetFields();
      } finally {
        setBusy(false);
      }
      return;
    }

    // --- Acciones sobre un animal existente ----------------------------------
    if (!animal) return setError('Elegí un animal (buscá por caravana)');

    setBusy(true);
    try {
      if (HEALTH_ACTIONS.includes(action)) {
        if (action === 'TREATMENT' && !medication.trim()) {
          setBusy(false);
          return setError('Indicá el medicamento del tratamiento');
        }
        await addHealth(animal.id, {
          eventType: action as 'VACCINATION' | 'DEWORMING' | 'TREATMENT',
          medication: medication.trim() || undefined,
          withdrawalDays: Number(withdrawalDays) || 0,
          appliedAt: iso,
        });
        setMsg(`Registrado en ${animal.tagId}.`);
      } else if (action === 'WEIGHT') {
        const w = Number(weight);
        if (!(w > 0)) {
          setBusy(false);
          return setError('El peso debe ser mayor a 0');
        }
        await addWeight(animal.id, { weightKg: w, measuredAt: iso });
        setMsg(`Pesaje de ${w} kg registrado en ${animal.tagId}.`);
      } else if (action === 'SERVICE') {
        await createReproEvent({
          animalId: animal.id,
          type: 'SERVICIO',
          sireTagId: sireTagId.trim() || undefined,
          date: iso,
        });
        setMsg(`Servicio registrado en ${animal.tagId}.`);
      } else if (action === 'NOTE') {
        if (!note.trim()) {
          setBusy(false);
          return setError('Escribí la nota / observación');
        }
        await createAnimalEvent({ animalId: animal.id, type: 'NOTA', note: note.trim(), date: iso });
        setMsg(`Nota registrada en ${animal.tagId}.`);
      } else if (action === 'DEATH') {
        await changeAnimalStatus(animal.id, 'DECEASED');
        await createAnimalEvent({
          animalId: animal.id,
          type: 'MUERTE',
          note: note.trim() || undefined,
          date: iso,
        });
        setMsg(`Baja por muerte registrada: ${animal.tagId}.`);
      }
      resetFields();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setOpen(true)}>
        Registrar trabajo en el campo
      </button>
    );
  }

  const isHealth = HEALTH_ACTIONS.includes(action);

  return (
    <div className="card">
      <div className="section-title" style={{ margin: 0 }}>
        <h2>Registrar en el campo</h2>
        <button className="btn-link" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        Anotá lo que pasó hoy (vacuna, tratamiento, muerte, nacimiento…) sobre un animal existente o
        uno nuevo si nació.
      </p>

      {/* Selector de acción */}
      <div className="chip-row">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            className={`chip ${action === a.key ? 'chip-active' : ''}`}
            onClick={() => pickAction(a.key)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Animal objetivo (todas las acciones menos Nacimiento) */}
      {action !== 'BIRTH' && (
        <>
          <label>Animal *</label>
          <AnimalPicker animals={activeAnimals} value={animal} onChange={setAnimal} />
        </>
      )}

      {/* Campos por acción */}
      {isHealth && (
        <div className="row2">
          <div>
            <label>Medicamento {action === 'TREATMENT' ? '*' : ''}</label>
            <input
              value={medication}
              onChange={(e) => setMedication(e.target.value)}
              placeholder="Ivermectina"
            />
          </div>
          <div>
            <label>Carencia (días)</label>
            <input
              type="number"
              inputMode="numeric"
              value={withdrawalDays}
              onChange={(e) => setWithdrawalDays(e.target.value)}
            />
          </div>
        </div>
      )}

      {action === 'WEIGHT' && (
        <>
          <label>Peso (kg) *</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="320"
          />
        </>
      )}

      {action === 'SERVICE' && (
        <>
          <label>Toro / padre (caravana, opcional)</label>
          <input value={sireTagId} onChange={(e) => setSireTagId(e.target.value)} placeholder="T-01" />
        </>
      )}

      {(action === 'NOTE' || action === 'DEATH') && (
        <>
          <label>{action === 'DEATH' ? 'Causa / detalle (opcional)' : 'Nota *'}</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={action === 'DEATH' ? 'Ej. enfermedad, accidente…' : 'Ej. cojera pata trasera'}
          />
        </>
      )}

      {action === 'BIRTH' && (
        <>
          <label>Caravana de la cría *</label>
          <input value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="AR-0500" />
          <div className="row2">
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
          </div>
          <div className="row2">
            <div>
              <label>Raza</label>
              <input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Angus" />
            </div>
            <div>
              <label>Peso al nacer (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={birthWeight}
                onChange={(e) => setBirthWeight(e.target.value)}
                placeholder="35"
              />
            </div>
          </div>
          <label>Madre (opcional)</label>
          <AnimalPicker
            animals={females}
            value={mother}
            onChange={setMother}
            placeholder="Buscar madre por caravana…"
          />
          <label>Potrero (opcional)</label>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">— {mother ? 'Mismo que la madre' : 'Sin asignar'} —</option>
            {[...locations]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </>
      )}

      <label style={{ marginTop: 10 }}>Fecha</label>
      <input type="date" max={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />

      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}

      <button className="btn" disabled={busy} onClick={() => void save()}>
        {busy ? 'Guardando…' : 'Registrar'}
      </button>
    </div>
  );
}
