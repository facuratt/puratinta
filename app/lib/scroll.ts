'use client';

import { useEffect, type RefObject } from 'react';

// Un solo bucle de scroll para toda la página. Cada escena escribe su progreso (0..1) en la
// variable CSS --p y el CSS se encarga del resto: transform/opacity, nada que dispare layout.

type Scene = { el: HTMLElement; mode: 'pin' | 'pass'; visible: boolean; last: number; cb?: (p: number) => void };
const scenes = new Set<Scene>();
let raf = 0;
let io: IntersectionObserver | null = null;

function measure() {
  raf = 0;
  const vh = window.innerHeight;
  for (const s of scenes) {
    if (!s.visible) continue;
    const r = s.el.getBoundingClientRect();
    const p = s.mode === 'pin'
      ? Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)))
      : Math.min(1, Math.max(0, (vh - r.top) / (r.height + vh)));
    if (Math.abs(p - s.last) > 0.0005) {
      s.last = p;
      s.el.style.setProperty('--p', p.toFixed(4));
      s.cb?.(p);
    }
  }
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };

function ensure() {
  if (io) return;
  io = new IntersectionObserver((entries) => {
    for (const e of entries) for (const s of scenes) if (s.el === e.target) s.visible = e.isIntersecting;
    schedule();
  }, { rootMargin: '20% 0px' });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
}

export function useScrollScene(ref: RefObject<HTMLElement | null>, mode: 'pin' | 'pass' = 'pass', cb?: (p: number) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    ensure();
    const s: Scene = { el, mode, visible: true, last: -1, cb };
    scenes.add(s);
    io!.observe(el);
    schedule();
    return () => { scenes.delete(s); io?.unobserve(el); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, mode]);
}

/** Aparición al entrar en pantalla: agrega .is-in a todo [data-reveal]. */
let revealIO: IntersectionObserver | null = null;
export function observeReveals(root: ParentNode = document) {
  if (!revealIO) {
    revealIO = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO!.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  }
  root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => revealIO!.observe(el));
}
