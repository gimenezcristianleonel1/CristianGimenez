/**
 * Iconos de línea minimalistas (SVG, monocromo, heredan el color con currentColor).
 * Reemplazan a los emojis en toda la interfaz para una estética robusta y sobria.
 */
export type IconName =
  | 'home'
  | 'cow'
  | 'location'
  | 'clipboard'
  | 'chart'
  | 'inbox'
  | 'sync'
  | 'logout'
  | 'user'
  | 'plus'
  | 'save'
  | 'check'
  | 'edit'
  | 'move'
  | 'key'
  | 'back'
  | 'note'
  | 'scale'
  | 'syringe'
  | 'alert'
  | 'headstone'
  | 'shuffle'
  | 'tag'
  | 'arrowInBox'
  | 'arrowOutBox'
  | 'repro'
  | 'wave'
  | 'search'
  | 'calendar'
  | 'bell';

const P: Record<IconName, JSX.Element> = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M6 10v10h12V10" /></>,
  cow: (
    <>
      <path d="M9 9c-1.6-1.8-1-4.5 1-5" />
      <path d="M15 9c1.6-1.8 1-4.5-1-5" />
      <path d="M8.2 9C5.5 8 3 9 3 11c0 1.2 2 1.8 3.6 1.3" />
      <path d="M15.8 9c2.7-1 5.2 0 5.2 2 0 1.2-2 1.8-3.6 1.3" />
      <path d="M8.2 9c-.8 3.6.6 6.2 2.2 8.2 1 1.2 1.4 1.6 1.6 1.6s.6-.4 1.6-1.6c1.6-2 3-4.6 2.2-8.2" />
      <path d="M10.4 16.5c1 .8 2.2.8 3.2 0" />
    </>
  ),
  location: <><path d="M12 21s6-5.3 6-11a6 6 0 10-12 0c0 5.7 6 11 6 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M9 12h6M9 16h4" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 20v-6M12 20V8M17 20v-9" /></>,
  inbox: <><path d="M4 13l2 6h12l2-6" /><path d="M4 13V5h16v8" /><path d="M12 6v6M9.5 9.5L12 12l2.5-2.5" /></>,
  sync: <><path d="M4 12a8 8 0 0113.5-5.8" /><path d="M20 12a8 8 0 01-13.5 5.8" /><path d="M18 3v3h-3M6 21v-3h3" /></>,
  logout: <><path d="M15 5h4v14h-4" /><path d="M4 12h11M11 8l4 4-4 4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  save: <><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7M8 20v-6h8v6" /></>,
  check: <path d="M5 12l4 4L19 7" />,
  edit: <><path d="M4 20h4L20 8l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  move: <><rect x="2" y="7" width="12" height="9" rx="1" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
  key: <><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3M21 12v4" /></>,
  back: <path d="M15 6l-6 6 6 6" />,
  note: <><path d="M5 4h9l5 5v11H5z" /><path d="M14 4v5h5" /><path d="M8 13h7M8 16h5" /></>,
  scale: <><path d="M4 20a8 8 0 0116 0z" /><path d="M12 20l3.5-6" /><path d="M12 4v2" /></>,
  syringe: <><path d="M14 4l6 6" /><path d="M18.5 5.5l-11 11L4 20" /><path d="M11 8l5 5" /><path d="M8.5 10.5l5 5" /></>,
  alert: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
  headstone: <><path d="M6 21V11a6 6 0 0112 0v10z" /><path d="M12 9v5M9.5 11.5h5" /></>,
  shuffle: <><path d="M4 8h10M11 5l3 3-3 3" /><path d="M20 16H10M13 13l-3 3 3 3" /></>,
  tag: <><path d="M3 12l7.5-7.5H19V13l-7.5 7.5z" /><circle cx="14.5" cy="8.5" r="1.4" /></>,
  arrowInBox: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v7M9 12l3 3 3-3" /></>,
  arrowOutBox: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 16V9M9 12l3-3 3 3" /></>,
  repro: <path d="M12 20s-7-4.5-7-10a3.7 3.7 0 017-1.8A3.7 3.7 0 0119 10c0 5.5-7 10-7 10z" />,
  wave: <><path d="M3 10a13 13 0 0118 0" /><path d="M6.5 13a8 8 0 0111 0" /><path d="M10 16a3 3 0 014 0" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /></>,
  bell: <><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" /><path d="M10 20a2 2 0 004 0" /></>,
};

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
