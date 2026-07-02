import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Tile de KPI que además navega a la lista de animales de ese estado. */
function KpiLink({
  to,
  value,
  label,
  color,
}: {
  to: string;
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <Link to={to} className="stat" style={{ textDecoration: 'none' }}>
      <div className="n" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="l">{label} ›</div>
    </Link>
  );
}

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

      {/* Índice total en primera plana */}
      <Link
        to="/animals?repro=prenada"
        className="card"
        style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}
      >
        <div className="l" style={{ marginBottom: 4 }}>Índice de preñez (total)</div>
        <div className="n" style={{ color: 'var(--brand)', fontSize: '2.6rem', lineHeight: 1 }}>
          {denom > 0 ? `${pctPrenez}%` : '—'}
        </div>
        <div className="sub" style={{ marginTop: 6 }}>
          {prenadas} preñadas sobre {denom || 0} {base} · tocá para ver las preñadas ›
        </div>
      </Link>

      <p className="muted" style={{ marginTop: 0 }}>
        Tocá cualquier indicador para ver los animales que registraste en ese estado.
      </p>

      <div className="grid2">
        <KpiLink
          to="/animals?repro=prenada"
          value={`${pctPrenez}%`}
          label="Preñez"
          color="var(--brand)"
        />
        <KpiLink
          to="/animals?repro=paricion"
          value={`${pctParicion}%`}
          label="Parición"
          color="var(--brand)"
        />
        <KpiLink
          to="/animals?repro=destete"
          value={`${pctDestete}%`}
          label="Destete"
          color="var(--brand)"
        />
        <div className="stat">
          <div className="n" style={merma > 10 ? { color: 'var(--danger)' } : undefined}>{merma}</div>
          <div className="l">Merma (pts)</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 4 }}>
        <h2>Conteos (tocá para ver los animales)</h2>
        <div className="grid2">
          <KpiLink to="/animals?repro=servicio" value={`${servicios}`} label="En servicio" />
          <KpiLink to="/animals?repro=prenada" value={`${prenadas}`} label="Preñadas" />
          <KpiLink
            to="/animals?repro=vacia"
            value={`${vacias}`}
            label="Vacías"
            color={vacias > 0 ? 'var(--danger)' : undefined}
          />
          <KpiLink to="/animals?repro=paricion" value={`${pariciones}`} label="Paridas" />
          <KpiLink to="/animals?repro=destete" value={`${destetes}`} label="Destetadas" />
        </div>
      </div>

      {merma > 10 && denom > 0 && (
        <div className="alert-warning">
          Merma de <strong>{merma}</strong> puntos entre preñez y destete. Revisá pérdidas por
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
