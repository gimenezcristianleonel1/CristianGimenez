import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSync } from '../sync/SyncProvider';
import { classifyCategory } from '../lib/ev';

const round1 = (n: number): number => Math.round(n * 10) / 10;

export default function Dashboard() {
  const { lastResult } = useSync();
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);
  const checks = useLiveQuery(() => db.reproChecks.toArray(), [], []);
  const events = useLiveQuery(() => db.reproEvents.toArray(), [], []);
  const locations = useLiveQuery(() => db.locations.count(), [], 0);
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const conflicts = useLiveQuery(() => db.conflicts.toArray(), [], []);

  const active = animals.filter((a) => a.status === 'ACTIVE');
  const deceased = animals.filter((a) => a.status === 'DECEASED').length;

  // Stock por categoría (agrupada), inferida por sexo + edad (offline).
  const cat = { vacas: 0, vaquillonas: 0, terneros: 0, novillos: 0, toros: 0 };
  for (const a of active) {
    const c = classifyCategory(a.sex, a.birthDate, a.metadata);
    if (c === 'VACA_CON_TERNERO' || c === 'VACA_SECA') cat.vacas++;
    else if (c === 'VAQUILLONA') cat.vaquillonas++;
    else if (c === 'TERNERO') cat.terneros++;
    else if (c === 'NOVILLITO' || c === 'NOVILLO') cat.novillos++;
    else if (c === 'TORO') cat.toros++;
  }

  // Índices reproductivos (misma lógica que /indices).
  const prenadas = checks.filter((c) => c.result === 'PRENADA').length;
  const vacias = checks.filter((c) => c.result === 'VACIA').length;
  const servicios = events.filter((e) => e.type === 'SERVICIO').length;
  const destetes = events.filter((e) => e.type === 'DESTETE').length;
  const denom = servicios > 0 ? servicios : prenadas + vacias;
  const pctPrenez = denom > 0 ? round1((prenadas / denom) * 100) : null;
  const pctDestete = denom > 0 ? round1((destetes / denom) * 100) : null;

  // Mortalidad = fallecidos / (activos + fallecidos).
  const mortBase = active.length + deceased;
  const mortalidad = mortBase > 0 ? round1((deceased / mortBase) * 100) : 0;

  const catRows: Array<[string, number]> = [
    ['🐄 Vacas', cat.vacas],
    ['🐮 Vaquillonas', cat.vaquillonas],
    ['🍼 Terneros/as', cat.terneros],
    ['🐂 Novillos', cat.novillos],
    ['👑 Toros', cat.toros],
  ];

  return (
    <div>
      <div className="section-title">
        <h2>Resumen del establecimiento</h2>
      </div>

      {/* KPIs ejecutivos — un solo vistazo */}
      <div className="grid2">
        <div className="stat">
          <div className="n">{active.length}</div>
          <div className="l">Stock (activos)</div>
        </div>
        <Link to="/analisis/indices" className="stat" style={{ textDecoration: 'none' }}>
          <div className="n" style={{ color: 'var(--olive-dark)' }}>
            {pctPrenez === null ? '—' : `${pctPrenez}%`}
          </div>
          <div className="l">Preñez</div>
        </Link>
        <Link to="/analisis/indices" className="stat" style={{ textDecoration: 'none' }}>
          <div className="n" style={{ color: 'var(--olive-dark)' }}>
            {pctDestete === null ? '—' : `${pctDestete}%`}
          </div>
          <div className="l">Destete</div>
        </Link>
        <div className="stat">
          <div className="n" style={mortalidad > 3 ? { color: 'var(--danger)' } : undefined}>
            {mortalidad}%
          </div>
          <div className="l">Mortalidad</div>
        </div>
      </div>

      {/* Stock por categoría */}
      <div className="card">
        <h2>Stock por categoría</h2>
        {active.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Todavía no hay animales activos.</p>
        ) : (
          catRows.map(([label, n]) => (
            <div className="list-item" key={label} style={{ marginBottom: 8, minHeight: 0, padding: '12px 16px' }}>
              <div className="title" style={{ fontSize: '1.05rem' }}>{label}</div>
              <span className="badge">{n}</span>
            </div>
          ))
        )}
      </div>

      {/* Margen — pendiente de datos de costos/ventas */}
      <div className="card">
        <h2>Margen</h2>
        <p className="muted" style={{ margin: 0 }}>
          Próximamente: para calcular el margen hace falta cargar <strong>costos</strong> (sanidad,
          alimentación) y <strong>ventas</strong>. Es el módulo de <em>Pesadas y costo</em>.
        </p>
      </div>

      {/* Accesos rápidos */}
      <div className="card">
        <h2>Trabajo en el campo</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Registrá animales, pesajes, eventos y movimientos <strong>sin conexión</strong>. Todo
          sincroniza solo al volver la señal.
        </p>
        <Link className="btn" to="/animals/new">➕ Registrar animal</Link>
        <Link className="btn btn-outline" to="/locations/new">📍 Nuevo potrero</Link>
      </div>

      <div className="grid2">
        <div className="stat">
          <div className="n">{locations}</div>
          <div className="l">Potreros</div>
        </div>
        <div className="stat">
          <div className="n">{pending}</div>
          <div className="l">Pend. de sync</div>
        </div>
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
          <button className="btn-sm" style={{ marginTop: 8 }} onClick={() => void db.conflicts.clear()}>
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
