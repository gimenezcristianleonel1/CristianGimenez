import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { speciesLabel, statusLabel } from '../lib/labels';
import { groupOfAnimal, reproCountsByAnimal, GROUP_LABEL, type CategoryGroup } from '../lib/ev';
import { REPRO_LABEL, isReproFilter, animalsForReproFilter } from '../lib/repro';
import type { Animal } from '../lib/types';
import AnimalBulkBar from '../components/AnimalBulkBar';

/**
 * Fila de animal con soporte de "mantener apretado" (long-press) para entrar en
 * modo selección. Fuera de selección, un toque abre el detalle; dentro, lo tilda.
 */
function AnimalRow({
  a,
  selectMode,
  checked,
  subtitle,
  onOpen,
  onToggle,
  onLongPress,
}: {
  a: Animal;
  selectMode: boolean;
  checked: boolean;
  subtitle: string;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  const timer = useRef<number | undefined>(undefined);
  const longFired = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  const clear = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  };
  const onPointerDown = (e: React.PointerEvent) => {
    longFired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clear();
    timer.current = window.setTimeout(() => {
      longFired.current = true;
      onLongPress(a.id);
    }, 450);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (Math.abs(e.clientX - start.current.x) > 12 || Math.abs(e.clientY - start.current.y) > 12) {
      clear();
    }
  };
  const onClick = (e: React.MouseEvent) => {
    if (longFired.current) {
      e.preventDefault();
      longFired.current = false;
      return;
    }
    if (selectMode) onToggle(a.id);
    else onOpen(a.id);
  };

  return (
    <div
      className={`list-item selectable ${checked ? 'selected' : ''}`}
      role="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {selectMode && (
        <input type="checkbox" checked={checked} readOnly aria-label="Seleccionar" style={{ marginRight: 6 }} />
      )}
      <div style={{ flex: 1 }}>
        <div className="title">
          {a.tagId} {a._dirty ? <span className="badge dirty">sin sincronizar</span> : null}
        </div>
        <div className="sub">{subtitle}</div>
      </div>
      <span className="badge">{statusLabel[a.status]}</span>
    </div>
  );
}

export default function AnimalsList() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const animals = useLiveQuery(() => db.animals.toArray(), [], []);
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);
  const checks = useLiveQuery(() => db.reproChecks.toArray(), [], []);
  const events = useLiveQuery(() => db.reproEvents.toArray(), [], []);

  // Modo selección múltiple (se entra manteniendo apretado un animal).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState('');

  const rawCat = searchParams.get('cat');
  const cat = (rawCat && rawCat in GROUP_LABEL ? rawCat : null) as CategoryGroup | null;

  const rawRepro = searchParams.get('repro');
  const repro = isReproFilter(rawRepro) ? rawRepro : null;
  const reproIds = useMemo(
    () => (repro ? animalsForReproFilter(repro, checks, events) : null),
    [repro, checks, events],
  );

  const clearRepro = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('repro');
    setSearchParams(next, { replace: true });
  };

  // Filtro por potrero manejado por la URL ('' = todos · 'none' = sin potrero · <id>).
  const loc = searchParams.get('loc') ?? '';
  const setLoc = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set('loc', v);
    else next.delete('loc');
    setSearchParams(next, { replace: true });
  };

  const clearCat = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('cat');
    setSearchParams(next, { replace: true });
  };

  const reproCounts = useMemo(() => reproCountsByAnimal(events), [events]);

  const term = q.trim().toLowerCase();
  const filtered = animals
    .filter((a) => {
      // Al filtrar por categoría solo aplican los animales activos (así se ve en el resumen).
      if (cat && (a.status !== 'ACTIVE' || groupOfAnimal(a, reproCounts.get(a.id)) !== cat)) return false;
      if (reproIds && !reproIds.has(a.id)) return false;
      if (loc === 'none' && a.currentLocationId) return false;
      if (loc && loc !== 'none' && a.currentLocationId !== loc) return false;
      if (term && !a.tagId.toLowerCase().includes(term) && !a.breed.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.tagId.localeCompare(b.tagId, 'es', { numeric: true }));

  const locName = (id?: string | null) =>
    id ? (locations.find((l) => l.id === id)?.name ?? '—') : 'Sin potrero';

  // ----- Selección -----
  const enterSelect = (id: string) => {
    setSelectMode(true);
    setSelected(new Set([id]));
    setFlash('');
  };
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filtered.map((a) => a.id)));
  };
  const exitSelect = (msg?: string) => {
    setSelectMode(false);
    setSelected(new Set());
    if (msg) {
      setFlash(msg);
      window.setTimeout(() => setFlash(''), 5000);
    }
  };
  // Solo los seleccionados que siguen visibles en el filtro actual.
  const selectedIds = filtered.filter((a) => selected.has(a.id)).map((a) => a.id);

  return (
    <div>
      <div className="section-title">
        <h2>
          {cat ? GROUP_LABEL[cat] : repro ? REPRO_LABEL[repro] : 'Animales'} ({filtered.length})
        </h2>
      </div>

      {flash && <div className="ok" style={{ marginBottom: 10 }}>{flash}</div>}

      {/* Barra de selección múltiple (sticky) */}
      {selectMode && (
        <div className="select-bar">
          <div className="select-bar-row">
            <button className="btn-link" onClick={() => exitSelect()}>
              Cancelar
            </button>
            <strong>{selectedIds.length} seleccionado(s)</strong>
            <button className="btn-link" onClick={toggleAll}>
              {allSelected ? 'Ninguno' : 'Todos'}
            </button>
          </div>
          {selectedIds.length > 0 ? (
            <AnimalBulkBar ids={selectedIds} locations={locations} onDone={exitSelect} />
          ) : (
            <div className="sub" style={{ padding: '4px 2px' }}>
              Tocá los animales para tildarlos, o usá “Todos”.
            </div>
          )}
        </div>
      )}

      {!selectMode && (
        <p className="sub" style={{ margin: '0 0 8px' }}>
          Tip: mantené apretado un animal para seleccionar varios y hacer acciones masivas.
        </p>
      )}

      {repro && (
        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}
        >
          <span className="sub" style={{ flex: 1 }}>
            Mostrando <strong>{REPRO_LABEL[repro]}</strong>. Tocá un animal para ver su historial
            reproductivo.
          </span>
          <button className="btn-sm" onClick={clearRepro}>
            Ver todos
          </button>
        </div>
      )}

      {cat && (
        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}
        >
          <span className="sub" style={{ flex: 1 }}>
            Mostrando la categoría <strong>{GROUP_LABEL[cat]}</strong>. Tocá un animal para ver su
            historial.
          </span>
          <button className="btn-sm" onClick={clearCat}>
            Ver todos
          </button>
        </div>
      )}

      {/* Filtro por potrero */}
      <label>Potrero</label>
      <select value={loc} onChange={(e) => setLoc(e.target.value)} style={{ marginBottom: 10 }}>
        <option value="">Todos los potreros</option>
        {locations.map((l) => {
          const count = animals.filter((a) => a.currentLocationId === l.id).length;
          return (
            <option key={l.id} value={l.id}>
              {l.name} ({count})
            </option>
          );
        })}
        <option value="none">Sin potrero ({animals.filter((a) => !a.currentLocationId).length})</option>
      </select>

      <input
        placeholder="Buscar por caravana o raza…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {filtered.length === 0 ? (
        <div className="empty">
          {animals.length === 0
            ? 'No hay animales todavía. Tocá + para registrar el primero.'
            : 'No hay animales que coincidan con el filtro.'}
        </div>
      ) : (
        filtered.map((a) => (
          <AnimalRow
            key={a.id}
            a={a}
            selectMode={selectMode}
            checked={selected.has(a.id)}
            subtitle={`${speciesLabel[a.species]} · ${a.breed} · ${locName(a.currentLocationId)}`}
            onOpen={(id) => navigate(`/animals/${id}`)}
            onToggle={toggle}
            onLongPress={enterSelect}
          />
        ))
      )}

      {!selectMode && (
        <Link className="fab" to="/animals/new" aria-label="Registrar animal" style={{ bottom: 'calc(140px + env(safe-area-inset-bottom))' }}>
          <span>Nuevo animal</span>
        </Link>
      )}
    </div>
  );
}
