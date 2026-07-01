import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { OUTBOX_EVENT } from '../db/repository';
import { flushOutbox, runSync, type SyncResult } from './syncEngine';

interface SyncContextValue {
  online: boolean;
  syncing: boolean;
  lastResult: SyncResult | null;
  lastSyncAt: string | null;
  /** Sincronización completa (push + pull). */
  sync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const runningRef = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ejecuta push (+ pull opcional) en segundo plano, sin bloquear la UI ni
  // hacer un ping previo (evita una ida y vuelta extra contra el backend).
  const run = useCallback(async (full: boolean) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setSyncing(true);
    try {
      const result = full ? await runSync() : await flushOutbox();
      setLastResult(result);
      setLastSyncAt(new Date().toISOString());
      setOnline(true);
    } catch (err) {
      // Sólo un fallo de red real significa "sin conexión"; un error del
      // servidor (validación, etc.) no es un problema de conectividad.
      if (err instanceof TypeError) setOnline(false);
    } finally {
      runningRef.current = false;
      setSyncing(false);
    }
  }, []);

  const sync = useCallback(() => run(true), [run]);

  // Apenas se guarda algo (evento de la cola), sincronizamos ya — con un
  // pequeño debounce para agrupar ediciones rápidas en un solo push.
  useEffect(() => {
    const onOutbox = () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void run(false), 250);
    };
    window.addEventListener(OUTBOX_EVENT, onOutbox);
    return () => {
      window.removeEventListener(OUTBOX_EVENT, onOutbox);
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, [run]);

  // Reacciona a los cambios de conectividad del navegador.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void run(true);
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [run]);

  // Sync inicial + pull periódico (más espaciado; el push ya es inmediato).
  useEffect(() => {
    void run(true);
    const timer = setInterval(() => void run(true), 60_000);
    return () => clearInterval(timer);
  }, [run]);

  return (
    <SyncContext.Provider value={{ online, syncing, lastResult, lastSyncAt, sync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
