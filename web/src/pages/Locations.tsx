import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { locationTypeLabel } from '../lib/labels';
import { Icon } from '../components/Icon';

export default function Locations() {
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);

  const occupancy = (locationId: string) =>
    animals.filter((a) => a.currentLocationId === locationId).length;
  const unassigned = animals.filter((a) => a.status === 'ACTIVE' && !a.currentLocationId).length;

  return (
    <div>
      <div className="section-title">
        <h2>Potreros y corrales ({locations.length})</h2>
      </div>

      {locations.length > 0 && (
        <Link
          to="/locations/asignar"
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
        >
          <div style={{ flex: 1 }}>
            <strong>Asignar animales a potreros</strong>
            <div className="sub">
              {unassigned > 0
                ? `Hay ${unassigned} animal(es) sin potrero. Asignalos en bloque.`
                : 'Mové o asigná varios animales a la vez.'}
            </div>
          </div>
          {unassigned > 0 && <span className="badge danger">{unassigned}</span>}
        </Link>
      )}

      {locations.length === 0 ? (
        <div className="empty">
          No hay ubicaciones todavía.
          <br />
          Tocá el botón + para crear la primera.
        </div>
      ) : (
        locations
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((l) => {
            const occ = occupancy(l.id);
            const full = l.capacity != null && occ >= l.capacity;
            return (
              <Link key={l.id} to={`/locations/${l.id}`} className="list-item">
                <div>
                  <div className="title">
                    {l.name} {l._dirty ? <span className="badge dirty">sin sync</span> : null}
                  </div>
                  <div className="sub">{locationTypeLabel[l.type]}</div>
                </div>
                <span className={`badge ${full ? 'danger' : ''}`}>
                  {occ}
                  {l.capacity != null ? `/${l.capacity}` : ''} animales
                </span>
              </Link>
            );
          })
      )}

      <Link
        className="fab"
        to="/locations/new"
        aria-label="Nuevo potrero"
        style={{ bottom: 'calc(140px + env(safe-area-inset-bottom))' }}
      >
        <Icon name="plus" size={22} />
        <span>Nuevo potrero</span>
      </Link>
    </div>
  );
}
