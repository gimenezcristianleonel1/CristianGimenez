import { useRef, useState, type DragEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { api, apiUpload, ApiError, downloadFile } from '../api/client';
import { db } from '../db/db';
import { useSync } from '../sync/SyncProvider';

type AppField = 'tagId' | 'species' | 'breed' | 'sex' | 'birthDate' | 'initialWeightKg';

/** Fila editable de la revisión previa a guardar. */
interface ReviewRow {
  tagId: string;
  species: string;
  breed: string;
  sex: string;
  birthDate: string;
  initialWeightKg: string;
  issues: AppField[];
}
interface ExtractResult {
  status: 'REVISAR';
  source: 'image' | 'excel';
  rows: Array<{
    tagId: string;
    species: string;
    breed: string;
    sex: string;
    birthDate: string;
    initialWeightKg: number | null;
    issues: AppField[];
  }>;
}

const SPECIES_OPTS: Array<[string, string]> = [
  ['BOVINE', 'Bovino'],
  ['PORCINE', 'Porcino'],
  ['OVINE', 'Ovino'],
  ['CAPRINE', 'Caprino'],
  ['EQUINE', 'Equino'],
  ['OTHER', 'Otro'],
];
const SEX_OPTS: Array<[string, string]> = [
  ['FEMALE', 'Hembra'],
  ['MALE', 'Macho'],
];

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
      <div className="dz-icon"></div>
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
  // Revisión previa (foto/Excel) antes de guardar.
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [reviewSource, setReviewSource] = useState<'image' | 'excel' | null>(null);
  const [reviewAfterMap, setReviewAfterMap] = useState(false);

  function openReview(res: ExtractResult) {
    setResult(null);
    setNeedMap(null);
    setReviewSource(res.source);
    setReview(
      res.rows.map((r) => ({
        tagId: r.tagId ?? '',
        species: r.species || 'BOVINE',
        breed: r.breed ?? '',
        sex: r.sex || 'FEMALE',
        birthDate: r.birthDate ?? '',
        initialWeightKg: r.initialWeightKg != null ? String(r.initialWeightKg) : '',
        issues: r.issues ?? [],
      })),
    );
  }

  async function uploadImage(file: File) {
    setBusy(true);
    setError('');
    setResult(null);
    setReview(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiUpload<ExtractResult>('/animals/import/image', fd);
      if (!res.rows?.length) {
        setError('No pude leer datos en la imagen. Probá con una foto más nítida.');
      } else {
        openReview(res);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo leer la imagen');
    } finally {
      setBusy(false);
    }
  }

  async function uploadExcelReview(file: File, mapping?: Partial<Record<AppField, string>>) {
    setBusy(true);
    setError('');
    setResult(null);
    setReview(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (mapping) fd.append('mapping', JSON.stringify(mapping));
      const res = await apiUpload<ExtractResult | RequiresMapping>('/animals/import/preview', fd);
      if (res.status === 'REQUIERE_MAPEO') {
        setNeedMap(res);
        setMapSel(res.suggestedMapping ?? {});
        setPendingFile(file);
        setReviewAfterMap(true);
      } else {
        openReview(res);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo leer el Excel');
    } finally {
      setBusy(false);
    }
  }

  function editRow(i: number, field: keyof ReviewRow, value: string) {
    setReview((rows) => {
      if (!rows) return rows;
      const next = rows.slice();
      const issues = next[i].issues.filter((f) => f !== field);
      next[i] = { ...next[i], [field]: value, issues };
      return next;
    });
  }
  function addRow() {
    setReview((rows) => [
      ...(rows ?? []),
      { tagId: '', species: 'BOVINE', breed: '', sex: 'FEMALE', birthDate: '', initialWeightKg: '', issues: ['tagId'] },
    ]);
  }
  function removeRow(i: number) {
    setReview((rows) => (rows ? rows.filter((_, idx) => idx !== i) : rows));
  }

  async function saveReview() {
    if (!review) return;
    const rows = review
      .filter((r) => r.tagId.trim())
      .map((r) => ({
        tagId: r.tagId.trim(),
        species: r.species,
        breed: r.breed.trim(),
        sex: r.sex,
        birthDate: r.birthDate,
        initialWeightKg: r.initialWeightKg,
      }));
    if (rows.length === 0) {
      setError('Cargá al menos la caravana en una fila.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api<ImportOk>('/animals/import/rows', {
        method: 'POST',
        body: { rows, locationId: destLocation || undefined },
      });
      setResult(res);
      setReview(null);
      setReviewSource(null);
      void sync();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los animales');
    } finally {
      setBusy(false);
    }
  }

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
        setReviewAfterMap(false);
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

  async function analyzeFile(file: File) {
    setBusy(true);
    setError('');
    setResult(null);
    setReview(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiUpload<RequiresMapping>('/animals/import/analyze', fd);
      setNeedMap(res);
      setMapSel(res.suggestedMapping ?? {});
      setPendingFile(file);
      setReviewAfterMap(false); // al confirmar el mapeo se importa directo
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo analizar el archivo');
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
    if (reviewAfterMap) await uploadExcelReview(pendingFile, clean);
    else await uploadExcel(pendingFile, clean);
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
            Sin conexión. La importación necesita internet; vas a poder importar cuando vuelva la señal.
          </span>
        </div>
      )}

      {/* ---- Importar con revisión (foto IA o Excel) ---- */}
      {!review && (
        <div className="card">
          <h2>Importar y revisar (foto o Excel)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Subí una <strong>foto</strong> de una planilla/cuaderno o un{' '}
            <strong>Excel</strong>. Detectamos los datos y te dejamos{' '}
            <strong>revisarlos y corregirlos</strong> antes de guardarlos.
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
            label="Foto de una planilla (JPG/PNG) — la lee la IA"
            accept="image/*"
            onFiles={(files) => void uploadImage(files[0])}
          />
          <div style={{ height: 8 }} />
          <Dropzone
            label="Excel para revisar antes de guardar"
            accept=".xlsx"
            onFiles={(files) => void uploadExcelReview(files[0])}
          />
          {busy && <p className="muted">Procesando…</p>}
        </div>
      )}

      {/* ---- Tabla editable de revisión ---- */}
      {review && (
        <div className="card">
          <div className="section-title" style={{ margin: 0 }}>
            <h2>Revisar antes de guardar ({review.length})</h2>
            <button className="btn-link" onClick={() => setReview(null)}>
              Cancelar
            </button>
          </div>
          <p className="muted" style={{ marginTop: 4 }}>
            {reviewSource === 'image' ? 'Datos leídos de la foto. ' : 'Datos del Excel. '}
            Corregí lo que haga falta (lo resaltado no se detectó con seguridad).
            La <strong>caravana</strong> es obligatoria.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="review-table">
              <thead>
                <tr>
                  <th>Caravana *</th>
                  <th>Especie</th>
                  <th>Raza</th>
                  <th>Sexo</th>
                  <th>Nacimiento</th>
                  <th>Peso (kg)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {review.map((r, i) => {
                  const bad = (f: AppField) => (r.issues.includes(f) ? 'cell-issue' : '');
                  return (
                    <tr key={i}>
                      <td>
                        <input
                          className={bad('tagId')}
                          value={r.tagId}
                          onChange={(e) => editRow(i, 'tagId', e.target.value)}
                          placeholder="0001"
                        />
                      </td>
                      <td>
                        <select value={r.species} onChange={(e) => editRow(i, 'species', e.target.value)}>
                          {SPECIES_OPTS.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className={bad('breed')}
                          value={r.breed}
                          onChange={(e) => editRow(i, 'breed', e.target.value)}
                          placeholder="Angus"
                        />
                      </td>
                      <td>
                        <select value={r.sex} onChange={(e) => editRow(i, 'sex', e.target.value)}>
                          {SEX_OPTS.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          className={bad('birthDate')}
                          value={r.birthDate}
                          onChange={(e) => editRow(i, 'birthDate', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          inputMode="decimal"
                          className={bad('initialWeightKg')}
                          value={r.initialWeightKg}
                          onChange={(e) => editRow(i, 'initialWeightKg', e.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td>
                        <button className="btn-link-muted" onClick={() => removeRow(i)} aria-label="Quitar fila">
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={addRow}>
              + Agregar fila
            </button>
            <button className="btn" disabled={busy} onClick={() => void saveReview()}>
              {busy ? 'Guardando…' : `Guardar ${review.length} animal(es)`}
            </button>
          </div>
        </div>
      )}

      {/* ---- Excel / CSV con mapeo inteligente (IA) ---- */}
      <div className="card">
        <h2>Importar animales (Excel o CSV)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Subí un <strong>.xlsx</strong> o <strong>.csv</strong>. La IA sugiere qué columna es
          cada dato (caravana, peso, nacimiento…) y lo <strong>confirmás</strong> antes de importar.
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
          label="Arrastrá el Excel o CSV acá o tocá para elegir"
          accept=".xlsx,.csv"
          onFiles={(files) => void analyzeFile(files[0])}
        />

        {busy && <p className="muted">Procesando…</p>}

        {needMap && (
          <div style={{ marginTop: 12 }}>
            <h2 style={{ fontSize: 15 }}>Confirmá el mapeo de columnas</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              La IA ya sugirió las asignaciones. Revisá y corregí lo que haga falta; guardamos
              esta configuración para la próxima.
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
            Importados: <strong>{result.imported}</strong> · Omitidos (duplicados):{' '}
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
        <h2>Subir fotos</h2>
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
            Asociadas: <strong>{photos.matched.length}</strong> · Sin coincidencia:{' '}
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
        <h2>Exportar animales</h2>
        <button className="btn btn-outline" onClick={() => void exportExcel()}>
          Descargar Excel
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
