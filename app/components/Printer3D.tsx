'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { play } from '../lib/sound';

type Props = {
  children: ReactNode;   // el ticket
  actions: ReactNode;    // botones que aparecen al terminar
  note?: ReactNode;
  onClose?: () => void;
};

/**
 * Impresora de tickets en 3D (CSS). El papel sale por la RANURA de la tapa: el pozo del papel termina
 * exactamente en el labio delantero de la ranura, así que el ticket nunca se ve por detrás de la máquina.
 * Capas: tapa trasera + boca oscura de la ranura → papel → labio delantero + frente.
 */
export default function Printer3D({ children, actions, note, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [scale, setScale] = useState(1);
  const [phase, setPhase] = useState<'warm' | 'printing' | 'done'>('warm');

  useLayoutEffect(() => {
    const h = ticketRef.current!.offsetHeight;
    setHeight(h);
    const fit = () => {
      const vh = window.innerHeight;
      const room = vh - (window.innerWidth < 640 ? 230 : 270);
      setScale(Math.max(0.5, Math.min(1, room / h)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (!height) return;
    const paper = paperRef.current!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('modal-open');
    if (reduced) {
      paper.style.transform = 'translate3d(0,0,0)';
      setPhase('done');
      return;
    }
    let y = height;
    let timer = 0;
    paper.style.transform = `translate3d(0, ${y}px, 0)`;
    const LINE = 14;
    const start = window.setTimeout(() => {
      setPhase('printing');
      play('stamp');
      const step = () => {
        y = Math.max(0, y - LINE);
        paper.style.transform = `translate3d(0, ${y}px, 0)`;
        play('print');
        if (y > 0) { timer = window.setTimeout(step, 34 + Math.random() * 10); return; }
        play('cut');
        paper.classList.add('is-cut');
        timer = window.setTimeout(() => { setPhase('done'); play('ding'); }, 380);
      };
      step();
    }, 650);
    return () => { clearTimeout(start); clearTimeout(timer); };
  }, [height]);

  useEffect(() => () => document.documentElement.classList.remove('modal-open'), []);

  useEffect(() => {
    if (phase !== 'done') return;
    // Al terminar, el ticket crece a tamaño real y llevamos la vista a su encabezado.
    window.setTimeout(() => overlayRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 420);
    const first = actionsRef.current?.querySelector<HTMLElement>('a, button');
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  return (
    <div className={`pr-overlay is-${phase}`} ref={overlayRef} role="dialog" aria-modal="true" aria-label="Tu ticket de pedido">
      <div className="pr-stage">
        <div className="pr-scene" style={{ ['--s' as string]: phase === 'done' ? 1 : scale, ['--h' as string]: `${height}px` }}>
          {/* Pozo del papel: su borde inferior es el labio de la ranura. */}
          <div className="pr-well" style={{ height }}>
            <div className="pr-paper" ref={paperRef} style={{ transform: `translate3d(0, ${height || 2000}px, 0)` }}>
              <div ref={ticketRef}>{children}</div>
            </div>
          </div>

          <div className="pr-machine" aria-hidden="true">
            <div className="pr-top">
              <span className="pr-slot" />
              <span className="pr-lip" />
            </div>
            <div className="pr-front">
              <span className="pr-face"><i /><i /></span>
              <span className="pr-label">pura tinta</span>
              <span className="pr-led" />
              <span className="pr-btns"><i /><i /></span>
              <span className="pr-vent" />
            </div>
            <div className="pr-side" />
            <span className="pr-shadow" />
          </div>
        </div>

        <div className={`pr-actions${phase === 'done' ? ' is-visible' : ''}`} ref={actionsRef}>
          <p className="pr-status" aria-live="polite">
            {phase === 'warm' ? 'Calentando la impresora…' : phase === 'printing' ? 'Imprimiendo tu ticket…' : '¡Listo! Tu pedido quedó registrado.'}
          </p>
          {phase === 'done' && note}
          <div className="pr-buttons">{actions}</div>
        </div>
      </div>
    </div>
  );
}
