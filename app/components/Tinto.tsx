'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TintoEngine } from '../lib/tintoEngine';
import { play } from '../lib/sound';
import { ArrowUpRight, Loop } from './icons';
import TintoStage from './TintoStage';
import Ticker from './Ticker';

const MOODS = [
  { max: 90, label: 'Tranqui' },
  { max: 650, label: 'Curioso' },
  { max: 1700, label: 'Sospechoso' },
  { max: Infinity, label: 'Desatado' },
];

function describe(x: number, y: number) {
  if (Math.hypot(x, y) < 0.25) return 'De frente';
  const v = y < -0.35 ? 'arriba' : y > 0.35 ? 'abajo' : '';
  const h = x < -0.35 ? 'izquierda' : x > 0.35 ? 'derecha' : '';
  return [v, h].filter(Boolean).join(' a la ') || 'De frente';
}

/** Panel "control de calidad" (de pouterby/LiveFeed): radar de mirada + ánimo según la velocidad del cursor. */
function QualityFeed({ engine, progress }: { engine: TintoEngine; progress: number }) {
  const dot = useRef<SVGGElement>(null);
  const aim = useRef<SVGGElement>(null);
  const trail = useRef<SVGPolylineElement>(null);
  const where = useRef<HTMLElement>(null);
  const mood = useRef<HTMLElement>(null);
  const bars = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pts: string[] = [];
    let lastWhere = '';
    let lastMood = -1;
    return engine.subscribe((e) => {
      if (!dot.current) return;
      const R = 46;
      const lx = e.look.x * R;
      const ly = e.look.y * R;
      dot.current.setAttribute('transform', `translate(${lx.toFixed(1)} ${ly.toFixed(1)})`);
      aim.current!.setAttribute('transform', `translate(${(e.aim.x * R).toFixed(1)} ${(e.aim.y * R).toFixed(1)})`);
      pts.push(`${lx.toFixed(1)},${ly.toFixed(1)}`);
      if (pts.length > 40) pts.shift();
      trail.current!.setAttribute('points', pts.join(' '));
      const w = describe(e.look.x, e.look.y);
      if (w !== lastWhere) where.current!.textContent = lastWhere = w;
      const speed = e.mode === 'script' ? 700 : e.speed;
      const lvl = MOODS.findIndex((m) => speed < m.max);
      if (lvl !== lastMood) {
        lastMood = lvl;
        mood.current!.textContent = e.mode === 'script' ? 'Revisando' : MOODS[lvl].label;
        [...bars.current!.children].forEach((b, i) => b.classList.toggle('is-on', i <= lvl));
      }
    });
  }, [engine]);

  return (
    <aside className="feed" aria-label="Control de calidad en vivo">
      <header className="feed__head">
        <span className="feed__rec" /> Control de calidad
        <span className="feed__load">{progress < 1 ? `${Math.round(progress * 100)}%` : 'en vivo'}</span>
      </header>
      <div className="feed__radar">
        <svg viewBox="-60 -60 120 120" aria-hidden="true">
          <circle r="54" className="r-ring" />
          <circle r="34" className="r-ring r-ring--in" />
          <path d="M-54 0H54M0-54V54" className="r-cross" />
          <polyline ref={trail} className="r-trail" />
          <g ref={aim}><circle r="5" className="r-aim" /></g>
          <g ref={dot}><circle r="7.5" className="r-dot" /><circle r="13" className="r-halo" /></g>
          <text x="0" y="-46" className="r-lbl">ARR</text>
          <text x="0" y="51" className="r-lbl">ABJ</text>
          <text x="-46" y="2.5" className="r-lbl">IZ</text>
          <text x="46" y="2.5" className="r-lbl">DER</text>
        </svg>
        <div><small>Mirando</small><strong ref={where}>De frente</strong></div>
      </div>
      <div className="feed__mood">
        <div><small>Ánimo</small><strong ref={mood}>Tranqui</strong></div>
        <div className="feed__bars" ref={bars}><i /><i /><i /><i /></div>
      </div>
    </aside>
  );
}

export default function Tinto() {
  const [engine, setEngine] = useState<TintoEngine | null>(null);
  const [progress, setProgress] = useState(0);
  const onProgress = useCallback((p: number) => setProgress(p), []);

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
      {engine && <TintoStage engine={engine} onProgress={onProgress} />}
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
        {engine && <div className="tinto__stack" data-reveal><QualityFeed engine={engine} progress={progress} /></div>}
      </div>
      <Ticker tone="violet" />
      <p className="sr-only">Un monito amarillo animado sobre un escenario violeta que gira la cabeza hacia donde va el cursor.</p>
    </section>
  );
}
