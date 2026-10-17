import type { SVGProps } from 'react';

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
type P = SVGProps<SVGSVGElement>;

export const ArrowUpRight = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M7 17 17 7M8 7h9v9" /></svg>);
export const ArrowRight = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const Chevron = ({ dir = 'right', ...p }: P & { dir?: 'right' | 'left' | 'down' }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d={dir === 'right' ? 'M9 5l7 7-7 7' : dir === 'left' ? 'M15 5l-7 7 7 7' : 'M5 9l7 7 7-7'} /></svg>
);
export const Loop = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></svg>);
export const Menu = (p: P) => (<svg viewBox="0 0 24 24" width="22" height="22" {...line} {...p}><path d="M4 8h16M4 16h10" /></svg>);
export const Close = (p: P) => (<svg viewBox="0 0 24 24" width="22" height="22" {...line} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const Speaker = ({ on = true, ...p }: P & { on?: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...line} {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
  </svg>
);
export const Lock = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>);
export const Upload = (p: P) => (<svg viewBox="0 0 24 24" width="20" height="20" {...line} {...p}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>);
export const FileIcon = (p: P) => (<svg viewBox="0 0 24 24" width="20" height="20" {...line} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>);
export const Trash = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>);
export const Download = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>);
export const Printer = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></svg>);
export const Copy = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>);
export const Check = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const Clock = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const Search = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>);
export const Bolt = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" /></svg>);
export const LogOut = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>);
export const Eye = (p: P) => (<svg viewBox="0 0 24 24" width="18" height="18" {...line} {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>);

export const WhatsAppGlyph = (p: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
    <path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.3 21.7l4.8-1.3A9.8 9.8 0 1 0 12 2.2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M8.7 7.1c.3-.3.8-.2 1 .2l1 1.9c.2.3.1.7-.1 1l-.6.6c.6 1.3 1.6 2.3 2.9 2.9l.6-.6c.3-.3.7-.3 1-.1l1.9 1c.4.2.5.7.2 1l-.8.9c-.6.6-1.5.8-2.3.4a10 10 0 0 1-5-5c-.4-.8-.2-1.7.4-2.3z" fill="currentColor" />
  </svg>
);
export const InstagramGlyph = (p: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <rect x="2.9" y="2.9" width="18.2" height="18.2" rx="5.2" /><circle cx="12" cy="12" r="4.3" /><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

/** Ícono 3D renderizado (public/icons). */
export function Icon3D({ name, size = 96, alt = '', className = '', eager = false }: { name: string; size?: number; alt?: string; className?: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`icon3d ${className}`} src={`/icons/${name}.webp`} width={size} height={size} alt={alt}
      loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} />
  );
}
