'use client';

import { useEffect, useRef } from 'react';
import type { TintoEngine, TintoMeta } from '../lib/tintoEngine';

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

type Frame = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

/** Escala el cuadro una vez y le hornea el fundido de bordes, así cada repintado es un solo drawImage. */
async function bake(img: HTMLImageElement, w: number, h: number, s: number): Promise<Frame> {
  try {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, w, h);
    feather(x, 0, 0, w, h, s, { l: 36, r: 36, t: 8, b: 30 });
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(c); } catch { /* el canvas sirve igual */ }
    }
    return c;
  } catch {
    return img;
  }
}

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
    const coarse = matchMedia('(pointer: coarse)').matches;
    let docLeft = 0, docTop = 0; // posición del escenario en el documento (se mide solo al redimensionar)
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

    // El lienzo animado mide solo lo que ocupa el recorte (no toda la sección): cada cuadro
    // sube a la placa de video una textura chica en vez de una del tamaño de la pantalla.
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
      const W = canvas.width, H = canvas.height;
      // Casi en un cuadro entero: se dibuja uno solo. En el medio: fundido entre los dos vecinos.
      const fb = t > 0.02 ? nearest((a + 1) % n) : null;
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      if (fb && fb !== fa && t >= 0.98) ctx.drawImage(fb, 0, 0, W, H);
      else {
        ctx.drawImage(fa, 0, 0, W, H);
        if (fb && fb !== fa) { ctx.globalAlpha = t; ctx.drawImage(fb, 0, 0, W, H); ctx.globalAlpha = 1; }
      }
      // El fundido de bordes ya viene horneado en cada cuadro (ver bake): acá solo se copian píxeles.
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

    const measureDoc = () => {
      const rect = wrap.getBoundingClientRect();
      docLeft = rect.left + window.scrollX;
      docTop = rect.top + window.scrollY;
    };
    // Sin lecturas de layout en el scroll: solo restamos el desplazamiento.
    const placeHead = () => {
      if (!meta || !layout) return;
      engine.head.x = docLeft - window.scrollX + layout.dx + meta.head[0] * layout.s;
      engine.head.y = docTop - window.scrollY + layout.dy + meta.head[1] * layout.s;
    };

    const resize = () => {
      if (!meta) return;
      const cw = wrap.clientWidth;
      const ch = wrap.clientHeight;
      layout = computeLayout(cw, ch, meta);
      const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1 / layout.s, 2));
      plateCanvas.width = Math.round(cw * dpr);
      plateCanvas.height = Math.round(ch * dpr);
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pctx.imageSmoothingEnabled = true;
      pctx.imageSmoothingQuality = 'high';
      size = { cw, ch };
      const [cx, cy, cwid, chei] = meta.crop;
      crop = { x: layout.dx + cx * layout.s, y: layout.dy + cy * layout.s, w: cwid * layout.s, h: chei * layout.s };
      canvas.width = Math.max(1, Math.round(crop.w * dpr));
      canvas.height = Math.max(1, Math.round(crop.h * dpr));
      Object.assign(canvas.style, { left: `${crop.x}px`, top: `${crop.y}px`, width: `${crop.w}px`, height: `${crop.h}px` });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low'; // los cuadros ya vienen escalados a medida: bilineal alcanza
      drawPlate();
      measureDoc();
      placeHead();
      draw(true);
    };

    const ro = new ResizeObserver(resize);
    // Si cambia algo arriba (fuentes, imágenes), la sección se corre: volvemos a medir su posición.
    const bodyRo = new ResizeObserver(() => { measureDoc(); placeHead(); });
    bodyRo.observe(document.body);

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const needW = meta.crop[2] * probe.s * dpr;
      const tiers = [...meta.sizes].sort((a, b) => a - b);
      const tier = tiers.find((w) => w >= needW * 0.95) || tiers[tiers.length - 1];
      const budget = (coarse ? 220 : 380) * 1e6;
      const aspect = meta.crop[3] / meta.crop[2];
      const fitW = Math.floor(Math.sqrt(budget / (n * 4 * aspect)));
      const bmpW = Math.round(Math.min(tier, Math.max(needW, 240), fitW));
      const bmpH = Math.round(bmpW * aspect);
      const cropW = meta.crop[2];

      ro.observe(wrap);
      resize();

      const bdSrc = meta.backdrop[probe.s * meta.width * dpr > 1400 ? '1920' : '1280'];
      Promise.all([loadImage(`${BASE}${meta.plate.src}`), loadImage(`${BASE}${bdSrc}`)]).then(([p, b]) => {
        if (cancelled) return;
        plate = p; backdrop = b;
        if (layout) drawPlate();
      }, () => {});

      const order = loadOrder(n, 1);
      let done = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < order.length && !cancelled) {
          const i = order[cursor++];
          let img: HTMLImageElement;
          try { img = await loadImage(`${BASE}${tier}/${String(i).padStart(3, '0')}.webp`); } catch { continue; }
          const bmp: Frame = await bake(img, bmpW, bmpH, bmpW / cropW);
          if (cancelled) { (bmp as ImageBitmap).close?.(); return; }
          frames[i] = bmp;
          done++;
          onProgress?.(done / order.length);
          draw(true);
          if (done === 1) wrap.classList.add('is-ready');
        }
      };
      await Promise.all(Array.from({ length: coarse ? 4 : 6 }, worker));
    };

    const layers = wrap.firstElementChild as HTMLElement;
    let lastT = '';
    const unsub = engine.subscribe((e) => {
      draw(false);
      const tr = `translate3d(${(-e.parallax.x * 10).toFixed(1)}px, ${(-e.parallax.y * 7).toFixed(1)}px, 0) scale(1.035)`;
      if (tr !== lastT) layers.style.transform = lastT = tr;
    });

    const near = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void boot(); }, { rootMargin: '120% 0px' });
    near.observe(wrap);
    const vis = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { measureDoc(); placeHead(); engine.start(); } else engine.stop();
    }, { threshold: 0 });
    vis.observe(wrap);
    const onScroll = () => { if (engine.running) placeHead(); };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelled = true;
      ro.disconnect();
      bodyRo.disconnect();
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
