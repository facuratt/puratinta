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
/**
 * Mide la fluidez real cuando la página ya terminó de cargar (las imágenes de los personajes se decodifican
 * al principio y eso no cuenta). Si durante ~3 s el p75 supera ~40 ms, pasa a liviano (solo en modo automático).
 */
export function watchFrames() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  const begin = () => window.setTimeout(() => {
    if (document.documentElement.dataset.perfAuto !== '1' || getTier() === 'low' || document.hidden) return;
    const samples: number[] = [];
    let last = performance.now();
    const start = last;
    const step = (now: number) => {
      samples.push(now - last);
      last = now;
      if (now - start < 3000) { requestAnimationFrame(step); return; }
      if (document.hidden || samples.length < 30) return;
      const sorted = samples.slice(5).sort((a, b) => a - b);
      const p75 = sorted[Math.floor(sorted.length * 0.75)];
      if (p75 > 40) setTier('low', false);
    };
    requestAnimationFrame(step);
  }, 2500);
  if (document.readyState === 'complete') begin(); else window.addEventListener('load', begin, { once: true });
}
