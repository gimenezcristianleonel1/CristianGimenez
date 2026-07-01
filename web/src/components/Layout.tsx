import { NavLink, Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSync } from '../sync/SyncProvider';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from './Icon';
import { CattleHead } from './Logo';

export default function Layout() {
  const { online, syncing, sync, lastSyncAt } = useSync();
  const { user, establishment, logout } = useAuth();
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const conflicts = useLiveQuery(() => db.conflicts.count(), [], 0);
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], []);

  // Tareas pendientes vencidas o que vencen dentro de 48 h (badge en la nav).
  const soon = Date.now() + 48 * 3600_000;
  const urgentTasks = tasks.filter(
    (t) => t.status === 'PENDING' && t.dueDate && new Date(t.dueDate).getTime() <= soon,
  ).length;

  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar-row">
          <h1 className="appbar-title">
            <CattleHead size={26} />
            <span>{establishment?.name ?? 'Ganader-IA'}</span>
          </h1>
          <span className={`pill ${online ? 'pill-online' : 'pill-offline'}`}>
            {online ? 'En línea' : 'Sin conexión'}
          </span>
        </div>
        <div className="appbar-row appbar-user">
          <span className="muted appbar-userinfo">
            <Icon name="user" size={16} /> {user?.name ?? user?.email}
          </span>
          <button className="btn-link" onClick={logout}>
            Salir
          </button>
        </div>
        <div className="appbar-row appbar-sync">
          <span className="muted">
            {pending ? `${pending} pendiente(s)` : 'Todo sincronizado'}
            {conflicts ? ` · ${conflicts} rechazo(s)` : ''}
            {lastSyncAt ? ` · ${new Date(lastSyncAt).toLocaleTimeString('es-AR')}` : ''}
          </span>
          <button className="btn-sm" onClick={() => void sync()} disabled={syncing || !online}>
            <Icon name="sync" size={16} /> {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottomnav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><Icon name="home" size={24} /></span>
          <span>Inicio</span>
        </NavLink>
        <NavLink to="/animals" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><Icon name="cow" size={24} /></span>
          <span>Animales</span>
        </NavLink>
        <NavLink to="/locations" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><Icon name="location" size={24} /></span>
          <span>Potreros</span>
        </NavLink>
        <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon name="clipboard" size={24} />
            {urgentTasks > 0 && <span className="nav-badge">{urgentTasks}</span>}
          </span>
          <span>Tareas</span>
        </NavLink>
        <NavLink to="/analisis" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><Icon name="chart" size={24} /></span>
          <span>Análisis</span>
        </NavLink>
        <NavLink to="/import" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><Icon name="inbox" size={24} /></span>
          <span>Importar</span>
        </NavLink>
      </nav>
    </div>
  );
}
