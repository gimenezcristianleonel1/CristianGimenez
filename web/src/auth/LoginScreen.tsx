import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from './AuthProvider';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google')));
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google (sin conexión?)'));
    document.head.appendChild(script);
  });
}

export default function LoginScreen() {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Falta configurar VITE_GOOGLE_CLIENT_ID en el frontend.');
      return;
    }

    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setBusy(true);
            setError('');
            try {
              await loginWithGoogle(response.credential);
            } catch (err) {
              setError(
                err instanceof ApiError
                  ? `No se pudo iniciar sesión: ${err.message}`
                  : 'No se pudo conectar con el servidor.',
              );
            } finally {
              setBusy(false);
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'filled_blue',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 280,
        });
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle]);

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">🐄</div>
        <h1>Gestión Ganadera</h1>
        <p className="muted">
          Iniciá sesión para acceder a los datos de tu establecimiento. Una vez dentro,
          la app funciona también <strong>sin conexión</strong>.
        </p>

        <div className="login-btn" ref={buttonRef} />

        {busy && <p className="muted">Ingresando…</p>}
        {error && <p className="error">{error}</p>}

        <p className="login-hint muted">
          La primera vez necesitás conexión a internet para iniciar sesión.
        </p>
      </div>
    </div>
  );
}
