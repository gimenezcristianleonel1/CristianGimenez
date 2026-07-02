import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Icon, type IconName } from './Icon';
import { BrandMark } from './Logo';

interface Slide {
  icon: IconName | 'brand';
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'brand',
    title: 'Bienvenido a Ganader-IA',
    body: 'Tu campo en el bolsillo. La app funciona SIN conexión: cargás todo en el momento y se sincroniza sola cuando hay señal.',
  },
  {
    icon: 'cow',
    title: 'Cargá tu rodeo',
    body: 'Entrá a “Animales” y tocá el botón + para registrar cada animal (caravana, raza, madre/padre). ¿Tenés una planilla? Importala desde Excel en “Importar”.',
  },
  {
    icon: 'location',
    title: 'Potreros y carga',
    body: 'Creá tus potreros con sus hectáreas. En “Análisis” vas a ver la carga real (EV por hectárea) y te avisa si hay riesgo de sobrepastoreo.',
  },
  {
    icon: 'repro',
    title: 'Reproducción y recorridas',
    body: 'Registrá tactos, servicios, pariciones y destetes. En cada animal, la pestaña “Novedades” anota condición corporal, tratamientos, muertes, cambios de caravana y más.',
  },
  {
    icon: 'clipboard',
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
        <div className="onb-emoji">
          {slide.icon === 'brand' ? <BrandMark size={72} /> : <Icon name={slide.icon} size={56} strokeWidth={1.6} />}
        </div>
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
              ¡Empezar!
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
