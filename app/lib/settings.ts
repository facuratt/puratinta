'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_PRICES, DEFAULT_SETTINGS, type Prices, type SiteSettings } from './config';
import { supabase } from './supabase';

type Live = { settings: SiteSettings; prices: Prices; loaded: boolean };

const KEY = 'pt-settings-v1';
let cache: Live | null = null;
let inflight: Promise<Live> | null = null;
let fresh = false; // ya consultamos la base en esta carga de página
const listeners = new Set<(l: Live) => void>();

function merge(data: Partial<SiteSettings> | null | undefined): SiteSettings {
  const d = data ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...d,
    announcement: { ...DEFAULT_SETTINGS.announcement, ...(d.announcement ?? {}) },
    hours: {
      weekdays: { ...DEFAULT_SETTINGS.hours.weekdays, ...(d.hours?.weekdays ?? {}) },
      weekend: { ...DEFAULT_SETTINGS.hours.weekend, ...(d.hours?.weekend ?? {}) },
    },
  };
}

function readSession(): Live | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Live;
    return { settings: merge(v.settings), prices: { ...DEFAULT_PRICES, ...v.prices }, loaded: true };
  } catch { return null; }
}

export async function fetchLive(force = false): Promise<Live> {
  if (cache && fresh && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const [s, p] = await Promise.all([
      supabase.from('site_settings').select('data').eq('id', 1).maybeSingle(),
      supabase.from('prices').select('sides, price_per_sheet'),
    ]);
    const prices: Prices = { ...DEFAULT_PRICES };
    for (const row of (p.data ?? []) as { sides: keyof Prices; price_per_sheet: number }[]) prices[row.sides] = row.price_per_sheet;
    const live: Live = { settings: merge(s.data?.data as Partial<SiteSettings>), prices, loaded: !s.error };
    cache = live;
    fresh = true;
    try { sessionStorage.setItem(KEY, JSON.stringify(live)); } catch {}
    listeners.forEach((fn) => fn(live));
    return live;
  })().catch(() => {
    const fallback = cache ?? { settings: DEFAULT_SETTINGS, prices: DEFAULT_PRICES, loaded: false };
    return fallback;
  }).finally(() => { inflight = null; });
  return inflight;
}

/** Ajustes editables (precios, horarios, avisos). Pinta con el respaldo y se actualiza al llegar. */
export function useLive(): Live {
  const [live, setLive] = useState<Live>(() => cache ?? { settings: DEFAULT_SETTINGS, prices: DEFAULT_PRICES, loaded: false });
  useEffect(() => {
    if (!cache) {
      const s = readSession();
      if (s) { cache = s; setLive(s); }
    }
    listeners.add(setLive);
    void fetchLive().then(setLive);
    return () => { listeners.delete(setLive); };
  }, []);
  return live;
}

export function invalidateLive() {
  cache = null;
  try { sessionStorage.removeItem(KEY); } catch {}
  return fetchLive(true);
}
