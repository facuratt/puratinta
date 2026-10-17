'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useScrollScene } from '../lib/scroll';
import { play } from '../lib/sound';
import { ArrowUpRight, Icon3D } from './icons';

const STEPS = [
  { n: '01', title: 'Subí tus archivos', text: 'PDF, Word o imágenes, hasta 50 MB cada uno. Las páginas de los PDF se cuentan solas.', icon: 'upload' },
  { n: '02', title: 'Elegí copias y faz', text: 'Simple o doble faz y cuántas copias de cada archivo. Ves el total antes de confirmar.', icon: 'printer' },
  { n: '03', title: 'Retiralos impresos', text: 'Te llevás tu ticket con el número de pedido y te avisamos por WhatsApp cuando esté listo.', icon: 'bag' },
];

// Trazo de tinta que une las tres estaciones (coordenadas del viewBox).
const PATH_WIDE = 'M120 470 C 230 300, 330 260, 420 330 S 560 520, 640 420 S 760 170, 880 230';
const STATIONS_WIDE = [[120, 470], [534, 439], [880, 230]];
const PATH_TALL = 'M200 120 C 520 130, 560 300, 360 380 S 120 600, 330 700 S 620 820, 520 980';
const STATIONS_TALL = [[200, 120], [191, 533], [520, 980]];

/** Sección scroll-driven: un trazo de tinta se dibuja mientras bajás y una hoja viaja por las tres estaciones. */
export default function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [tall, setTall] = useState(false);
  const activeRef = useRef(0);
  const geo = useRef({ len: 1, w: 1, h: 1, vw: 1000, vh: 620 });

  useEffect(() => {
    const mq = matchMedia('(max-width: 860px)');
    const on = () => setTall(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const path = pathRef.current!;
    const box = boxRef.current!;
    const measure = () => {
      geo.current = { len: path.getTotalLength(), w: box.clientWidth, h: box.clientHeight, vw: 1000, vh: tall ? 1100 : 620 };
      path.style.strokeDasharray = `${geo.current.len}`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [tall]);

  const lastP = useRef({ p: 0, t: 0 });
  const onProgress = useCallback((p: number) => {
    const path = pathRef.current;
    const sheet = sheetRef.current;
    if (!path || !sheet) return;
    const { len, w, h, vw, vh } = geo.current;
    // El trazo avanza un poco por delante de la hoja.
    const t = Math.min(1, Math.max(0, (p - 0.04) / 0.86));
    path.style.strokeDashoffset = `${len * (1 - Math.min(1, t * 1.04))}`;
    const pt = path.getPointAtLength(len * t);
    const ahead = path.getPointAtLength(Math.min(len, len * t + 4));
    const ang = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * (180 / Math.PI);
    const sx = (pt.x / vw) * w;
    const sy = (pt.y / vh) * h;
    sheet.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) rotate(${(ang * 0.35).toFixed(1)}deg)`;
    // Velocidad del scroll en "secciones por segundo": si se pasa de largo (un link del menú que
    // salta más abajo), no suena nada; solo cuando la persona recorre los pasos.
    const now = performance.now();
    const v = Math.abs(p - lastP.current.p) / Math.max(1, now - lastP.current.t) * 1000;
    lastP.current = { p, t: now };
    const idx = p < 0.36 ? 0 : p < 0.7 ? 1 : 2;
    if (idx !== activeRef.current) {
      const forward = idx > activeRef.current;
      activeRef.current = idx;
      setActive(idx);
      // Llega a la impresora: suena imprimiendo. Llega al retiro: suena "listo". Volviendo: papel.
      if (v < 1.6) play(forward ? (idx === 1 ? 'printing' : idx === 2 ? 'check' : 'paper') : 'paper');
    }
  }, []);

  useScrollScene(ref, 'pin', onProgress);

  const stations = tall ? STATIONS_TALL : STATIONS_WIDE;
  const vh = tall ? 1100 : 620;

  return (
    <section className="how" id="como-funciona" ref={ref}>
      <div className="how__sticky">
        <div className="how__copy">
          <p className="eyebrow">Cómo funciona</p>
          <h2 className="display">Tres pasos y <em>listo</em>.</h2>
          <div className="how__counter" aria-hidden="true">
            <span className="how__num">{STEPS[active].n}</span><span>/03</span>
          </div>
          <ol className="how__steps">
            {STEPS.map((s, i) => (
              <li key={s.n} className={i === active ? 'is-active' : i < active ? 'is-done' : ''} aria-current={i === active ? 'step' : undefined}>
                <h3><span>{s.n}</span>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
          <Link href="/pedido" className="btn btn--ink" data-sfx="pop">Empezar mi pedido <ArrowUpRight /></Link>
        </div>

        <div className="how__stage">
          <div className={`how__box${tall ? " how__box--tall" : ""}`} ref={boxRef}>
            <svg viewBox={`0 0 1000 ${vh}`} preserveAspectRatio="none" aria-hidden="true">
              <path d={tall ? PATH_TALL : PATH_WIDE} className="how__ghost" />
              <path ref={pathRef} d={tall ? PATH_TALL : PATH_WIDE} className="how__ink" />
            </svg>
            {stations.map(([x, y], i) => (
              <div key={i} className={`how__station${i <= active ? ' is-lit' : ''}${i === active ? ' is-active' : ''}`}
                style={{ left: `${(x / 1000) * 100}%`, top: `${(y / vh) * 100}%` }}>
                <Icon3D name={STEPS[i].icon} size={180} />
                <span className="how__label">{STEPS[i].n} · {STEPS[i].title}</span>
              </div>
            ))}
            <div className="how__sheet" ref={sheetRef} aria-hidden="true">
              <div className="how__page"><i /><i /><i /><i /><i /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
