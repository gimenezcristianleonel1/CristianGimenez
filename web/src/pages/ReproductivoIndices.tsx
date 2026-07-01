import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

const round1 = (n: number): number => Math.round(n * 10) / 10;

export default function ReproductivoIndices() {
  const checks = useLiveQuery(() => db.reproChecks.toArray(), [], []);
  const events = useLiveQuery(() => db.reproEvents.toArray(), [], []);

  const prenadas = checks.filter((c) => c.result === 'PRENADA').length;
  const vacias = checks.filter((c) => c.result === 'VACIA').length;
  const servicios = events.filter((e) => e.type === 'SERVICIO').length;
  const pariciones = events.filter((e) => e.type === 'PARICION').length;
  const destetes = events.filter((e) => e.type === 'DESTETE').length;

  const base = servicios > 0 ? 'servicios' : 'tactos';
  const denom = servicios > 0 ? servicios : prenadas + vacias;
  const pctPrenez = denom > 0 ? round1((prenadas / denom) * 100) : 0;
  const pctParicion = denom > 0 ? round1((pariciones / denom) * 100) : 0;
  const pctDestete = denom > 0 ? round1((destetes / denom) * 100) : 0;
  const merma = round1(pctPrenez - pctDestete);

  return (
    <div>
      <div className="section-title">
        <h2>Índices reproductivos</h2>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Calculados automáticamente de tus datos. Base actual: <strong>{base}</strong>{' '}
        ({denom || 0}).
      </p>

      <div className="grid2">
        <div className="stat">
          <div className="n" style={{ color: 'var(--olive-dark)' }}>{pctPrenez}%</div>
          <div className="l">Preñez</div>
        </div>
        <div className="stat">
          <div className="n" style={{ color: 'var(--olive-dark)' }}>{pctParicion}%</div>
          <div className="l">Parición</div>
        </div>
        <div className="stat">
          <div className="n" style={{ color: 'var(--olive-dark)' }}>{pctDestete}%</div>
          <div className="l">Destete</div>
        </div>
        <div className="stat">
          <div className="n" style={merma > 10 ? { color: 'var(--danger)' } : undefined}>{merma}</div>
          <div className="l">Merma (pts)</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 4 }}>
        <h2>Conteos</h2>
        <div className="grid2">
          <div className="stat"><div className="n">{servicios}</div><div className="l">Servicios</div></div>
          <div className="stat"><div className="n">{prenadas}</div><div className="l">Preñadas</div></div>
          <div className="stat"><div className="n">{pariciones}</div><div className="l">Pariciones</div></div>
          <div className="stat"><div className="n">{destetes}</div><div className="l">Destetes</div></div>
        </div>
      </div>

      {merma > 10 && denom > 0 && (
        <div className="alert-warning">
          ⚠️ Merma de <strong>{merma}</strong> puntos entre preñez y destete. Revisá pérdidas por
          aborto, mortandad neonatal o del ternero.
        </div>
      )}

      {denom === 0 && (
        <div className="empty">
          Todavía no hay datos reproductivos.
          <br />
          Cargá tactos y eventos (servicio / parición / destete) para ver los índices.
        </div>
      )}
    </div>
  );
}
