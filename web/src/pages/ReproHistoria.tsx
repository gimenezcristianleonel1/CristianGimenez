import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createReproEvent } from '../db/repository';
import type { ReproEventType } from '../lib/types';

const EVENT_LABEL: Record<ReproEventType, string> = {
  SERVICIO: 'Servicio',
  PARICION: 'Parición',
  DESTETE: 'Destete',
};
const EVENT_ICON: Record<ReproEventType, string> = { SERVICIO: '🐂', PARICION: '🐄', DESTETE: '🍼' };

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
}

export default function ReproHistoria() {
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);
  const checks = useLiveQuery(() => db.reproChecks.toArray(), [], []);
  const events = useLiveQuery(() => db.reproEvents.toArray(), [], []);

  const [animalId, setAnimalId] = useState('');
  const [type, setType] = useState<ReproEventType>('SERVICIO');
  const [tag, setTag] = useState(''); // caravana de toro o de cría según el tipo
  const [saving, setSaving] = useState(false);

  const sorted = [...animals].sort((a, b) => a.tagId.localeCompare(b.tagId, 'es', { numeric: true }));

  // Línea de tiempo (historia) del animal: eventos + chequeos, más nuevos primero.
  const timeline = useMemo(() => {
    const evs = events
      .filter((e) => e.animalId === animalId)
      .map((e) => ({
        date: e.date,
        kind: e.type as string,
        icon: EVENT_ICON[e.type],
        detail:
          e.type === 'SERVICIO'
            ? e.sireTagId ? `Toro ${e.sireTagId}` : 'Servicio'
            : e.type === 'PARICION'
              ? e.offspringTagId ? `Cría ${e.offspringTagId}` : 'Parición'
              : 'Destete',
      }));
    const chs = checks
      .filter((c) => c.animalId === animalId)
      .map((c) => ({
        date: c.date,
        kind: c.type,
        icon: c.type === 'ECOGRAFIA' ? '📡' : '✋',
        detail: c.result === 'PRENADA' ? 'Preñada' : 'Vacía',
      }));
    return [...evs, ...chs].sort((a, b) => b.date.localeCompare(a.date));
  }, [events, checks, animalId]);

  const register = async () => {
    if (!animalId) return;
    setSaving(true);
    try {
      await createReproEvent({
        animalId,
        type,
        sireTagId: type === 'SERVICIO' ? tag.trim() || undefined : undefined,
        offspringTagId: type === 'PARICION' ? tag.trim() || undefined : undefined,
      });
      setTag('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="section-title">
        <h2>Historia reproductiva</h2>
      </div>

      <label htmlFor="animal">Animal</label>
      <select id="animal" value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
        <option value="">— Elegí un animal —</option>
        {sorted.map((a) => (
          <option key={a.id} value={a.id}>
            {a.tagId} · {a.breed}
          </option>
        ))}
      </select>

      {animalId && (
        <>
          {/* Registrar evento del ciclo */}
          <div className="card">
            <h2>Registrar evento</h2>
            <div className="tabs">
              {(['SERVICIO', 'PARICION', 'DESTETE'] as ReproEventType[]).map((t) => (
                <button
                  key={t}
                  className={`tab ${type === t ? 'active' : ''}`}
                  onClick={() => setType(t)}
                >
                  {EVENT_ICON[t]} {EVENT_LABEL[t]}
                </button>
              ))}
            </div>
            {type === 'SERVICIO' && (
              <>
                <label>Caravana del toro (opcional)</label>
                <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ej: 900" />
              </>
            )}
            {type === 'PARICION' && (
              <>
                <label>Caravana de la cría (opcional)</label>
                <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ej: 1204" />
              </>
            )}
            <button className="btn" disabled={saving} onClick={() => void register()}>
              {EVENT_ICON[type]} {saving ? 'Guardando…' : `Registrar ${EVENT_LABEL[type].toLowerCase()}`}
            </button>
          </div>

          {/* Línea de tiempo */}
          <div className="section-title">
            <h2 style={{ fontSize: '1.15rem' }}>Línea de tiempo</h2>
          </div>
          {timeline.length === 0 ? (
            <div className="empty">Sin registros reproductivos todavía para este animal.</div>
          ) : (
            timeline.map((it, i) => (
              <div className="list-item" key={i}>
                <div>
                  <div className="title">
                    {it.icon} {it.detail}
                  </div>
                  <div className="sub">{it.kind}</div>
                </div>
                <span className="badge">{fmt(it.date)}</span>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
