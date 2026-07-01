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
        <h2>🩺 Reproductivo (manga)</h2>
        <p className="muted" style={{ margin: 0 }}>
          Trabajo de manga: tacto / ecografía. Registrá preñadas y vacías del lote y mirá el
          porcentaje de preñez al instante.
        </p>
      </Link>

      <Link
        to="/analisis/indices"
        className="card"
        style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
      >
        <h2>📈 Índices reproductivos</h2>
        <p className="muted" style={{ margin: 0 }}>
          % de preñez, parición, destete y merma del rodeo, calculados automáticamente de tus
          datos.
        </p>
      </Link>

      <Link
        to="/analisis/historia"
        className="card"
        style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
      >
        <h2>📖 Historia por animal</h2>
        <p className="muted" style={{ margin: 0 }}>
          Línea de tiempo de cada vientre: servicio → tacto → parición → destete. Registrá los
          eventos del ciclo y quedan en su historia.
        </p>
      </Link>
    </div>
  );
}
