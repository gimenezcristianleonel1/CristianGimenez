import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSync } from '../sync/SyncProvider';
import { ApiError } from '../api/client';
import { BrandMark } from '../components/Logo';
import { Icon } from '../components/Icon';

export default function Perfil() {
  const { user, establishment, updateEstablishment, logout } = useAuth();
  const { online } = useSync();

  const [name, setName] = useState(establishment?.name ?? '');
  const [country, setCountry] = useState(establishment?.country ?? '');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');

  const dirty =
    name.trim() !== (establishment?.name ?? '') ||
    country.trim() !== (establishment?.country ?? '');

  async function save() {
    setError('');
    setOk(false);
    if (!name.trim()) return setError('El nombre del establecimiento no puede quedar vacío');
    if (!online) return setError('Necesitás conexión para guardar los datos del establecimiento');
    setSaving(true);
    try {
      await updateEstablishment({ name: name.trim(), country: country.trim() });
      setOk(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar. Probá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="section-title">
        <h2>Mi perfil</h2>
      </div>

      {/* Datos del usuario */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <BrandMark size={56} />
          <div>
            <div className="title" style={{ fontSize: '1.1rem' }}>
              {user?.name ?? 'Productor'}
            </div>
            <div className="sub">{user?.email}</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Tu nombre y correo se toman de tu cuenta. Por ahora se editan desde el registro; el
          establecimiento sí lo podés cambiar acá abajo.
        </p>
      </div>

      {/* Establecimiento editable */}
      <div className="card">
        <h2>Establecimiento</h2>
        <label htmlFor="est-name">Nombre del establecimiento *</label>
        <input
          id="est-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setOk(false);
          }}
          placeholder="Estancia La Esperanza"
        />

        <label htmlFor="est-country">País (opcional)</label>
        <input
          id="est-country"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setOk(false);
          }}
          placeholder="Argentina"
        />

        {!online && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Sin conexión: vas a poder guardar cuando vuelva la señal.
          </p>
        )}
        {error && <div className="error">{error}</div>}
        {ok && <div className="ok">Datos del establecimiento guardados.</div>}

        <button className="btn" disabled={saving || !dirty} onClick={() => void save()}>
          <Icon name="save" size={18} /> {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {/* Acciones */}
      <div className="card">
        <h2>Sesión</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Si iniciás sesión con otra cuenta/establecimiento, los datos locales se reemplazan por los
          de esa cuenta.
        </p>
        <button className="btn btn-outline" onClick={logout}>
          <Icon name="logout" size={18} /> Cerrar sesión
        </button>
      </div>

      <Link className="link" to="/">
        ← Volver al inicio
      </Link>
    </div>
  );
}
