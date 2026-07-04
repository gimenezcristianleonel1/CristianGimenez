import { useNavigate } from 'react-router-dom';
import FieldRecorder from '../components/FieldRecorder';

/**
 * Pantalla dedicada al registro de trabajo en el campo (destino del botón
 * flotante). Muestra el registrador siempre abierto: elegís la acción
 * (nacimiento, tratamiento, vacuna, muerte…) y el animal (nuevo o existente).
 */
export default function RegistroCampo() {
  const navigate = useNavigate();
  return (
    <div>
      <button className="link" onClick={() => navigate(-1)}>
        ← Volver
      </button>
      <div className="section-title" style={{ marginTop: 8 }}>
        <h2>Nuevo Registro</h2>
      </div>
      <FieldRecorder alwaysOpen />
    </div>
  );
}
