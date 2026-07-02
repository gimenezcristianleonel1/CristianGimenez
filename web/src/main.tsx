import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import LoginScreen from './auth/LoginScreen';
import Onboarding from './components/Onboarding';
import { SyncProvider } from './sync/SyncProvider';
import App from './App';
import './index.css';

// Auto-update the service worker so a new deploy is picked up on next load.
registerSW({ immediate: true });

// Blindaje del almacenamiento local: pedimos almacenamiento "persistente" para
// que el navegador NO borre los datos offline (IndexedDB) si le falta espacio.
// Es best-effort: en algunos navegadores se concede solo si la PWA está
// instalada o el usuario interactúa; si falla, la app sigue funcionando igual.
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage
    .persisted()
    .then((already) => {
      if (!already) return navigator.storage.persist();
      return true;
    })
    .catch(() => {
      /* almacenamiento persistente no disponible: sin efecto */
    });
}

/** Shows the app when authenticated, otherwise the Google login screen. */
function Gate() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  return (
    <SyncProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Onboarding />
    </SyncProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </React.StrictMode>,
);
