import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { cowEquivalent, reproCountsByAnimal } from '../lib/ev';
import { locationTypeLabel } from '../lib/labels';
import { Icon } from '../components/Icon';

const round2 = (n: number): number => Math.round(n * 100) / 100;
/** Carga a partir de la cual se sugiere revisar sobrepastoreo (igual que el backend). */
const OVERLOAD_EV_HA = 1.2;

export default function CargaPotreros() {
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);
  const events = useLiveQuery(() => db.reproEvents.toArray(), [], []);

  const active = animals.filter((a) => a.status === 'ACTIVE');
  const reproCounts = reproCountsByAnimal(events);

  const rows = locations
    .map((l) => {
      const residents = active.filter((a) => a.currentLocationId === l.id);
      const totalEV = round2(
        residents.reduce((sum, a) => sum + cowEquivalent(a, reproCounts.get(a.id)), 0),
      );
      const ha = l.areaHectares != null && l.areaHectares !== '' ? Number(l.areaHectares) : null;
      const carga = ha && ha > 0 ? round2(totalEV / ha) : null;
      return { l, count: residents.length, totalEV, ha, carga };
    })
    .sort((a, b) => a.l.name.localeCompare(b.l.name));

  return (
    <div>
      <div className="section-title">
        <h2>Carga por potrero (EV/Ha)</h2>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Equivalente Vaca total de los animales de cada potrero, dividido por su superficie.
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          No hay potreros todavía.
          <br />
          Creá uno en la sección Potreros y asigná animales.
        </div>
      ) : (
        rows.map(({ l, count, totalEV, ha, carga }) => {
          const overloaded = carga !== null && carga > OVERLOAD_EV_HA;
          return (
            <div className="card" key={l.id}>
              <div className="section-title" style={{ margin: 0 }}>
                <h2 style={{ fontSize: '1.15rem' }}>{l.name}</h2>
                <span className="badge">{locationTypeLabel[l.type]}</span>
              </div>

              <div className="grid2" style={{ marginTop: 12 }}>
                {count > 0 ? (
                  <Link
                    to={`/animals?loc=${l.id}`}
                    className="stat"
                    style={{ textDecoration: 'none', position: 'relative' }}
                  >
                    <div className="n" style={{ color: 'var(--brand)' }}>{count}</div>
                    <div className="l" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      Ver animales <Icon name="back" size={14} className="flip-x" />
                    </div>
                  </Link>
                ) : (
                  <div className="stat">
                    <div className="n">{count}</div>
                    <div className="l">Animales</div>
                  </div>
                )}
                <div className="stat">
                  <div className="n">{totalEV}</div>
                  <div className="l">EV total</div>
                </div>
                <div className="stat">
                  <div className="n">{ha ?? '—'}</div>
                  <div className="l">Hectáreas</div>
                </div>
                <div className="stat">
                  <div className="n" style={overloaded ? { color: 'var(--danger)' } : undefined}>
                    {carga ?? '—'}
                  </div>
                  <div className="l">EV / Ha</div>
                </div>
              </div>

              {ha === null && (
                <div className="alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
                  Este potrero no tiene hectáreas cargadas: no se puede calcular la carga.
                  Editalo en Potreros para agregar la superficie.
                </div>
              )}
              {overloaded && (
                <div className="alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
                  Carga alta ({carga} EV/Ha): revisá el riesgo de sobrepastoreo.
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
