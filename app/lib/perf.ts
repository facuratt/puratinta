'use client';

// Rendimiento: "alto" en PCs y celulares potentes, "liviano" en equipos modestos.
// El script inline de layout.tsx decide antes del primer pintado (html[data-perf]).
// Además, si en los primeros segundos los cuadros tardan demasiado, bajamos a liviano solos.

export type Tier = 'high' | 'low';

export const PERF_SCRIPT = `(function(){try{var d=document.documentElement,o=localStorage.getItem('pt-perf');var n=navigator,s=0;
if(n.deviceMemory&&n.deviceMemory<=4)s++;if(n.hardwareConcurrency&&n.hardwareConcurrency<=4)s++;
if(n.connection&&n.connection.saveData)s+=2;if(matchMedia('(prefers-reduced-motion: reduce)').matches)s+=2;
d.dataset.perf=o==='high'||o==='low'?o:(s>=2?'low':'high');d.dataset.perfAuto=o?'0':'1';
if(matchMedia('(hover: hover) and (pointer: fine)').matches)d.classList.add('fine');}catch(e){}})();`;

export const getTier = (): Tier =>
  (typeof document !== 'undefined' && document.documentElement.dataset.perf === 'low' ? 'low' : 'high');

const subs = new Set<(t: Tier) => void>();
export function onTierChange(fn: (t: Tier) => void) { subs.add(fn); return () => { subs.delete(fn); }; }

export function setTier(t: Tier, persist = true) {
  const d = document.documentElement;
  if (d.dataset.perf === t && !persist) return;
  d.dataset.perf = t;
  if (persist) {
    try { localStorage.setItem('pt-perf', t); } catch {}
    d.dataset.perfAuto = '0';
  }
  subs.forEach((fn) => fn(t));
}

let watching = false;
/** Mide los cuadros de los primeros ~4 s; si el p75 supera ~30 ms, pasa a liviano (solo en modo automático). */
export function watchFrames() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  if (document.documentElement.dataset.perfAuto !== '1' || getTier() === 'low') return;
  const samples: number[] = [];
  let last = performance.now();
  const start = last;
  const step = (now: number) => {
    samples.push(now - last);
    last = now;
    if (now - start < 4200) { requestAnimationFrame(step); return; }
    if (document.hidden || samples.length < 30) return;
    const sorted = samples.slice(10).sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    if (p75 > 30) setTier('low', false);
  };
  requestAnimationFrame(step);
}
