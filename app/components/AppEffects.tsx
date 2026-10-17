'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { observeReveals } from '../lib/scroll';
import { play, unlockAudio } from '../lib/sound';

/**
 * Efectos globales: sonidos de interfaz (delegados, sin tocar cada botón), apariciones al
 * scrollear. El cursor es una imagen CSS (la dibuja el sistema, sin retraso).
 */
export default function AppEffects() {
  const pathname = usePathname();

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

  // Limpieza de la versión anterior (modo liviano guardado en el navegador).
  useEffect(() => { try { localStorage.removeItem('pt-perf'); } catch {} }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => observeReveals());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
