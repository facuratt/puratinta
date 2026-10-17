'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { getTier, onTierChange, watchFrames } from '../lib/perf';
import { observeReveals } from '../lib/scroll';
import { play, unlockAudio } from '../lib/sound';

/**
 * Efectos globales: sonidos de interfaz (delegados, sin tocar cada botón), apariciones al
 * scrollear, control de rendimiento y el cursor-gota de tinta que los personajes siguen.
 */
export default function AppEffects() {
  const pathname = usePathname();
  const cursorRef = useRef<HTMLDivElement>(null);

  // Sonidos: click al presionar, tick suave al pasar por encima, tecleo en campos.
  useEffect(() => {
    const target = (e: Event) => (e.target as Element | null)?.closest?.('a, button, [role="tab"], [data-sfx], summary, label.switch') as HTMLElement | null;
    const down = (e: PointerEvent) => {
      unlockAudio();
      const el = target(e);
      if (!el || (el as HTMLButtonElement).disabled) return;
      const kind = el.dataset.sfx;
      if (kind === 'none') return;
      play((kind as Parameters<typeof play>[0]) || 'click');
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = target(e);
      if (el && !(el as HTMLButtonElement).disabled && !el.contains(e.relatedTarget as Node)) play('tick');
    };
    const key = (e: KeyboardEvent) => {
      unlockAudio();
      const t = e.target as HTMLElement;
      if ((t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && e.key.length === 1) play('key');
      if (e.key === 'Enter' && t.closest?.('a, button')) play('click');
    };
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('keydown', key);
    };
  }, []);

  useEffect(() => { watchFrames(); }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => observeReveals());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Cursor-gota (solo mouse y modo alto).
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    let raf = 0;
    let active = false;
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, rot = 0, last = 0, shown = false;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - (last || now)) / 1000, 0.05) || 1 / 60;
      last = now;
      const k = 1 - Math.exp(-dt * 22);
      const vx = tx - x;
      x += vx * k;
      y += (ty - y) * k;
      rot += (Math.max(-38, Math.min(38, vx * 1.4)) - rot) * (1 - Math.exp(-dt * 10));
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg)`;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; x = tx; y = ty; el.classList.add('is-on'); }
    };
    const over = (e: PointerEvent) => el.classList.toggle('is-hover', !!(e.target as Element)?.closest?.('a, button, [role="tab"], input, textarea, select, label, [data-sfx]'));
    const leave = (e: PointerEvent) => { if (!e.relatedTarget) { el.classList.remove('is-on'); shown = false; } };
    const down = () => el.classList.add('is-down');
    const up = () => el.classList.remove('is-down');

    const enable = () => {
      const want = fine.matches && getTier() === 'high' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (want === active) return;
      active = want;
      document.documentElement.classList.toggle('has-ink-cursor', want);
      if (want) {
        window.addEventListener('pointermove', move, { passive: true });
        document.addEventListener('pointerover', over, { passive: true });
        document.addEventListener('pointerout', leave);
        window.addEventListener('pointerdown', down);
        window.addEventListener('pointerup', up);
        raf = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', move);
        document.removeEventListener('pointerover', over);
        document.removeEventListener('pointerout', leave);
        window.removeEventListener('pointerdown', down);
        window.removeEventListener('pointerup', up);
        el.classList.remove('is-on');
      }
    };
    enable();
    const off = onTierChange(enable);
    fine.addEventListener('change', enable);
    return () => {
      off();
      fine.removeEventListener('change', enable);
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', leave);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      document.documentElement.classList.remove('has-ink-cursor');
    };
  }, []);

  return (
    <div className="ink-cursor" ref={cursorRef} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/drop.webp" alt="" width="44" height="44" />
    </div>
  );
}
