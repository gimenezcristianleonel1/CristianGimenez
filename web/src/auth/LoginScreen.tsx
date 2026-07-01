import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { useAuth } from './AuthProvider';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google'));
    document.head.appendChild(script);
  });
}

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const { register, loginWithEmail, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Completá email y contraseña');
    if (mode === 'register' && password.length < 6)
      return setError('La contraseña debe tener al menos 6 caracteres');

    setBusy(true);
    try {
      if (mode === 'register') {
        await register({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
          establishmentName: establishmentName.trim() || undefined,
        });
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.',
      );
    } finally {
      setBusy(false);
    }
  }

  // Optional Google button — only when a client id is configured.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (cancelled || !window.google || !googleRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setBusy(true);
            setError('');
            try {
              await loginWithGoogle(response.credential);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Error con Google.');
            } finally {
              setBusy(false);
            }
          },
        });
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: 'filled_blue',
          size: 'large',
          shape: 'pill',
          width: 280,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle]);

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <Logo size={72} />
        </div>

        <div className="tabs" style={{ marginBottom: 4 }}>
          <button
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Ingresar
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Crear cuenta
          </button>
        </div>

        <div style={{ textAlign: 'left' }}>
          <label>Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="productor@campo.com"
          />

          <label>Contraseña</label>
          <input
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
          />

          {mode === 'register' && (
            <>
              <label>Tu nombre (opcional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Productor" />
              <label>Nombre del establecimiento (opcional)</label>
              <input
                value={establishmentName}
                onChange={(e) => setEstablishmentName(e.target.value)}
                placeholder="Estancia La Esperanza"
              />
            </>
          )}
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn" disabled={busy}>
          <Icon name="key" size={18} /> {busy ? 'Procesando…' : mode === 'register' ? 'Crear cuenta' : 'Ingresar'}
        </button>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="login-or muted">o</div>
            <div className="login-btn" ref={googleRef} />
          </>
        )}

        <p className="login-hint muted">
          La primera vez necesitás conexión a internet. Después la app funciona{' '}
          <strong>sin conexión</strong>.
        </p>
      </form>
    </div>
  );
}
