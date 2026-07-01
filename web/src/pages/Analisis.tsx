import { Link } from 'react-router-dom';

export default function Analisis() {
  return (
    <div>
      <div className="section-title">
        <h2>Análisis</h2>
      </div>

      <Link to="/analisis/carga" className="card" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
        <h2>📊 Carga por potrero</h2>
        <p className="muted" style={{ margin: 0 }}>
          Carga animal real de cada potrero en Equivalente Vaca por hectárea (EV/Ha). Se calcula
          en el dispositivo, funciona sin conexión.
        </p>
      </Link>

      <Link
        to="/analisis/reproductivo"
        className="card"
        style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
      >
        <h2>🩺 Reproductivo</h2>
        <p className="muted" style={{ margin: 0 }}>
          Trabajo de manga: tacto / ecografía. Registrá preñadas y vacías del lote y mirá el
          porcentaje de preñez al instante.
        </p>
      </Link>
    </div>
  );
}
