'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TintoEngine } from '../lib/tintoEngine';
import { play } from '../lib/sound';
import { ArrowUpRight, Loop } from './icons';
import TintoStage from './TintoStage';
import Ticker from './Ticker';

export default function Tinto() {
  const [engine, setEngine] = useState<TintoEngine | null>(null);

  useEffect(() => {
    const e = new TintoEngine();
    setEngine(e);
    const move = (ev: PointerEvent) => { if (e.running) e.point(ev.clientX, ev.clientY); };
    const out = (ev: PointerEvent) => { if (!ev.relatedTarget) e.release(); };
    const blur = () => e.release();
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    document.addEventListener('pointerout', out);
    window.addEventListener('blur', blur);
    return () => {
      e.stop();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      document.removeEventListener('pointerout', out);
      window.removeEventListener('blur', blur);
    };
  }, []);

  return (
    <section className="tinto" id="tinto">
      {engine && <TintoStage engine={engine} />}
      <div className="tinto__tint" aria-hidden="true" />
      <div className="tinto__ui">
        <div className="tinto__copy">
          <p className="tag" data-reveal><span className="tag__pulse" /> El encargado del mostrador</p>
          <h2 className="tinto__title" data-reveal>Tinto revisa <em>cada copia.</em></h2>
          <p className="tinto__blurb" data-reveal>
            Desconfía de las hojas torcidas y de los márgenes chuecos. Movete por la pantalla: no te pierde de vista,
            igual que a tu pedido desde que lo mandás hasta que lo retirás.
          </p>
          <div className="tinto__actions" data-reveal>
            <Link href="/pedido" className="btn btn--sun btn--lg" data-sfx="pop">
              Mandarle un pedido <span className="btn__icon btn__icon--ink"><ArrowUpRight /></span>
            </Link>
            <button type="button" className="link-btn" onClick={() => { engine?.lookAround(); play('swoosh'); }} data-sfx="none">
              <Loop /> Mirá cómo revisa
            </button>
          </div>
        </div>
      </div>
      <Ticker tone="violet" />
      <p className="sr-only">Un monito amarillo animado sobre un escenario violeta que gira la cabeza hacia donde va el cursor.</p>
    </section>
  );
}
