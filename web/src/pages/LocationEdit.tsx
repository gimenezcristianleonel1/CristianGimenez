import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  bulkHealthByLocation,
  bulkMoveByLocation,
  createAnimal,
  deleteLocation,
  updateLocation,
  type LocationEditInput,
} from '../db/repository';
import { healthEventLabel, locationTypeLabel, sexLabel, speciesLabel } from '../lib/labels';
import type { Animal, HealthEventType, LocationRow, LocationType, Sex, Species } from '../lib/types';

export default function LocationEdit() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLiveQuery(() => db.locations.get(id), [id]);
  const residents = useLiveQuery(
    () => db.animals.where('currentLocationId').equals(id).toArray(),
    [id],
    [],
  );
  const allLocations = useLiveQuery(() => db.locations.toArray(), [], []);
  const occupancy = residents.length;

  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('PASTURE');
  const [capacity, setCapacity] = useState('');
  const [area, setArea] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Inicializa el formulario una sola vez cuando llega el dato.
  if (location && !loaded) {
    setName(location.name);
    setType(location.type);
    setCapacity(location.capacity != null ? String(location.capacity) : '');
    setArea(location.areaHectares != null ? String(Number(location.areaHectares)) : '');
    setLoaded(true);
  }

  if (location === undefined) return <div className="empty">Cargando…</div>;
  if (location === null) return <div className="empty">Potrero no encontrado.</div>;

  async function save() {
    setError('');
    if (!name.trim()) return setError('El nombre es obligatorio');
    const cap = capacity ? Number(capacity) : null;
    if (cap != null && cap < occupancy) {
      return setError(`La capacidad no puede ser menor a la ocupación actual (${occupancy})`);
    }
    const other = await db.locations
      .where('name')
      .equals(name.trim())
      .and((l) => l.id !== id)
      .first();
    if (other) return setError('Ya existe otro potrero con ese nombre');

    const changes: LocationEditInput = {
      name: name.trim(),
      type,
      capacity: cap,
      areaHectares: area ? Number(area) : null,
    };
    setSaving(true);
    try {
      await updateLocation(id, changes);
      navigate('/locations', { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (occupancy > 0) {
      setError(`No se puede eliminar: tiene ${occupancy} animal(es) asignado(s)`);
      return;
    }
    await deleteLocation(id);
    navigate('/locations', { replace: true });
  }

  return (
    <div>
      <Link className="link" to="/locations">
        ← Potreros
      </Link>

      <form className="card" style={{ marginTop: 8 }} onSubmit={(e) => e.preventDefault()}>
        <h2>Editar potrero</h2>
        <div className="sub">Ocupación actual: {occupancy} animal(es)</div>

        <label>Nombre *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />

        <label>Tipo</label>
        <select value={type} onChange={(e) => setType(e.target.value as LocationType)}>
          {(Object.keys(locationTypeLabel) as LocationType[]).map((t) => (
            <option key={t} value={t}>
              {locationTypeLabel[t]}
            </option>
          ))}
        </select>

        <div className="row2">
          <div>
            <label>Capacidad</label>
            <input
              type="number"
              inputMode="numeric"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="50"
            />
          </div>
          <div>
            <label>Hectáreas</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="12.5"
            />
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn" disabled={saving} onClick={() => void save()}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>

        {!confirmDelete ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={occupancy > 0}
            onClick={() => setConfirmDelete(true)}
          >
            {occupancy > 0 ? 'No se puede eliminar (tiene animales)' : 'Eliminar potrero'}
          </button>
        ) : (
          <div className="row2">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void remove()}>
              Confirmar borrado
            </button>
          </div>
        )}
      </form>

      <div className="card">
        <div className="section-title">
          <h2>Animales en este potrero ({residents.length})</h2>
        </div>

        <QuickAddAnimal locationId={id} />

        {residents.length === 0 ? (
          <div className="empty">Todavía no hay animales en este potrero.</div>
        ) : (
          <>
            <BulkPanel
              locationId={id}
              residents={residents}
              locations={allLocations.filter((l) => l.id !== id)}
              allLocations={allLocations}
            />
            <div style={{ marginTop: 12 }}>
              {[...residents]
                .sort((a, b) => a.tagId.localeCompare(b.tagId))
                .map((a) => (
                  <Link key={a.id} to={`/animals/${a.id}`} className="list-item">
                    <div>
                      <div className="title">
                        {a.tagId}{' '}
                        {a._dirty ? <span className="badge dirty">sin sync</span> : null}
                      </div>
                      <div className="sub">
                        {speciesLabel[a.species]} · {a.breed}
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Alta rápida de un animal ya asignado a este potrero (sin salir de la pantalla). */
function QuickAddAnimal({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [tagId, setTagId] = useState('');
  const [breed, setBreed] = useState('');
  const [species, setSpecies] = useState<Species>('BOVINE');
  const [sex, setSex] = useState<Sex>('FEMALE');
  const today = new Date().toISOString().slice(0, 10);
  const [birthDate, setBirthDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    setError('');
    setMsg('');
    if (!tagId.trim()) return setError('La caravana es obligatoria');
    const w = Number(weight);
    if (!(w > 0)) return setError('El peso inicial debe ser mayor a 0');
    if (birthDate > today) return setError('La fecha de nacimiento no puede ser futura');
    if (await db.animals.where('tagId').equals(tagId.trim()).first()) {
      return setError('Ya existe un animal con esa caravana');
    }
    setSaving(true);
    try {
      const tag = tagId.trim();
      await createAnimal({
        tagId: tag,
        species,
        breed: breed.trim() || 'Sin especificar',
        sex,
        birthDate: new Date(birthDate).toISOString(),
        initialWeightKg: w,
        currentLocationId: locationId,
      });
      // Deja el form abierto para cargar el siguiente rápido.
      setMsg(`${tag} agregado a este potrero`);
      setTagId('');
      setBreed('');
      setWeight('');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-outline" onClick={() => setOpen(true)}>
        Agregar animal a este potrero
      </button>
    );
  }

  return (
    <div className="bulk">
      <h2 style={{ fontSize: 15 }}>Agregar animal</h2>
      <label>Caravana *</label>
      <input value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="AR-0001" />
      <div className="row2">
        <div>
          <label>Especie</label>
          <select value={species} onChange={(e) => setSpecies(e.target.value as Species)}>
            {Object.entries(speciesLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Sexo</label>
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            {Object.entries(sexLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label>Raza</label>
      <input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Angus" />
      <div className="row2">
        <div>
          <label>Nacimiento</label>
          <input type="date" max={today} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div>
          <label>Peso inicial (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="45"
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="row2">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setOpen(false);
            setMsg('');
            setError('');
          }}
        >
          Cerrar
        </button>
        <button className="btn" disabled={saving} onClick={() => void add()}>
          {saving ? 'Guardando…' : 'Agregar'}
        </button>
      </div>
    </div>
  );
}

/** Acciones masivas sobre todos los animales de un potrero. */
function BulkPanel({
  locationId,
  residents,
  locations,
  allLocations,
}: {
  locationId: string;
  residents: Animal[];
  locations: LocationRow[];
  allLocations: LocationRow[];
}) {
  const [dest, setDest] = useState('');
  const [eventType, setEventType] = useState<HealthEventType>('DEWORMING');
  const [medication, setMedication] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState('0');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const needsMed = ['VACCINATION', 'DEWORMING', 'TREATMENT'].includes(eventType);

  async function moveAll() {
    setErr('');
    setMsg('');
    if (!dest) return setErr('Elegí el potrero destino');
    const destLoc = allLocations.find((l) => l.id === dest);
    if (destLoc?.capacity != null) {
      const destOcc = await db.animals.where('currentLocationId').equals(dest).count();
      if (destOcc + residents.length > destLoc.capacity) {
        return setErr(
          `El destino no tiene lugar: capacidad ${destLoc.capacity}, ocupa ${destOcc} y querés sumar ${residents.length}`,
        );
      }
    }
    setBusy(true);
    try {
      const n = await bulkMoveByLocation(locationId, dest, 'REGROUPING');
      setMsg(`${n} animal(es) movido(s). Se está sincronizando…`);
      setDest('');
    } finally {
      setBusy(false);
    }
  }

  async function treatAll() {
    setErr('');
    setMsg('');
    if (needsMed && !medication.trim()) return setErr('El medicamento es obligatorio para este evento');
    setBusy(true);
    try {
      const n = await bulkHealthByLocation(locationId, {
        eventType,
        medication: medication.trim() || undefined,
        withdrawalDays: Number(withdrawalDays) || 0,
      });
      setMsg(`Evento aplicado a ${n} animal(es). Se está sincronizando…`);
      setMedication('');
      setWithdrawalDays('0');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bulk">
      <h2 style={{ fontSize: 15 }}>Acciones masivas ({residents.length})</h2>

      {/* Mover todos */}
      <label>Mover todos a…</label>
      <div className="row2">
        <select value={dest} onChange={(e) => setDest(e.target.value)}>
          <option value="">— Potrero destino —</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button className="btn" style={{ marginTop: 0 }} disabled={busy || !dest} onClick={() => void moveAll()}>
          Mover los {residents.length}
        </button>
      </div>

      {/* Tratamiento masivo */}
      <label style={{ marginTop: 14 }}>Tratamiento sanitario masivo</label>
      <select value={eventType} onChange={(e) => setEventType(e.target.value as HealthEventType)}>
        {(Object.keys(healthEventLabel) as HealthEventType[]).map((t) => (
          <option key={t} value={t}>
            {healthEventLabel[t]}
          </option>
        ))}
      </select>
      <div className="row2">
        <div>
          <label>Medicamento {needsMed ? '*' : ''}</label>
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
      <button className="btn btn-outline" disabled={busy} onClick={() => void treatAll()}>
        Aplicar a los {residents.length}
      </button>

      {err && <div className="error">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
    </div>
  );
}
