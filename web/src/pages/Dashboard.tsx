import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSync } from '../sync/SyncProvider';

export default function Dashboard() {
  const { lastResult } = useSync();
  const animals = useLiveQuery(() => db.animals.count(), [], 0);
  const active = useLiveQuery(
    () => db.animals.where('status').equals('ACTIVE').count(),
    [],
    0,
  );
  const locations = useLiveQuery(() => db.locations.count(), [], 0);
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const conflicts = useLiveQuery(() => db.conflicts.toArray(), [], []);

  return (
    <div>
      <div className="grid2">
        <div className="stat">
          <div className="n">{animals}</div>
          <div className="l">Animales</div>
        </div>
        <div className="stat">
          <div className="n">{active}</div>
          <div className="l">Activos</div>
        </div>
        <div className="stat">
          <div className="n">{locations}</div>
          <div className="l">Potreros</div>
        </div>
        <div className="stat">
          <div className="n">{pending}</div>
          <div className="l">Pend. de sync</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Trabajo en el campo</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Podés registrar animales, pesajes, eventos sanitarios y movimientos{' '}
          <strong>sin conexión</strong>. Todo se guarda en el dispositivo y se sincroniza
          automáticamente cuando vuelve la señal.
        </p>
        <Link className="btn" to="/animals/new">
          + Registrar animal
        </Link>
        <Link className="btn btn-outline" to="/locations/new">
          + Nuevo potrero
        </Link>
      </div>

      {lastResult && (lastResult.pushed > 0 || lastResult.rejected > 0 || lastResult.pulled > 0) && (
        <div className="card">
          <h2>Última sincronización</h2>
          <p className="muted" style={{ margin: 0 }}>
            ✅ {lastResult.pushed} enviado(s) · ⬇️ {lastResult.pulled} actualizado(s)
            {lastResult.rejected > 0 ? ` · ⚠️ ${lastResult.rejected} rechazado(s)` : ''}
          </p>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="card">
          <h2>⚠️ Operaciones rechazadas</h2>
          {conflicts.slice(0, 8).map((c) => (
            <div key={c.id} className="sub" style={{ marginBottom: 8 }}>
              <span className="badge danger">{c.kind}</span> {c.message}
            </div>
          ))}
          <button
            className="btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => void db.conflicts.clear()}
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
