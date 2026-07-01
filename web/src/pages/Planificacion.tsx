import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createTask, setTaskStatus } from '../db/repository';
import type { TaskRow } from '../lib/types';

const HOUR = 3600_000;

function fmtDue(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function Planificacion() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);

  const now = Date.now();
  const soonThreshold = now + 48 * HOUR;

  const pending = tasks
    .filter((t) => t.status === 'PENDING')
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  const completed = tasks
    .filter((t) => t.status === 'COMPLETED')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const isUrgent = (t: TaskRow) =>
    t.status === 'PENDING' && !!t.dueDate && new Date(t.dueDate).getTime() <= soonThreshold;
  const isOverdue = (t: TaskRow) =>
    t.status === 'PENDING' && !!t.dueDate && new Date(t.dueDate).getTime() < now;

  const urgentCount = pending.filter(isUrgent).length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('Escribí un título para la tarea');
    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        dueDate: due ? new Date(due).toISOString() : undefined,
      });
      setTitle('');
      setDue('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="section-title">
        <h2>Planificación ({pending.length})</h2>
      </div>

      {urgentCount > 0 && (
        <div className="alert-warning">
          ⚠️ Tenés <strong>{urgentCount}</strong> tarea(s) pendientes para los próximos días o
          vencidas.
        </div>
      )}

      {/* Nueva tarea */}
      <form className="card" onSubmit={add}>
        <h2>Nueva tarea</h2>
        <label>Título *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Vacunar lote norte" />
        <label>Fecha límite (opcional)</label>
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={saving}>
          {saving ? 'Guardando…' : '+ Agregar tarea'}
        </button>
      </form>

      {/* Pendientes */}
      {pending.length === 0 ? (
        <div className="empty">No hay tareas pendientes. ¡Todo al día! 🎉</div>
      ) : (
        pending.map((t) => (
          <div key={t.id} className={`task ${isOverdue(t) ? 'overdue' : isUrgent(t) ? 'urgent' : ''}`}>
            <input
              type="checkbox"
              checked={false}
              onChange={() => void setTaskStatus(t.id, 'COMPLETED')}
              aria-label="Completar"
            />
            <div className="task-body">
              <div className="task-title">
                {t.title} {t._dirty ? <span className="badge dirty">sin sync</span> : null}
              </div>
              <div className="sub">
                📅 {fmtDue(t.dueDate)}
                {isOverdue(t) ? ' · ¡vencida!' : isUrgent(t) ? ' · próxima' : ''}
              </div>
              {t.description ? <div className="sub">{t.description}</div> : null}
            </div>
          </div>
        ))
      )}

      {/* Cumplidas */}
      {completed.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button className="btn-link-muted" onClick={() => setShowDone((s) => !s)}>
            {showDone ? '▼' : '▶'} Cumplidas ({completed.length})
          </button>
          {showDone &&
            completed.map((t) => (
              <div key={t.id} className="task done">
                <input
                  type="checkbox"
                  checked
                  onChange={() => void setTaskStatus(t.id, 'PENDING')}
                  aria-label="Reabrir"
                />
                <div className="task-body">
                  <div className="task-title struck">{t.title}</div>
                  <div className="sub">✔️ {fmtDue(t.completedAt)}</div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
