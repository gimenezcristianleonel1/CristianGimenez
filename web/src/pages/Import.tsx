import { useRef, useState, type DragEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { apiUpload, ApiError, downloadFile } from '../api/client';
import { db } from '../db/db';
import { useSync } from '../sync/SyncProvider';

type AppField = 'tagId' | 'species' | 'breed' | 'sex' | 'birthDate' | 'initialWeightKg';

interface ImportOk {
  status: 'OK';
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  savedTemplate: boolean;
}
interface RequiresMapping {
  status: 'REQUIERE_MAPEO';
  columns: string[];
  suggestedMapping: Partial<Record<AppField, string>>;
  fields: Array<{ field: AppField; label: string; required: boolean }>;
}
interface PhotoResult {
  matched: Array<{ filename: string; tagId: string }>;
  unmatched: string[];
}

/** Zona de arrastrar y soltar (con click de respaldo). */
function Dropzone({
  label,
  accept,
  multiple,
  onFiles,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const handle = (list: FileList | null) => {
    if (list && list.length) onFiles(Array.from(list));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    handle(e.dataTransfer.files);
  };
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="dz-icon">⬆️</div>
      <div>{label}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default function Import() {
  const { online, sync } = useSync();
  const locations = useLiveQuery(() => db.locations.toArray(), [], []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportOk | null>(null);
  const [needMap, setNeedMap] = useState<RequiresMapping | null>(null);
  const [mapSel, setMapSel] = useState<Partial<Record<AppField, string>>>({});
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<PhotoResult | null>(null);
  const [destLocation, setDestLocation] = useState('');

  async function uploadExcel(file: File, mapping?: Partial<Record<AppField, string>>) {
    setBusy(true);
    setError('');
    setResult(null);
    if (!mapping) {
      setNeedMap(null);
      setPhotos(null);
    }
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (mapping) fd.append('mapping', JSON.stringify(mapping));
      if (destLocation) fd.append('locationId', destLocation);
      const res = await apiUpload<ImportOk | RequiresMapping>('/animals/import', fd);
      if (res.status === 'REQUIERE_MAPEO') {
        setNeedMap(res);
        setMapSel(res.suggestedMapping ?? {});
        setPendingFile(file);
      } else {
        setResult(res);
        setNeedMap(null);
        setPendingFile(null);
        void sync(); // refrescar datos locales con lo importado
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo importar el archivo');
    } finally {
      setBusy(false);
    }
  }

  async function confirmMapping() {
    if (!pendingFile) return;
    if (!mapSel.tagId) {
      setError('Asigná al menos la columna de la Caravana');
      return;
    }
    const clean = Object.fromEntries(Object.entries(mapSel).filter(([, v]) => v)) as Partial<
      Record<AppField, string>
    >;
    await uploadExcel(pendingFile, clean);
  }

  async function uploadPhotos(files: File[]) {
    setBusy(true);
    setError('');
    setPhotos(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      setPhotos(await apiUpload<PhotoResult>('/animals/import/photos', fd));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron subir las fotos');
    } finally {
      setBusy(false);
    }
  }

  async function exportExcel() {
    setError('');
    try {
      await downloadFile('/animals/export/xlsx', 'animales.xlsx');
    } catch {
      setError('No se pudo exportar');
    }
  }

  return (
    <div>
      <div className="section-title">
        <h2>Importar / Exportar</h2>
      </div>

      {!online && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <span className="muted">
            📴 Sin conexión. La importación necesita internet; vas a poder importar cuando vuelva la señal.
          </span>
        </div>
      )}

      {/* ---- Excel ---- */}
      <div className="card">
        <h2>📄 Importar animales (Excel)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Subí un <strong>.xlsx</strong>. Detectamos automáticamente columnas como
          “N° Caravana”, “RP”, “Peso”, etc.
        </p>

        <label>Asignar a potrero (opcional)</label>
        <select value={destLocation} onChange={(e) => setDestLocation(e.target.value)}>
          <option value="">— Sin asignar —</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <div style={{ height: 10 }} />

        <Dropzone
          label="Arrastrá el Excel acá o tocá para elegir"
          accept=".xlsx"
          onFiles={(files) => void uploadExcel(files[0])}
        />

        {busy && <p className="muted">Procesando…</p>}

        {needMap && (
          <div style={{ marginTop: 12 }}>
            <h2 style={{ fontSize: 15 }}>Emparejá las columnas</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              No reconocimos algunos encabezados. Asocialos y guardamos esta configuración para
              la próxima.
            </p>
            {needMap.fields.map((f) => (
              <div key={f.field}>
                <label>
                  {f.label} {f.required ? '*' : ''}
                </label>
                <select
                  value={mapSel[f.field] ?? ''}
                  onChange={(e) => setMapSel((m) => ({ ...m, [f.field]: e.target.value }))}
                >
                  <option value="">— (ninguna)</option>
                  {needMap.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button className="btn" disabled={busy} onClick={() => void confirmMapping()}>
              Confirmar y guardar
            </button>
          </div>
        )}

        {result && (
          <div className="ok" style={{ marginTop: 12 }}>
            ✅ Importados: <strong>{result.imported}</strong> · Omitidos (duplicados):{' '}
            {result.skipped} · Errores: {result.errors.length}
            {result.savedTemplate ? ' · Plantilla guardada' : ''}
            {result.errors.length > 0 && (
              <ul className="muted" style={{ fontSize: 13 }}>
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    Fila {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ---- Fotos ---- */}
      <div className="card">
        <h2>📷 Subir fotos</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          El nombre del archivo se asocia a la caravana (ej. <code>2044.jpg</code> →
          animal 2044).
        </p>
        <Dropzone
          label="Arrastrá las imágenes acá o tocá para elegir"
          accept="image/*"
          multiple
          onFiles={(files) => void uploadPhotos(files)}
        />
        {photos && (
          <div className="ok" style={{ marginTop: 12 }}>
            ✅ Asociadas: <strong>{photos.matched.length}</strong> · Sin coincidencia:{' '}
            {photos.unmatched.length}
            {photos.unmatched.length > 0 && (
              <div className="muted" style={{ fontSize: 13 }}>
                Sin match: {photos.unmatched.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Export ---- */}
      <div className="card">
        <h2>⬇️ Exportar animales</h2>
        <button className="btn btn-outline" onClick={() => void exportExcel()}>
          Descargar Excel
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
