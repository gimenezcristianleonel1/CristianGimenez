import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { SyncProvider } from './sync/SyncProvider';
import App from './App';
import './index.css';

// Auto-update the service worker so a new deploy is picked up on next load.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SyncProvider>
        <App />
      </SyncProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
