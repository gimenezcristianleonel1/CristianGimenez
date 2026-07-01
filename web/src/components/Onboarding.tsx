import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

interface Slide {
  emoji: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    emoji: '👋',
    title: '¡Bienvenido!',
    body: 'Tu campo en el bolsillo. La app funciona SIN conexión: cargás todo en el momento y se sincroniza sola cuando hay señal.',
  },
  {
    emoji: '🐄',
    title: 'Cargá tu rodeo',
    body: 'Entrá a “Animales” y tocá el botón ➕ para registrar cada animal (caravana, raza, madre/padre). ¿Tenés una planilla? Importala desde Excel en “Importar”.',
  },
  {
    emoji: '📍',
    title: 'Potreros y carga',
    body: 'Creá tus potreros con sus hectáreas. En “Análisis” vas a ver la carga real (EV por hectárea) y te avisa si hay riesgo de sobrepastoreo.',
  },
  {
    emoji: '🩺',
    title: 'Reproducción y recorridas',
    body: 'Registrá tactos, servicios, pariciones y destetes. En cada animal, la pestaña “Novedades” anota condición corporal, tratamientos, muertes, cambios de caravana y más.',
  },
  {
    emoji: '📋',
    title: 'Todo queda registrado',
    body: 'Cada animal tiene su historia completa y trazable, con tareas y recordatorios, y un panel de inicio con los números clave. ¡Listo para empezar!',
  },
];

export default function Onboarding() {
  const { establishment } = useAuth();
  const key = `lg_onboarding_seen_${establishment?.id ?? 'anon'}`;
  const [visible, setVisible] = useState<boolean>(() => !localStorage.getItem(key));
  const [step, setStep] = useState(0);

  if (!visible) return null;

  const close = () => {
    localStorage.setItem(key, '1');
    setVisible(false);
  };

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  return (
    <div className="onb-backdrop" role="dialog" aria-modal="true" aria-label="Guía de inicio">
      <div className="onb-card">
        <button className="onb-skip" onClick={close}>
          Saltar tutorial
        </button>
        <div className="onb-emoji">{slide.emoji}</div>
        <h2>{slide.title}</h2>
        <p>{slide.body}</p>

        <div className="onb-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`onb-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>

        <div className="onb-row">
          {step > 0 && (
            <button className="btn btn-outline" style={{ marginTop: 0 }} onClick={() => setStep((s) => s - 1)}>
              ← Atrás
            </button>
          )}
          {isLast ? (
            <button className="btn" style={{ marginTop: 0 }} onClick={close}>
              ✅ ¡Empezar!
            </button>
          ) : (
            <button className="btn" style={{ marginTop: 0 }} onClick={() => setStep((s) => s + 1)}>
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
