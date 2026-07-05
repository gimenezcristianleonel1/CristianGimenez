import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createTask, setTaskStatus, deleteTask, updateTask } from '../db/repository';
import type { TaskRow } from '../lib/types';
import { Icon } from '../components/Icon';
import {
  notifSupported,
  notifPermission,
  requestNotifPermission,
  subscribeToPush,
  syncTaskReminders,
} from '../lib/notifications';

const HOUR = 3600_000;

function fmtDue(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** ISO → valor para <input type="datetime-local"> (hora local, sin zona). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Planificacion() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>(notifPermission());
  // Edición de una tarea (título + fecha límite).
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editError, setEditError] = useState('');

  function startEdit(t: TaskRow) {
    setEditId(t.id);
    setEditTitle(t.title);
    setEditDue(toLocalInput(t.dueDate));
    setEditError('');
  }
  function cancelEdit() {
    setEditId(null);
    setEditError('');
  }
  async function saveEdit(id: string) {
    if (!editTitle.trim()) return setEditError('El título no puede quedar vacío');
    await updateTask(id, {
      title: editTitle.trim(),
      dueDate: editDue ? new Date(editDue).toISOString() : null,
    });
    setEditId(null);
    setEditError('');
  }

  async function enableNotifications() {
    const result = await requestNotifPermission();
    setPerm(result);
    if (result === 'granted') {
      // Programar los avisos de las tareas ya cargadas.
      void syncTaskReminders(await db.tasks.toArray());
      // Suscribir el navegador a Web Push (avisos con la app cerrada).
      void subscribeToPush();
    }
  }

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

      {notifSupported() && perm !== 'granted' && (
        <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Icon name="bell" size={26} />
          <div style={{ flex: 1 }}>
            <strong>Avisos en el celular</strong>
            <div className="sub">
              {perm === 'denied'
                ? 'Los avisos están bloqueados. Activalos desde los ajustes del navegador para esta app.'
                : 'Recibí un aviso un día antes y cuando esté por vencer cada tarea con fecha, aunque tengas la app cerrada.'}
            </div>
          </div>
          {perm === 'default' && (
            <button className="btn-sm" onClick={() => void enableNotifications()}>
              Activar
            </button>
          )}
        </div>
      )}

      {urgentCount > 0 && (
        <div className="alert-warning">
          Tenés <strong>{urgentCount}</strong> tarea(s) pendientes para los próximos días o
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
          {saving ? 'Guardando…' : 'Agregar tarea'}
        </button>
      </form>

      {/* Pendientes */}
      {pending.length === 0 ? (
        <div className="empty">No hay tareas pendientes. ¡Todo al día! </div>
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
                {fmtDue(t.dueDate)}
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
            completed.map((t) =>
              editId === t.id ? (
                <div key={t.id} className="task done" style={{ alignItems: 'stretch' }}>
                  <div className="task-body">
                    <label>Título *</label>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    <label>Fecha límite (opcional)</label>
                    <input
                      type="datetime-local"
                      value={editDue}
                      onChange={(e) => setEditDue(e.target.value)}
                    />
                    {editError && <div className="error">{editError}</div>}
                    <div className="row2" style={{ marginTop: 8 }}>
                      <button className="btn btn-outline" onClick={cancelEdit}>
                        Cancelar
                      </button>
                      <button className="btn" onClick={() => void saveEdit(t.id)}>
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={t.id} className="task done">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => void setTaskStatus(t.id, 'PENDING')}
                    aria-label="Reabrir"
                  />
                  <div className="task-body">
                    <div className="task-title struck">{t.title}</div>
                    <div className="sub">{fmtDue(t.completedAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-link" aria-label="Modificar tarea" onClick={() => startEdit(t)}>
                      Modificar
                    </button>
                    <button
                      className="task-delete"
                      aria-label="Eliminar tarea"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la tarea "${t.title}"?`)) void deleteTask(t.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ),
            )}
        </div>
      )}
    </div>
  );
}
