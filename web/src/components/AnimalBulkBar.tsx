import { useState } from 'react';
import {
  bulkDeleteAnimals,
  bulkHealthByAnimals,
  bulkMoveAnimals,
  bulkReproEventByAnimals,
  bulkStatusByAnimals,
} from '../db/repository';
import { healthEventLabel, statusLabel } from '../lib/labels';
import type { AnimalStatus, HealthEventType, LocationRow } from '../lib/types';

type Mode = 'move' | 'health' | 'status' | 'service' | 'delete' | null;

const BULK_STATUSES: AnimalStatus[] = ['ACTIVE', 'QUARANTINE', 'READY_FOR_SALE'];
const NEEDS_MED: HealthEventType[] = ['VACCINATION', 'DEWORMING', 'TREATMENT'];

/**
 * Barra de acciones masivas sobre una selección arbitraria de animales:
 * mover a un potrero, aplicar sanidad, cambiar estado, poner en servicio o
 * eliminar. Reutiliza las operaciones del repositorio (offline-first).
 */
export default function AnimalBulkBar({
  ids,
  locations,
  onDone,
}: {
  ids: string[];
  locations: LocationRow[];
  onDone: (resultMsg?: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [dest, setDest] = useState('');
  const [eventType, setEventType] = useState<HealthEventType>('VACCINATION');
  const [medication, setMedication] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState('0');
  const [status, setStatus] = useState<AnimalStatus>('READY_FOR_SALE');
  const [sireTag, setSireTag] = useState('');

  const n = ids.length;
  const needsMed = NEEDS_MED.includes(eventType);

  async function run(fn: () => Promise<number>, label: (c: number) => string) {
    setErr('');
    setBusy(true);
    try {
      const c = await fn();
      onDone(label(c));
    } catch {
      setErr('No se pudo completar la acción. Reintentá.');
    } finally {
      setBusy(false);
    }
  }

  const pick = (m: Mode) => {
    setErr('');
    setMode((cur) => (cur === m ? null : m));
  };

  return (
    <div className="bulk" style={{ marginTop: 10 }}>
      <div className="chip-row" style={{ margin: 0 }}>
        <button type="button" className={`chip ${mode === 'move' ? 'chip-active' : ''}`} onClick={() => pick('move')}>
          Mover
        </button>
        <button type="button" className={`chip ${mode === 'health' ? 'chip-active' : ''}`} onClick={() => pick('health')}>
          Sanidad
        </button>
        <button type="button" className={`chip ${mode === 'status' ? 'chip-active' : ''}`} onClick={() => pick('status')}>
          Estado
        </button>
        <button type="button" className={`chip ${mode === 'service' ? 'chip-active' : ''}`} onClick={() => pick('service')}>
          Servicio
        </button>
        <button
          type="button"
          className="chip"
          style={{ color: 'var(--danger-dark)', borderColor: 'var(--danger)' }}
          onClick={() => pick('delete')}
        >
          Eliminar
        </button>
      </div>

      {mode === 'move' && (
        <div style={{ marginTop: 10 }}>
          <label>Mover los {n} a…</label>
          <div className="row2">
            <select value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">— Potrero destino —</option>
              {[...locations]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
            <button
              className="btn"
              style={{ marginTop: 0 }}
              disabled={busy || !dest}
              onClick={() =>
                void run(
                  () => bulkMoveAnimals(ids, dest, 'REGROUPING'),
                  (c) => `${c} animal(es) movido(s).`,
                )
              }
            >
              Mover
            </button>
          </div>
        </div>
      )}

      {mode === 'health' && (
        <div style={{ marginTop: 10 }}>
          <label>Evento sanitario para los {n}</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value as HealthEventType)}>
            {(Object.keys(healthEventLabel) as HealthEventType[]).map((t) => (
              <option key={t} value={t}>
                {healthEventLabel[t]}
              </option>
            ))}
          </select>
          <div className="row2">
            <div>
              <label>Producto / droga {needsMed ? '' : '(opcional)'}</label>
              <input value={medication} onChange={(e) => setMedication(e.target.value)} placeholder="Ivermectina" />
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
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  bulkHealthByAnimals(ids, {
                    eventType,
                    medication: medication.trim() || undefined,
                    withdrawalDays: Number(withdrawalDays) || 0,
                  }),
                (c) => `Evento aplicado a ${c} animal(es).`,
              )
            }
          >
            Aplicar a los {n}
          </button>
        </div>
      )}

      {mode === 'status' && (
        <div style={{ marginTop: 10 }}>
          <label>Cambiar estado de los {n} a…</label>
          <div className="row2">
            <select value={status} onChange={(e) => setStatus(e.target.value as AnimalStatus)}>
              {BULK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
            <button
              className="btn"
              style={{ marginTop: 0 }}
              disabled={busy}
              onClick={() =>
                void run(
                  () => bulkStatusByAnimals(ids, status),
                  (c) => `${c} animal(es) marcados como “${statusLabel[status]}”.`,
                )
              }
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      {mode === 'service' && (
        <div style={{ marginTop: 10 }}>
          <label>Poner en servicio (solo hembras activas)</label>
          <div className="row2">
            <input value={sireTag} onChange={(e) => setSireTag(e.target.value)} placeholder="Toro / padre (opcional)" />
            <button
              className="btn"
              style={{ marginTop: 0 }}
              disabled={busy}
              onClick={() =>
                void run(
                  () => bulkReproEventByAnimals(ids, { type: 'SERVICIO', sireTagId: sireTag.trim() || undefined }),
                  (c) => `${c} hembra(s) puestas en servicio.`,
                )
              }
            >
              Poner en servicio
            </button>
          </div>
        </div>
      )}

      {mode === 'delete' && (
        <div style={{ marginTop: 10 }}>
          <div className="sub" style={{ marginBottom: 8 }}>
            Vas a eliminar <strong>{n}</strong> animal(es). Esta acción no se puede deshacer.
          </div>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`¿Eliminar ${n} animal(es)? No se puede deshacer.`)) return;
              void run(
                () => bulkDeleteAnimals(ids),
                (c) => `${c} animal(es) eliminado(s).`,
              );
            }}
          >
            Sí, eliminar los {n}
          </button>
        </div>
      )}

      {err && <div className="error">{err}</div>}
    </div>
  );
}
