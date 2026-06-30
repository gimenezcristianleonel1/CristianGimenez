import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ping } from '../api/client';
import { runSync, type SyncResult } from './syncEngine';

interface SyncContextValue {
  online: boolean;
  syncing: boolean;
  lastResult: SyncResult | null;
  lastSyncAt: string | null;
  sync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    const reachable = await ping();
    setOnline(reachable);
    if (!reachable) return;

    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await runSync();
      setLastResult(result);
      setLastSyncAt(new Date().toISOString());
    } catch (err) {
      // Only a real network failure means we are offline; a server-side error
      // (e.g. validation) is not a connectivity problem.
      if (err instanceof TypeError) setOnline(false);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  // React to browser connectivity changes and auto-sync when coming back online.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [sync]);

  // Initial sync + periodic background sync while the app is open.
  useEffect(() => {
    void sync();
    const timer = setInterval(() => void sync(), 30_000);
    return () => clearInterval(timer);
  }, [sync]);

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
