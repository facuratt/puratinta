'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';
import { Icon3D } from './icons';

/** Encabezado de páginas internas: tipografía grande y tres íconos 3D que flotan con el puntero. */
export default function PageHead({ eyebrow, title, lede, icons, tone = 'paper' }: {
  eyebrow: string; title: ReactNode; lede?: ReactNode; icons: [string, string, string]; tone?: 'paper' | 'blush' | 'violet';
}) {
  const ref = useRef<HTMLElement>(null);
  const move = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty('--mx', `${((e.clientX - r.left) / r.width - 0.5).toFixed(3)}`);
    ref.current!.style.setProperty('--my', `${((e.clientY - r.top) / r.height - 0.5).toFixed(3)}`);
  };
  return (
    <header className={`phead phead--${tone}`} ref={ref} onPointerMove={move}>
      <div className="phead__copy">
        <p className="eyebrow rise" style={{ ['--d' as string]: 0 }}>{eyebrow}</p>
        <h1 className="display rise" style={{ ['--d' as string]: 1 }}>{title}</h1>
        {lede && <p className="lede rise" style={{ ['--d' as string]: 2 }}>{lede}</p>}
      </div>
      <div className="phead__art" aria-hidden="true">
        {icons.map((n, i) => (
          <span key={n} className={`phead__float phead__float--${i}`}><Icon3D name={n} size={i === 0 ? 260 : 170} eager /></span>
        ))}
      </div>
    </header>
  );
}
