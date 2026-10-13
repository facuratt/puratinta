'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  actions: ReactNode;
};

// Impresora 3D hecha con CSS: el ticket sale por la ranura de arriba, línea por línea.
export default function Printer3D({ children, actions }: Props) {
  const paperRef = useRef<HTMLDivElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  const [paperHeight, setPaperHeight] = useState(0);

  useEffect(() => {
    const paper = paperRef.current!;
    const height = ticketRef.current!.offsetHeight;
    // Reserva lugar arriba de la impresora para todo el ticket.
    setPaperHeight(height);
    // Mantener la impresora a la vista mientras imprime (en pantallas bajas el overlay scrollea).
    requestAnimationFrame(() => {
      const overlay = paper.closest('.printer-overlay');
      if (overlay) overlay.scrollTop = overlay.scrollHeight;
    });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      paper.style.height = `${height}px`;
      setDone(true);
      return;
    }
    const animation = paper.animate(
      [{ height: '0px' }, { height: `${height}px` }],
      { duration: 900 + height * 4.5, delay: 500, easing: `steps(${Math.round(height / 14)}, end)`, fill: 'forwards' },
    );
    animation.onfinish = () => setDone(true);
    return () => animation.cancel();
  }, []);

  return (
    <div className="printer-overlay" role="dialog" aria-modal="true" aria-label="Ticket de tu pedido">
      <div className="printer-stage">
        <div className={`printer-scene${done ? '' : ' is-printing'}`} style={{ marginTop: Math.round(paperHeight * 1.2) + 40 }}>
          <div className="printer-body">
            {/* El papel vive dentro de la escena 3D, parado sobre la ranura de la tapa. */}
            <div className="printer-paper" ref={paperRef}>
              <div className="printer-paper-inner" ref={ticketRef}>{children}</div>
            </div>
            <div className="pf pf-front" aria-hidden="true">
              <span className="pf-label">pura tinta</span>
              <span className="pf-led" />
              <span className="pf-buttons"><i /><i /></span>
            </div>
            <div className="pf pf-back" aria-hidden="true" />
            <div className="pf pf-right" aria-hidden="true" />
            <div className="pf pf-left" aria-hidden="true" />
            <div className="pf pf-top" aria-hidden="true"><span className="pf-slot" /></div>
            <div className="pf pf-bottom" aria-hidden="true" />
          </div>
          <div className="printer-shadow" aria-hidden="true" />
        </div>
        <div className={`printer-actions${done ? ' is-visible' : ''}`}>{actions}</div>
      </div>
    </div>
  );
}
