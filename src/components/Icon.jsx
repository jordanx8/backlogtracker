/**
 * Thin SVG icon set — 16×16 viewport, 1.5px stroke, rounded caps/joins.
 * All icons inherit `currentColor` so they follow the CSS text colour.
 *
 * Usage:  <Icon name="edit" />
 *         <Icon name="star" size={14} className="star--filled" />
 */

const ICONS = {
  // ── Navigation / tabs ───────────────────────────────────────────────────────
  home: (
    <path d="M2 9 L8 3 L14 9 V14 H10 V11 H6 V14 H2 Z"
      strokeLinejoin="round" />
  ),
  collection: (
    <>
      <rect x="2" y="4" width="5" height="9" rx="1" />
      <rect x="9" y="4" width="5" height="9" rx="1" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="9" y1="7" x2="14" y2="7" />
    </>
  ),
  wishlist: (
    <path d="M8 13 C8 13 2 9.5 2 5.5 A3 3 0 0 1 8 4.2 A3 3 0 0 1 14 5.5 C14 9.5 8 13 8 13 Z"
      strokeLinejoin="round" />
  ),
  journal: (
    <>
      <rect x="3" y="2" width="10" height="12" rx="1" />
      <line x1="6" y1="6" x2="10" y2="6" />
      <line x1="6" y1="9" x2="10" y2="9" />
      <line x1="6" y1="12" x2="9" y2="12" />
      <rect x="2" y="2" width="2" height="12" rx="0.5" fill="currentColor" stroke="none" opacity="0.35" />
    </>
  ),
  stats: (
    <>
      <rect x="2"  y="9"  width="3" height="5" rx="0.5" />
      <rect x="6.5" y="6" width="3" height="8" rx="0.5" />
      <rect x="11" y="3"  width="3" height="11" rx="0.5" />
    </>
  ),

  // ── Actions ─────────────────────────────────────────────────────────────────
  edit: (
    <>
      <path d="M11 3 L13 5 L6 12 L3 13 L4 10 Z" strokeLinejoin="round" />
      <line x1="9.5" y1="4.5" x2="11.5" y2="6.5" />
    </>
  ),
  trash: (
    <>
      <polyline points="3,5 5,5 13,5" strokeLinejoin="round" />
      <path d="M6 5 V4 A1 1 0 0 1 10 4 V5" strokeLinejoin="round" />
      <path d="M5 5 L5.5 13 A1 1 0 0 0 6.5 14 H9.5 A1 1 0 0 0 10.5 13 L11 5 Z" strokeLinejoin="round" />
      <line x1="8" y1="8" x2="8" y2="11" />
    </>
  ),
  close: (
    <>
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </>
  ),
  check: (
    <polyline points="3,8 6.5,12 13,4" strokeLinejoin="round" />
  ),
  plus: (
    <>
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </>
  ),
  import: (
    <>
      <polyline points="5,7 8,4 11,7" strokeLinejoin="round" />
      <line x1="8" y1="4" x2="8" y2="11" />
      <line x1="3" y1="13" x2="13" y2="13" />
    </>
  ),
  play: (
    <polygon points="4,2 14,8 4,14" strokeLinejoin="round" />
  ),

  sync: (
    <>
      <path d="M13 8 A5 5 0 1 1 10 3.5" strokeLinecap="round" />
      <polyline points="10,1.5 10,4 12.5,4" strokeLinejoin="round" />
    </>
  ),

  // ── Media / content ─────────────────────────────────────────────────────────
  gamepad: (
    <>
      <rect x="2" y="5" width="12" height="7" rx="2" />
      <line x1="5" y1="8.5" x2="7" y2="8.5" />
      <line x1="6" y1="7.5" x2="6" y2="9.5" />
      <circle cx="10.5" cy="8" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12"   cy="9" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  dice: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <circle cx="5"  cy="5"  r="1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="5"  r="1" fill="currentColor" stroke="none" />
      <circle cx="8"  cy="8"  r="1" fill="currentColor" stroke="none" />
      <circle cx="5"  cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="11" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  star: (
    <polygon points="8,2 9.8,6.2 14.5,6.6 11,9.7 12.1,14.3 8,11.8 3.9,14.3 5,9.7 1.5,6.6 6.2,6.2"
      strokeLinejoin="round" />
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6" />
      <polyline points="8,5 8,8 10.5,9.5" strokeLinejoin="round" />
    </>
  ),
  timer: (
    <>
      <circle cx="8" cy="9" r="5" />
      <polyline points="8,6.5 8,9 10,10.5" strokeLinejoin="round" />
      <line x1="6" y1="2" x2="10" y2="2" />
      <line x1="8" y1="2" x2="8" y2="4" />
    </>
  ),
  image: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <circle cx="5.5" cy="6.5" r="1.2" />
      <polyline points="2,11 5,8 8,10.5 10.5,7.5 14,11" strokeLinejoin="round" />
    </>
  ),

  // ── Data / metadata ─────────────────────────────────────────────────────────
  physical: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="3.5" fill="none" strokeDasharray="2 1.5" />
    </>
  ),
  digital: (
    <>
      <rect x="2" y="4" width="12" height="8" rx="1" />
      <line x1="5" y1="14" x2="11" y2="14" />
      <line x1="8" y1="12" x2="8" y2="14" />
      <line x1="5" y1="7"  x2="11" y2="7" />
      <line x1="5" y1="9"  x2="9"  y2="9" />
    </>
  ),
  building: (
    <>
      <rect x="3" y="3" width="10" height="11" rx="0.5" />
      <rect x="6" y="9" width="2" height="5" />
      <rect x="5" y="5" width="2" height="2" />
      <rect x="9" y="5" width="2" height="2" />
      <rect x="5" y="8" width="2" height="2" rx="0.3" opacity="0.5" fill="currentColor" stroke="none" />
      <rect x="9" y="8" width="2" height="2" rx="0.3" opacity="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  books: (
    <>
      <rect x="3"  y="3" width="3" height="10" rx="0.5" />
      <rect x="7"  y="5" width="3" height="8"  rx="0.5" />
      <rect x="11" y="2" width="2" height="11" rx="0.5" />
    </>
  ),
  folder: (
    <>
      <path d="M2 5 A1 1 0 0 1 3 4 H6 L7.5 5.5 H13 A1 1 0 0 1 14 6.5 V12 A1 1 0 0 1 13 13 H3 A1 1 0 0 1 2 12 Z"
        strokeLinejoin="round" />
    </>
  ),
  archive: (
    <>
      <rect x="2" y="3" width="12" height="3" rx="0.5" />
      <rect x="3" y="6" width="10" height="7" rx="0.5" />
      <line x1="6" y1="9" x2="10" y2="9" />
    </>
  ),
  lightning: (
    <polygon points="9,2 4,9 8,9 7,14 12,7 8,7" strokeLinejoin="round" />
  ),
  chart: (
    <>
      <polyline points="2,12 5,7 8,9 11,5 14,7" strokeLinejoin="round" />
      <line x1="2" y1="14" x2="14" y2="14" />
    </>
  ),
}

export default function Icon({ name, size = 16, className = '', style = {} }) {
  const paths = ICONS[name]
  if (!paths) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={style}
    >
      {paths}
    </svg>
  )
}
