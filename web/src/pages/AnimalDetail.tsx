import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  addHealth,
  addWeight,
  changeAnimalStatus,
  moveAnimal,
  updateAnimal,
  type AnimalEditInput,
} from '../db/repository';
import { averageDailyGain } from '../lib/gdp';
import {
  fmtDate,
  healthEventLabel,
  movementReasonLabel,
  sexLabel,
  speciesLabel,
  statusLabel,
} from '../lib/labels';
import type {
  Animal,
  AnimalStatus,
  HealthEventType,
  HealthRow,
  LocationRow,
  MovementRow,
  Sex,
  Species,
  WeightRow,
} from '../lib/types';

type Tab = 'weights' | 'health' | 'movements';

export default function AnimalDetail() {
  const { id = '' } = useParams();
  const animal = useLiveQuery(() => db.animals.get(id), [id]);
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);
  const weights = useLiveQuery(
    () => db.weights.where('animalId').equals(id).toArray(),
    [id],
    [],
  );
  const health = useLiveQuery(() => db.health.where('animalId').equals(id).toArray(), [id], []);
  const movements = useLiveQuery(
    () => db.movements.where('animalId').equals(id).toArray(),
    [id],
    [],
  );
  const [tab, setTab] = useState<Tab>('weights');
  const [editing, setEditing] = useState(false);

  if (animal === undefined) return <div className="empty">Cargando…</div>;
  if (animal === null) return <div className="empty">Animal no encontrado.</div>;

  const locName = (lid?: string | null) =>
    lid ? (locations.find((l) => l.id === lid)?.name ?? '—') : '—';
  const adg = averageDailyGain(weights);
  const lastWeight = [...weights].sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  )[0];

  return (
    <div>
      <Link className="link" to="/animals">
        ← Animales
      </Link>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="section-title">
          <h2>
            {animal.tagId} {animal._dirty ? <span className="badge dirty">sin sync</span> : null}
          </h2>
          <span className="badge">{statusLabel[animal.status]}</span>
        </div>

        {editing ? (
          <AnimalEditForm
            animal={animal}
            onCancel={() => setEditing(false)}
            onSave={async (changes) => {
              await updateAnimal(id, changes);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <div className="sub">
              {speciesLabel[animal.species]} · {animal.breed} · {sexLabel[animal.sex]}
            </div>
            <div className="sub">Nacimiento: {fmtDate(animal.birthDate)}</div>
            <div className="sub">Peso inicial: {Number(animal.initialWeightKg)} kg</div>
            <div className="sub">Ubicación: {locName(animal.currentLocationId)}</div>
            <div className="sub">
              Último peso: {lastWeight ? `${Number(lastWeight.weightKg)} kg` : '—'}
              {adg !== null ? ` · GDP: ${adg} kg/día` : ''}
            </div>
            {animal.observations ? (
              <div className="sub" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                📝 <strong>Observaciones:</strong> {animal.observations}
              </div>
            ) : null}

            <button className="btn btn-outline" onClick={() => setEditing(true)}>
              ✏️ Editar datos
            </button>

            <label>Cambiar estado</label>
            <StatusChanger current={animal.status} onChange={(s) => changeAnimalStatus(id, s)} />
          </>
        )}
      </div>

      <div className="tabs">
        <button className={tab === 'weights' ? 'tab active' : 'tab'} onClick={() => setTab('weights')}>
          Pesajes ({weights.length})
        </button>
        <button className={tab === 'health' ? 'tab active' : 'tab'} onClick={() => setTab('health')}>
          Sanidad ({health.length})
        </button>
        <button
          className={tab === 'movements' ? 'tab active' : 'tab'}
          onClick={() => setTab('movements')}
        >
          Movim. ({movements.length})
        </button>
      </div>

      {tab === 'weights' && <WeightsTab animalId={id} weights={weights} />}
      {tab === 'health' && <HealthTab animalId={id} health={health} />}
      {tab === 'movements' && (
        <MovementsTab
          animalId={id}
          movements={movements}
          locName={locName}
          locations={locations.filter((l) => l.id !== animal.currentLocationId)}
        />
      )}
    </div>
  );
}

function StatusChanger({
  current,
  onChange,
}: {
  current: AnimalStatus;
  onChange: (s: AnimalStatus) => Promise<void>;
}) {
  const [value, setValue] = useState<AnimalStatus>(current);
  return (
    <div className="row2">
      <select value={value} onChange={(e) => setValue(e.target.value as AnimalStatus)}>
        {(Object.keys(statusLabel) as AnimalStatus[]).map((s) => (
          <option key={s} value={s}>
            {statusLabel[s]}
          </option>
        ))}
      </select>
      <button
        className="btn"
        style={{ marginTop: 0 }}
        disabled={value === current}
        onClick={() => void onChange(value)}
      >
        Aplicar
      </button>
    </div>
  );
}

function WeightsTab({ animalId, weights }: { animalId: string; weights: WeightRow[] }) {
  const [kg, setKg] = useState('');
  const sorted = [...weights].sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  );
  async function add() {
    const w = Number(kg);
    if (!(w > 0)) return;
    await addWeight(animalId, { weightKg: w, source: 'MANUAL' });
    setKg('');
  }
  return (
    <div className="card">
      <h2>Registrar pesaje</h2>
      <div className="row2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="Peso (kg)"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
        />
        <button className="btn" style={{ marginTop: 0 }} onClick={() => void add()}>
          + Agregar
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">Sin pesajes.</div>
      ) : (
        sorted.map((w) => (
          <div key={w.id} className="list-item">
            <div>
              <div className="title">{Number(w.weightKg)} kg</div>
              <div className="sub">{fmtDate(w.measuredAt)}</div>
            </div>
            {w._dirty ? <span className="badge dirty">sin sync</span> : null}
          </div>
        ))
      )}
    </div>
  );
}

function HealthTab({ animalId, health }: { animalId: string; health: HealthRow[] }) {
  const [eventType, setEventType] = useState<HealthEventType>('VACCINATION');
  const [medication, setMedication] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState('0');
  const [error, setError] = useState('');
  const needsMed = ['VACCINATION', 'DEWORMING', 'TREATMENT'].includes(eventType);
  const sorted = [...health].sort(
    (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
  );

  async function add() {
    setError('');
    if (needsMed && !medication.trim())
      return setError('El medicamento es obligatorio para este evento');
    await addHealth(animalId, {
      eventType,
      medication: medication.trim() || undefined,
      withdrawalDays: Number(withdrawalDays) || 0,
    });
    setMedication('');
    setWithdrawalDays('0');
  }

  return (
    <div className="card">
      <h2>Registrar evento sanitario</h2>
      <label>Tipo</label>
      <select value={eventType} onChange={(e) => setEventType(e.target.value as HealthEventType)}>
        {(Object.keys(healthEventLabel) as HealthEventType[]).map((t) => (
          <option key={t} value={t}>
            {healthEventLabel[t]}
          </option>
        ))}
      </select>
      <div className="row2">
        <div>
          <label>Medicamento {needsMed ? '*' : ''}</label>
          <input value={medication} onChange={(e) => setMedication(e.target.value)} placeholder="Aftosa" />
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
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={() => void add()}>
        + Registrar
      </button>

      {sorted.map((h) => {
        const active = h.withdrawalUntil && new Date(h.withdrawalUntil).getTime() > Date.now();
        return (
          <div key={h.id} className="list-item">
            <div>
              <div className="title">
                {healthEventLabel[h.eventType]} {h.medication ? `· ${h.medication}` : ''}
              </div>
              <div className="sub">
                {fmtDate(h.appliedAt)}
                {h.withdrawalUntil ? ` · carencia hasta ${fmtDate(h.withdrawalUntil)}` : ''}
              </div>
            </div>
            {active ? <span className="badge danger">en carencia</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function MovementsTab({
  animalId,
  movements,
  locName,
  locations,
}: {
  animalId: string;
  movements: MovementRow[];
  locName: (id?: string | null) => string;
  locations: LocationRow[];
}) {
  const [toLocationId, setToLocationId] = useState('');
  const sorted = [...movements].sort(
    (a, b) => new Date(b.movedAt).getTime() - new Date(a.movedAt).getTime(),
  );
  async function move() {
    if (!toLocationId) return;
    await moveAnimal(animalId, { toLocationId, reason: 'ROTATION' });
    setToLocationId('');
  }
  return (
    <div className="card">
      <h2>Mover de potrero</h2>
      <div className="row2">
        <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)}>
          <option value="">— Destino —</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button className="btn" style={{ marginTop: 0 }} disabled={!toLocationId} onClick={() => void move()}>
          🚚 Mover
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">Sin movimientos.</div>
      ) : (
        sorted.map((m) => (
          <div key={m.id} className="list-item">
            <div>
              <div className="title">
                {locName(m.fromLocationId)} → {locName(m.toLocationId)}
              </div>
              <div className="sub">
                {fmtDate(m.movedAt)}
                {m.reason ? ` · ${movementReasonLabel[m.reason]}` : ''}
              </div>
            </div>
            {m._dirty ? <span className="badge dirty">sin sync</span> : null}
          </div>
        ))
      )}
    </div>
  );
}

function AnimalEditForm({
  animal,
  onSave,
  onCancel,
}: {
  animal: Animal;
  onSave: (changes: AnimalEditInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [tagId, setTagId] = useState(animal.tagId);
  const [species, setSpecies] = useState<Species>(animal.species);
  const [breed, setBreed] = useState(animal.breed);
  const [sex, setSex] = useState<Sex>(animal.sex);
  const [birthDate, setBirthDate] = useState(animal.birthDate.slice(0, 10));
  const [weight, setWeight] = useState(String(Number(animal.initialWeightKg)));
  const [observations, setObservations] = useState(animal.observations ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function save() {
    setError('');
    if (!tagId.trim()) return setError('La caravana es obligatoria');
    if (!breed.trim()) return setError('La raza es obligatoria');
    const w = Number(weight);
    if (!(w > 0)) return setError('El peso debe ser mayor a 0');
    if (birthDate > today) return setError('La fecha de nacimiento no puede ser futura');

    // Sólo enviamos lo que cambió.
    const changes: AnimalEditInput = {};
    if (tagId.trim() !== animal.tagId) changes.tagId = tagId.trim();
    if (species !== animal.species) changes.species = species;
    if (breed.trim() !== animal.breed) changes.breed = breed.trim();
    if (sex !== animal.sex) changes.sex = sex;
    if (birthDate !== animal.birthDate.slice(0, 10)) {
      changes.birthDate = new Date(birthDate).toISOString();
    }
    if (w !== Number(animal.initialWeightKg)) changes.initialWeightKg = w;
    if (observations.trim() !== (animal.observations ?? '').trim()) {
      changes.observations = observations.trim();
    }

    setSaving(true);
    try {
      await onSave(changes);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label>Caravana *</label>
      <input value={tagId} onChange={(e) => setTagId(e.target.value)} />
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
      <input value={breed} onChange={(e) => setBreed(e.target.value)} />
      <div className="row2">
        <div>
          <label>Nacimiento</label>
          <input type="date" max={today} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div>
          <label>Peso inicial (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      </div>
      <label>Observaciones (opcional)</label>
      <textarea
        rows={3}
        value={observations}
        onChange={(e) => setObservations(e.target.value)}
        placeholder="Cualquier eventualidad: marcas, temperamento, notas sanitarias…"
      />
      {error && <div className="error">{error}</div>}
      <div className="row2">
        <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => void save()} disabled={saving}>
          💾 {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
