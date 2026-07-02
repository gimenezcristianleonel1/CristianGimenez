import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  addHealth,
  addWeight,
  changeAnimalStatus,
  createAnimalEvent,
  deleteAnimal,
  moveAnimal,
  updateAnimal,
  type AnimalEditInput,
} from '../db/repository';
import { averageDailyGain } from '../lib/gdp';
import { classifyStage, reproCountsByAnimal, STAGE_LABEL, ageInMonths } from '../lib/ev';
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
  AnimalEventRow,
  AnimalStatus,
  HealthEventType,
  HealthRow,
  LocationRow,
  MovementRow,
  ReproCheckRow,
  ReproEventRow,
  Sex,
  Species,
  WeightRow,
} from '../lib/types';

type Tab = 'history' | 'weights' | 'health' | 'movements' | 'events';

export default function AnimalDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
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
  const animalEvents = useLiveQuery(
    () => db.animalEvents.where('animalId').equals(id).toArray(),
    [id],
    [],
  );
  const reproChecks = useLiveQuery(
    () => db.reproChecks.where('animalId').equals(id).toArray(),
    [id],
    [],
  );
  const reproEvents = useLiveQuery(
    () => db.reproEvents.where('animalId').equals(id).toArray(),
    [id],
    [],
  );
  const [tab, setTab] = useState<Tab>('history');
  const [editing, setEditing] = useState(false);

  if (animal === undefined) return <div className="empty">Cargando…</div>;
  if (animal === null) return <div className="empty">Animal no encontrado.</div>;

  const locName = (lid?: string | null) =>
    lid ? (locations.find((l) => l.id === lid)?.name ?? '—') : '—';
  const adg = averageDailyGain(weights);
  const lastWeight = [...weights].sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  )[0];
  // Categoría/estado actual, calculado en vivo por edad + eventos reproductivos.
  const stage = classifyStage(animal, reproCountsByAnimal(reproEvents).get(id));
  const months = ageInMonths(animal.birthDate);
  const ageText =
    months >= 12
      ? `${Math.floor(months / 12)} año(s)${months % 12 ? ` ${months % 12} m` : ''}`
      : `${months} mes(es)`;

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
            <div className="sub" style={{ marginTop: 4 }}>
              <span className="badge">{STAGE_LABEL[stage]}</span>{' '}
              <span className="muted">· categoría automática por edad ({ageText}) e historia reproductiva</span>
            </div>
            <div className="sub">Nacimiento: {fmtDate(animal.birthDate)}</div>
            <div className="sub">Peso inicial: {Number(animal.initialWeightKg)} kg</div>
            <div className="sub">
              Último peso: {lastWeight ? `${Number(lastWeight.weightKg)} kg` : '—'}
              {adg !== null ? ` · GDP: ${adg} kg/día` : ''}
            </div>
            {animal.observations ? (
              <div className="sub" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                <strong>Observaciones:</strong> {animal.observations}
              </div>
            ) : null}

            {/* Cambiar potrero directo desde el animal (un toque, deja traza). */}
            <label>Potrero</label>
            <select
              value={animal.currentLocationId ?? ''}
              onChange={(e) => {
                const to = e.target.value;
                if (to && to !== animal.currentLocationId) {
                  void moveAnimal(id, { toLocationId: to, reason: 'ROTATION' });
                }
              }}
            >
              <option value="">— Sin asignar —</option>
              {locations
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>

            <button className="btn btn-outline" onClick={() => setEditing(true)}>
              Editar datos
            </button>

            <label>Cambiar estado</label>
            <StatusChanger current={animal.status} onChange={(s) => changeAnimalStatus(id, s)} />

            <button
              className="btn btn-danger"
              onClick={() => {
                if (
                  window.confirm(
                    `¿Eliminar el animal ${animal.tagId}? Se borran también sus pesajes, sanidad, ` +
                      'movimientos y novedades. Esta acción no se puede deshacer.',
                  )
                ) {
                  void deleteAnimal(id).then(() => navigate('/animals', { replace: true }));
                }
              }}
            >
              Eliminar animal
            </button>
          </>
        )}
      </div>

      <div className="tabs">
        <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
          Historia
        </button>
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
        <button className={tab === 'events' ? 'tab active' : 'tab'} onClick={() => setTab('events')}>
          Novedades ({animalEvents.length})
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
      {tab === 'events' && (
        <EventsTab
          animalId={id}
          currentTag={animal.tagId}
          events={animalEvents}
          locations={locations.filter((l) => l.id !== animal.currentLocationId)}
        />
      )}
      {tab === 'history' && (
        <HistoryTab
          animal={animal}
          weights={weights}
          health={health}
          movements={movements}
          events={animalEvents}
          reproChecks={reproChecks}
          reproEvents={reproEvents}
          locName={locName}
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
          Mover
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
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

const EVENT_META: Record<AnimalEventRow['type'], { icon: string; label: string }> = {
  NOTA: { icon: '', label: 'Nota' },
  CONDICION_CORPORAL: { icon: '', label: 'Condición corporal' },
  PARTO: { icon: '', label: 'Parto' },
  ABORTO: { icon: '', label: 'Aborto' },
  MUERTE: { icon: '', label: 'Muerte' },
  TRATAMIENTO: { icon: '', label: 'Tratamiento' },
  CAMBIO_LOTE: { icon: '', label: 'Cambio de lote' },
  CAMBIO_CARAVANA: { icon: '', label: 'Cambio de caravana' },
  INGRESO: { icon: '', label: 'Ingreso' },
  EGRESO: { icon: '', label: 'Egreso / Venta' },
  REVISION_TORO: { icon: '', label: 'Revisión de toro' },
  OTRO: { icon: '•', label: 'Otro' },
};

/** Detalle inline de un evento según su tipo (CC, peso, destino, cambio de caravana). */
function eventExtra(ev: AnimalEventRow): string {
  const bits: string[] = [];
  if (ev.type === 'CONDICION_CORPORAL' && ev.score != null) bits.push(`CC ${Number(ev.score)}`);
  if (ev.weightKg != null) bits.push(`${Number(ev.weightKg)} kg`);
  if (ev.type === 'CAMBIO_LOTE' && ev.data?.toName) bits.push(`→ ${ev.data.toName as string}`);
  if (ev.type === 'CAMBIO_CARAVANA' && ev.data?.to) bits.push(`${ev.data.from as string} → ${ev.data.to as string}`);
  return bits.length ? ` · ${bits.join(' · ')}` : '';
}

type EvMode =
  | 'NOTA'
  | 'CONDICION_CORPORAL'
  | 'ABORTO'
  | 'MUERTE'
  | 'TRATAMIENTO'
  | 'CAMBIO_LOTE'
  | 'CAMBIO_CARAVANA'
  | 'EGRESO'
  | 'REVISION_TORO';

function EventsTab({
  animalId,
  currentTag,
  events,
  locations,
}: {
  animalId: string;
  currentTag: string;
  events: AnimalEventRow[];
  locations: LocationRow[];
}) {
  const [mode, setMode] = useState<EvMode>('NOTA');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [score, setScore] = useState('3');
  const [weight, setWeight] = useState('');
  const [destId, setDestId] = useState('');
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const iso = () => new Date(date + 'T12:00:00').toISOString();
  const noteLabel = mode === 'NOTA' || mode === 'TRATAMIENTO' ? 'Detalle *' : 'Observación (opcional)';

  function reset() {
    setNote('');
    setWeight('');
    setDestId('');
    setNewTag('');
  }

  async function add() {
    setError('');
    const needsNote = mode === 'NOTA' || mode === 'TRATAMIENTO';
    if (needsNote && !note.trim()) return setError('Escribí el detalle');
    if (mode === 'CAMBIO_LOTE' && !destId) return setError('Elegí el potrero de destino');
    if (mode === 'CAMBIO_CARAVANA' && !newTag.trim()) return setError('Escribí la nueva caravana');
    const w = weight ? Number(weight) : undefined;
    if (mode === 'CONDICION_CORPORAL' && w !== undefined && !(w > 0)) {
      return setError('El peso debe ser mayor a 0');
    }

    setSaving(true);
    try {
      if (mode === 'CONDICION_CORPORAL') {
        await createAnimalEvent({
          animalId, type: 'CONDICION_CORPORAL', score: Number(score), weightKg: w,
          note: note.trim() || undefined, date: iso(),
        });
        if (w !== undefined) await addWeight(animalId, { weightKg: w, source: 'MANUAL' });
      } else if (mode === 'CAMBIO_LOTE') {
        const dest = locations.find((l) => l.id === destId);
        await createAnimalEvent({
          animalId, type: 'CAMBIO_LOTE', note: note.trim() || undefined, date: iso(),
          data: { toLocationId: destId, toName: dest?.name },
        });
        // Efecto: mueve el animal de verdad (actualiza ubicación + traza el movimiento).
        await moveAnimal(animalId, { toLocationId: destId, reason: 'ROTATION', movedAt: iso(), notes: note.trim() || undefined });
      } else if (mode === 'CAMBIO_CARAVANA') {
        const to = newTag.trim();
        await createAnimalEvent({
          animalId, type: 'CAMBIO_CARAVANA', note: note.trim() || undefined, date: iso(),
          data: { from: currentTag, to },
        });
        // Efecto: actualiza la caravana del animal (la anterior queda en el historial).
        await updateAnimal(animalId, { tagId: to });
      } else if (mode === 'MUERTE') {
        await createAnimalEvent({ animalId, type: 'MUERTE', note: note.trim() || undefined, date: iso() });
        await changeAnimalStatus(animalId, 'DECEASED'); // baja → el stock se actualiza solo
      } else if (mode === 'EGRESO') {
        await createAnimalEvent({ animalId, type: 'EGRESO', note: note.trim() || undefined, date: iso() });
        await changeAnimalStatus(animalId, 'SOLD'); // egreso/venta → sale del stock
      } else {
        // NOTA / ABORTO / TRATAMIENTO / REVISION_TORO
        await createAnimalEvent({ animalId, type: mode, note: note.trim() || undefined, date: iso() });
      }
      reset();
    } finally {
      setSaving(false);
    }
  }

  const TYPES: Array<[EvMode, string]> = [
    ['NOTA', 'Nota'],
    ['CONDICION_CORPORAL', 'Condición corporal'],
    ['TRATAMIENTO', 'Tratamiento'],
    ['ABORTO', 'Aborto'],
    ['CAMBIO_LOTE', 'Cambio de lote'],
    ['CAMBIO_CARAVANA', 'Cambio de caravana'],
    ['REVISION_TORO', 'Revisión de toro'],
    ['EGRESO', 'Egreso / Venta'],
    ['MUERTE', 'Muerte'],
  ];

  return (
    <div>
      <div className="card">
        <h2>Registrar novedad</h2>

        <label>Tipo</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as EvMode)}>
          {TYPES.map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <label>Fecha</label>
        <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />

        {mode === 'CONDICION_CORPORAL' && (
          <div className="row2">
            <div>
              <label>Condición corporal (1–5)</label>
              <select value={score} onChange={(e) => setScore(e.target.value)}>
                {['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Peso (kg, opcional)</label>
              <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ej: 420" />
            </div>
          </div>
        )}

        {mode === 'CAMBIO_LOTE' && (
          <>
            <label>Potrero de destino *</label>
            <select value={destId} onChange={(e) => setDestId(e.target.value)}>
              <option value="">— Elegí destino —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </>
        )}

        {mode === 'CAMBIO_CARAVANA' && (
          <>
            <label>Nueva caravana *</label>
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={`Actual: ${currentTag}`} />
          </>
        )}

        {mode === 'MUERTE' && (
          <div className="alert-warning" style={{ marginBottom: 0 }}>
            Registrar la muerte da de baja al animal (pasa a “Fallecido”) y el stock se
            actualiza solo.
          </div>
        )}
        {mode === 'EGRESO' && (
          <div className="alert-warning" style={{ marginBottom: 0 }}>
            El egreso marca al animal como “Vendido” y lo saca del stock. Anotá el motivo o
            precio en el detalle.
          </div>
        )}

        <label>{noteLabel}</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalle de la novedad…" />

        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={saving} onClick={() => void add()}>
          {saving ? 'Guardando…' : 'Agregar novedad'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">Sin novedades registradas todavía.</div>
      ) : (
        sorted.map((ev) => (
          <div className="list-item" key={ev.id}>
            <div>
              <div className="title">
                {EVENT_META[ev.type].icon} {EVENT_META[ev.type].label}
                {eventExtra(ev)}
              </div>
              {ev.note ? <div className="sub">{ev.note}</div> : null}
            </div>
            <span className="badge">
              {fmtDate(ev.date)}
              {ev._dirty ? ' · sin sync' : ''}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

interface TimelineItem {
  date: string;
  icon: string;
  label: string;
  detail: string;
}

/** Historia completa del animal: trazabilidad total desde el nacimiento. */
function HistoryTab({
  animal,
  weights,
  health,
  movements,
  events,
  reproChecks,
  reproEvents,
  locName,
}: {
  animal: Animal;
  weights: WeightRow[];
  health: HealthRow[];
  movements: MovementRow[];
  events: AnimalEventRow[];
  reproChecks: ReproCheckRow[];
  reproEvents: ReproEventRow[];
  locName: (id: string | null) => string;
}) {
  const repoEvMeta: Record<ReproEventRow['type'], { icon: string; label: string }> = {
    SERVICIO: { icon: '', label: 'Servicio' },
    PARICION: { icon: '', label: 'Parición' },
    DESTETE: { icon: '', label: 'Destete' },
  };

  const items: TimelineItem[] = [
    ...weights.map((w) => ({ date: w.measuredAt, icon: '', label: 'Pesaje', detail: `${Number(w.weightKg)} kg` })),
    ...health.map((h) => ({ date: h.appliedAt, icon: '', label: healthEventLabel[h.eventType], detail: h.medication ?? '' })),
    ...movements.map((m) => ({ date: m.movedAt, icon: '', label: 'Movimiento', detail: `${locName(m.fromLocationId)} → ${locName(m.toLocationId)}` })),
    ...events.map((ev) => {
      const meta = EVENT_META[ev.type];
      const extra = eventExtra(ev).replace(/^ · /, '');
      const detail = [extra, ev.note ?? ''].filter(Boolean).join(' · ');
      return { date: ev.date, icon: meta.icon, label: meta.label, detail };
    }),
    ...reproChecks.map((c) => ({ date: c.date, icon: c.type === 'ECOGRAFIA' ? '' : '', label: c.type === 'ECOGRAFIA' ? 'Ecografía' : 'Tacto', detail: c.result === 'PRENADA' ? 'Preñada' : 'Vacía' })),
    ...reproEvents.map((e) => {
      const meta = repoEvMeta[e.type];
      const detail = e.type === 'SERVICIO' ? (e.sireTagId ? `Toro ${e.sireTagId}` : '') : e.type === 'PARICION' ? (e.offspringTagId ? `Cría ${e.offspringTagId}` : '') : '';
      return { date: e.date, icon: meta.icon, label: meta.label, detail };
    }),
    { date: animal.birthDate, icon: '', label: 'Nacimiento', detail: `Caravana ${animal.tagId}` },
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Trazabilidad completa del animal, de lo más nuevo a su nacimiento.
      </p>
      {items.map((it, i) => (
        <div className="list-item" key={i}>
          <div>
            <div className="title">{it.icon} {it.label}</div>
            {it.detail ? <div className="sub">{it.detail}</div> : null}
          </div>
          <span className="badge">{fmtDate(it.date)}</span>
        </div>
      ))}
    </div>
  );
}
