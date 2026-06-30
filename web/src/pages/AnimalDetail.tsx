import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { addHealth, addWeight, changeAnimalStatus, moveAnimal } from '../db/repository';
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
  AnimalStatus,
  HealthEventType,
  HealthRow,
  LocationRow,
  MovementRow,
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
        <div className="sub">
          {speciesLabel[animal.species]} · {animal.breed} · {sexLabel[animal.sex]}
        </div>
        <div className="sub">Nacimiento: {fmtDate(animal.birthDate)}</div>
        <div className="sub">Ubicación: {locName(animal.currentLocationId)}</div>
        <div className="sub">
          Último peso: {lastWeight ? `${Number(lastWeight.weightKg)} kg` : '—'}
          {adg !== null ? ` · GDP: ${adg} kg/día` : ''}
        </div>

        <label>Cambiar estado</label>
        <StatusChanger
          current={animal.status}
          onChange={(s) => changeAnimalStatus(id, s)}
        />
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
