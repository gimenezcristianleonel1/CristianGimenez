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
