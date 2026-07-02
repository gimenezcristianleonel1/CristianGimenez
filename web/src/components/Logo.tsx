/** Cabeza de vaca/ternero minimalista (line-art, hereda el color con currentColor). */
export function CattleHead({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* cuernos */}
      <path d="M18 19c-3-4-2-9 2-10" />
      <path d="M30 19c3-4 2-9-2-10" />
      {/* orejas */}
      <path d="M16.5 19c-5-2-9.5 0-9.5 3.5 0 2 3.5 3 6.5 2.2" />
      <path d="M31.5 19c5-2 9.5 0 9.5 3.5 0 2-3.5 3-6.5 2.2" />
      {/* cabeza */}
      <path d="M16.5 19c-1.5 7 1 12 4 16 2 2.5 3 3 3.5 3s1.5-.5 3.5-3c3-4 5.5-9 4-16" />
      {/* hocico */}
      <path d="M21 34c1.5 1.5 4.5 1.5 6 0" />
      {/* ojos y nariz */}
      <circle cx="20.3" cy="23" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="27.7" cy="23" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="22.4" cy="31" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="25.6" cy="31" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Isotipo real de la marca (vaca + ternero en la "G") sobre su fondo olivo. */
export function BrandMark({ size = 72, radius }: { size?: number; radius?: number }) {
  return (
    <img
      src="/ICONO.jpeg"
      width={size}
      height={size}
      alt="Ganader-IA"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.22),
        objectFit: 'cover',
        display: 'block',
      }}
    />
  );
}

/** Marca de la app: isotipo + wordmark "Ganader-IA". */
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <div className="brand">
      <BrandMark size={size} />
      <div className="brand-name">
        Ganader<span className="brand-ia">-IA</span>
      </div>
    </div>
  );
}
