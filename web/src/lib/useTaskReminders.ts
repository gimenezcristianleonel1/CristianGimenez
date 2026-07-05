import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { notifPermission, subscribeToPush, syncTaskReminders } from './notifications';

const RECHECK_MS = 5 * 60_000;

/**
 * Mantiene sincronizados los avisos de tareas con la base local.
 * Se re-sincroniza ante cambios de tareas, al volver a la pestaña y
 * periódicamente (para el fallback en primer plano).
 */
export function useTaskReminders(): void {
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], []);

  // Asegura la suscripción Web Push (avisos con la app cerrada) al iniciar,
  // si el usuario ya concedió permiso. Idempotente y silencioso.
  useEffect(() => {
    if (notifPermission() === 'granted') void subscribeToPush();
  }, []);

  // Reprogramar / revisar cuando cambian las tareas.
  useEffect(() => {
    if (notifPermission() !== 'granted') return;
    void syncTaskReminders(tasks);
  }, [tasks]);

  // Revisar al volver a la app y cada pocos minutos (cubre el fallback).
  useEffect(() => {
    const check = () => {
      if (notifPermission() !== 'granted') return;
      void db.tasks.toArray().then(syncTaskReminders);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    const id = window.setInterval(check, RECHECK_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.clearInterval(id);
    };
  }, []);
}
