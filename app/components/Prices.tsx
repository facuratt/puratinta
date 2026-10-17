'use client';

import Link from 'next/link';
import { useRef, useState, type PointerEvent } from 'react';
import { formatMoney, sheetsFor, type Sides } from '../lib/config';
import { useLive } from '../lib/settings';
import { play } from '../lib/sound';
import { ArrowUpRight, Icon3D } from './icons';

function Tilt({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || document.documentElement.dataset.perf === 'low') return;
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -10}deg`);
    ref.current!.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 12}deg`);
    ref.current!.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
  };
  const leave = () => { ref.current!.style.setProperty('--rx', '0deg'); ref.current!.style.setProperty('--ry', '0deg'); };
  return <div ref={ref} className={`tilt ${className}`} onPointerMove={move} onPointerLeave={leave}>{children}</div>;
}

function Stepper({ label, value, set, min = 1, max = 2000 }: { label: string; value: number; set: (n: number) => void; min?: number; max?: number }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="stepper">
      <span className="stepper__label">{label}</span>
      <div className="stepper__ctl">
        <button type="button" aria-label={`Menos ${label.toLowerCase()}`} onClick={() => set(clamp(value - 1))} disabled={value <= min}>−</button>
        <input type="number" inputMode="numeric" min={min} max={max} value={value} aria-label={label}
          onChange={(e) => set(clamp(Number(e.target.value) || min))} />
        <button type="button" aria-label={`Más ${label.toLowerCase()}`} onClick={() => set(clamp(value + 1))} disabled={value >= max}>+</button>
      </div>
    </div>
  );
}

export default function Prices() {
  const { prices } = useLive();
  const [pages, setPages] = useState(10);
  const [copies, setCopies] = useState(1);
  const [sides, setSides] = useState<Sides>('simple');
  const sheets = sheetsFor(pages, sides) * copies;
  const total = sheets * prices[sides];

  return (
    <section className="prices" id="precios">
      <div className="prices__head" data-reveal>
        <p className="eyebrow">Fotocopias B/N</p>
        <h2 className="display">Precios claros,<br /><em>pura tinta</em>.</h2>
        <p className="lede">Impresiones y fotocopias en blanco y negro. Lo que ves acá es lo que pagás, por hoja.</p>
      </div>

      <div className="prices__grid">
        <Tilt className="price-card" >
          <div className="price-card__inner" data-reveal>
            <Icon3D name="copies" size={150} className="price-card__icon" />
            <p className="price-card__k">Simple faz</p>
            <p className="price-card__v">{formatMoney(prices.simple)}</p>
            <p className="price-card__n">por hoja · una página por hoja</p>
          </div>
        </Tilt>
        <Tilt className="price-card price-card--alt">
          <div className="price-card__inner" data-reveal style={{ ['--d' as string]: 1 }}>
            <Icon3D name="printer" size={150} className="price-card__icon" />
            <p className="price-card__k">Doble faz</p>
            <p className="price-card__v">{formatMoney(prices.doble)}</p>
            <p className="price-card__n">por hoja · dos páginas por hoja</p>
          </div>
        </Tilt>

        <div className="calc" data-reveal style={{ ['--d' as string]: 2 }}>
          <div className="calc__top">
            <Icon3D name="calc" size={84} />
            <div>
              <p className="calc__k">Calculadora</p>
              <p className="calc__t">¿Cuánto me sale?</p>
            </div>
          </div>
          <Stepper label="Páginas" value={pages} set={setPages} />
          <Stepper label="Copias" value={copies} set={setCopies} max={500} />
          <div className="seg" role="radiogroup" aria-label="Tipo de impresión">
            {(['simple', 'doble'] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={sides === s} className={sides === s ? 'is-on' : ''}
                data-sfx="toggle" onClick={() => setSides(s)}>{s === 'simple' ? 'Simple faz' : 'Doble faz'}</button>
            ))}
          </div>
          <div className="calc__out" aria-live="polite">
            <span>{sheets} {sheets === 1 ? 'hoja' : 'hojas'}</span>
            <strong key={total} className="pop-num">{formatMoney(total)}</strong>
          </div>
          <Link href="/pedido" className="btn btn--sun btn--block" data-sfx="pop" onClick={() => play('paper')}>Subir mis archivos <ArrowUpRight /></Link>
        </div>
      </div>
    </section>
  );
}
