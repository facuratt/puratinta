'use client';

import { useEffect, useRef } from 'react';
import type { TintoEngine, TintoMeta } from '../lib/tintoEngine';
import { getTier } from '../lib/perf';

// Escenario de Tinto (portado de pouterby/Stage): fondo extendido y desenfocado + backdrop,
// y encima el recorte animado, con fundido de bordes y crossfade entre cuadros.

const BASE = '/tinto/';
const SHIFT = 0.1;
const TOP = 84;
const BOTTOM = 64;

type Layout = { s: number; dx: number; dy: number };

function computeLayout(cw: number, ch: number, meta: TintoMeta): Layout {
  const { width: iw, height: ih, subjectBox: sb } = meta;
  const sw = sb[2] - sb[0];
  const sh = sb[3] - sb[1];
  const cx = (sb[0] + sb[2]) / 2;
  if (cw / ch >= 1.1) {
    const cover = Math.max(cw / iw, ch / ih);
    const s = Math.min(cover, (ch - TOP - BOTTOM) / sh);
    return { s, dx: cw / 2 + cw * SHIFT - cx * s, dy: TOP - sb[1] * s };
  }
  const s = Math.min(cw / (sw * 1.05), (ch * 0.5) / sh);
  return { s, dx: cw / 2 - cx * s, dy: 70 - sb[1] * s };
}

function loadOrder(n: number, minStep: number) {
  const order: number[] = [];
  const seen = new Set<number>();
  for (let step = Math.ceil(n / 8); ; step = Math.max(minStep, Math.floor(step / 2))) {
    for (let i = 0; i < n; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    if (step === minStep) break;
  }
  return order;
}

function feather(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number, { l = 0, r = 0, t = 0, b = 0 }) {
  const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#000');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  if (l) edge(x, 0, x + l * s, 0, x - 2, y - 2, l * s + 2, h + 4);
  if (r) edge(x + w, 0, x + w - r * s, 0, x + w - r * s, y - 2, r * s + 2, h + 4);
  if (t) edge(0, y, 0, y + t * s, x - 2, y - 2, w + 4, t * s + 2);
  if (b) edge(0, y + h, 0, y + h - b * s, x - 2, y + h - b * s, w + 4, b * s + 2);
  ctx.restore();
}

const loadImage = (src: string) => {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode().then(() => img);
};

type Frame = HTMLImageElement | ImageBitmap;

export default function TintoStage({ engine, onProgress }: { engine: TintoEngine; onProgress?: (p: number) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plateRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const plateCanvas = plateRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pctx = plateCanvas.getContext('2d', { alpha: false })!;
    const lite = getTier() === 'low';
    let cancelled = false;
    let started = false;
    let meta: TintoMeta | null = null;
    let plate: HTMLImageElement | null = null;
    let backdrop: HTMLImageElement | null = null;
    let frames: (Frame | null)[] = [];
    let layout: Layout | null = null;
    let crop: { x: number; y: number; w: number; h: number } | null = null;
    let lastF = -1;
    let size = { cw: 0, ch: 0 };

    const nearest = (i: number) => {
      const n = frames.length;
      if (frames[i]) return frames[i];
      for (let d = 1; d < n / 2; d++) {
        const a = frames[(i - d + n) % n]; if (a) return a;
        const b = frames[(i + d) % n]; if (b) return b;
      }
      return null;
    };

    const draw = (force: boolean) => {
      if (!meta || !crop || !layout) return;
      const f = engine.f;
      if (!force && Math.abs(f - lastF) < 0.002) return;
      const n = meta.count;
      const a = Math.floor(f) % n;
      const t = f - Math.floor(f);
      const fa = nearest(a);
      if (!fa) return;
      lastF = f;
      const { x, y, w, h } = crop;
      ctx.clearRect(x - 2, y - 2, w + 4, h + 4);
      ctx.globalAlpha = 1;
      ctx.drawImage(fa, x, y, w, h);
      const fb = !lite && t > 0.004 ? nearest((a + 1) % n) : null;
      if (fb && fb !== fa) { ctx.globalAlpha = t; ctx.drawImage(fb, x, y, w, h); ctx.globalAlpha = 1; }
      feather(ctx, x, y, w, h, layout.s, { l: 36, r: 36, t: 8, b: 30 });
    };

    const drawPlate = () => {
      if (!meta || !layout) return;
      const { cw, ch } = size;
      const { s, dx, dy } = layout;
      const dw = meta.width * s;
      const dh = meta.height * s;
      const g = pctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, meta.edgeColor);
      g.addColorStop(0.55, meta.edgeColor);
      g.addColorStop(1, meta.floorColor);
      pctx.fillStyle = g;
      pctx.fillRect(0, 0, cw, ch);
      if (plate) {
        const { padX, padY } = meta.plate;
        pctx.drawImage(plate, dx - dw * padX, dy - dh * padY, dw * (1 + 2 * padX), dh * (1 + 2 * padY));
      }
      if (backdrop) {
        const dpr = plateCanvas.width / cw;
        const off = document.createElement('canvas');
        off.width = plateCanvas.width;
        off.height = plateCanvas.height;
        const octx = off.getContext('2d')!;
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(backdrop, dx, dy, dw, dh);
        feather(octx, dx, dy, dw, dh, s, { l: 110, r: 110, t: 26, b: 50 });
        pctx.save();
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.drawImage(off, 0, 0);
        pctx.restore();
      }
    };

    const placeHead = () => {
      if (!meta || !layout) return;
      const rect = wrap.getBoundingClientRect();
      engine.head.x = rect.left + layout.dx + meta.head[0] * layout.s;
      engine.head.y = rect.top + layout.dy + meta.head[1] * layout.s;
    };

    const resize = () => {
      if (!meta) return;
      const cw = wrap.clientWidth;
      const ch = wrap.clientHeight;
      layout = computeLayout(cw, ch, meta);
      const dpr = Math.min(window.devicePixelRatio || 1, 1 / layout.s, lite ? 1 : 2);
      for (const [c, x] of [[canvas, ctx], [plateCanvas, pctx]] as const) {
        c.width = Math.round(cw * dpr);
        c.height = Math.round(ch * dpr);
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
      }
      size = { cw, ch };
      const [cx, cy, cwid, chei] = meta.crop;
      crop = { x: layout.dx + cx * layout.s, y: layout.dy + cy * layout.s, w: cwid * layout.s, h: chei * layout.s };
      drawPlate();
      placeHead();
      draw(true);
    };

    const ro = new ResizeObserver(resize);

    // Carga perezosa: recién cuando la sección se acerca a la pantalla.
    const boot = async () => {
      if (started) return;
      started = true;
      try {
        const res = await fetch(`${BASE}meta.json`);
        if (!res.ok) throw new Error('no meta');
        meta = (await res.json()) as TintoMeta;
      } catch { return; }
      if (cancelled || !meta) return;
      engine.setMeta(meta);
      const n = meta.count;
      frames = new Array(n).fill(null);
      const probe = computeLayout(wrap.clientWidth, wrap.clientHeight, meta);
      const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : 2);
      const needW = meta.crop[2] * probe.s * dpr;
      const tiers = [...meta.sizes].sort((a, b) => a - b);
      const tier = lite ? tiers[0] : (tiers.find((w) => w >= needW * 0.95) || tiers[tiers.length - 1]);
      const budget = (lite ? 140 : matchMedia('(pointer: coarse)').matches ? 240 : 600) * 1e6;
      const aspect = meta.crop[3] / meta.crop[2];
      const fitW = Math.floor(Math.sqrt(budget / (n * 4 * aspect)));
      const bmpW = Math.round(Math.min(tier, Math.max(needW, 320), fitW));
      const bmpH = Math.round(bmpW * aspect);

      ro.observe(wrap);
      resize();

      const bdSrc = meta.backdrop[!lite && probe.s * meta.width * dpr > 1400 ? '1920' : '1280'];
      Promise.all([loadImage(`${BASE}${meta.plate.src}`), loadImage(`${BASE}${bdSrc}`)]).then(([p, b]) => {
        if (cancelled) return;
        plate = p; backdrop = b;
        if (layout) drawPlate();
      }, () => {});

      const order = loadOrder(n, lite ? 2 : 1);
      let done = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < order.length && !cancelled) {
          const i = order[cursor++];
          let img: HTMLImageElement;
          try { img = await loadImage(`${BASE}${tier}/${String(i).padStart(3, '0')}.webp`); } catch { continue; }
          let bmp: Frame = img;
          if ('createImageBitmap' in window) {
            try { bmp = await createImageBitmap(img, { resizeWidth: bmpW, resizeHeight: bmpH, resizeQuality: lite ? 'medium' : 'high' }); } catch { bmp = img; }
          }
          if (cancelled) { (bmp as ImageBitmap).close?.(); return; }
          frames[i] = bmp;
          done++;
          onProgress?.(done / order.length);
          draw(true);
          if (done === 1) wrap.classList.add('is-ready');
        }
      };
      await Promise.all(Array.from({ length: lite ? 3 : 6 }, worker));
    };

    const layers = wrap.firstElementChild as HTMLElement;
    const unsub = engine.subscribe((e) => {
      draw(false);
      const k = lite ? 0.4 : 1;
      layers.style.transform = `translate3d(${(-e.parallax.x * 10 * k).toFixed(2)}px, ${(-e.parallax.y * 7 * k).toFixed(2)}px, 0) scale(1.035)`;
    });

    const near = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void boot(); }, { rootMargin: '120% 0px' });
    near.observe(wrap);
    const vis = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { placeHead(); engine.start(); } else engine.stop();
    }, { threshold: 0 });
    vis.observe(wrap);
    const onScroll = () => { if (engine.running) placeHead(); };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelled = true;
      ro.disconnect();
      near.disconnect();
      vis.disconnect();
      window.removeEventListener('scroll', onScroll);
      engine.stop();
      unsub();
      frames.forEach((f) => (f as ImageBitmap | null)?.close?.());
    };
  }, [engine, onProgress]);

  return (
    <div className="tinto-stage" ref={wrapRef} aria-hidden="true">
      <div className="tinto-stage__layers">
        <canvas ref={plateRef} className="tinto-stage__plate" />
        <canvas ref={canvasRef} className="tinto-stage__canvas" />
      </div>
    </div>
  );
}
