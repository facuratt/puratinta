'use client';

import {useEffect, useRef, useState, type RefObject} from 'react';
import {FRAME_COUNT, loadFrames} from '../lib/girlFrames';
import {
  approach,
  frameForPointer,
  maxFrameRate,
  nextSide,
  TAU_FRAME,
  TAU_PARALLAX,
  type Side,
} from '../lib/girlGaze';
import {getTier, onTierChange} from '../lib/perf';
import {useReducedMotion} from '../hooks/useReducedMotion';

const SRC_W = 1280;
const SRC_H = 720;

/**
 * Character geometry, measured off the frames rather than guessed: the
 * figure's horizontal span is the union across every frame (she drifts right
 * as she turns), and the head runs from the top of the hair to the chin.
 * Source pixels at 1280x720.
 */
const FIG_X0 = 328;
const FIG_X1 = 928;
const FIG_CX = (FIG_X0 + FIG_X1) / 2;
const FIG_W = FIG_X1 - FIG_X0;
const HEAD_Y0 = 40;
const HEAD_H = 360;
/** Hair-top to the bottom of the frame — what has to span the hero. */
const BELOW_HAIR = SRC_H - HEAD_Y0;

/**
 * The backdrop is flat: it varies under 3 levels horizontally and not at all
 * vertically. These are low-frequency samples across the top edge, so bands
 * beyond the image can be filled smoothly.
 *
 * Filling them by stretching the frame's own 1px edge row — the obvious
 * thing, and what this did before — smears that row's compression noise
 * (stddev 1.8, adjacent jumps up to 9 levels) down the whole band and prints
 * it as vertical stripes across the hero.
 */
const TOP_PROFILE = [
  '#f6a6a9', '#f7a6a9', '#f6a6a9', '#f6a6a9', '#f6a7a9', '#f6a7a9',
  '#f7a8ab', '#f8a9ad', '#f7aaac', '#f8a9ad', '#f7a8ab', '#f7a7aa',
  '#f6a5a9', '#f7a7a9', '#f7a7a9', '#f7a7a9', '#f6a6a8',
];

/** Clearance between the nav's baseline and the top of her hair. */
const NAV_CLEARANCE = 38;
/** Hard ceiling on her scale, so an odd viewport cannot balloon her. */
const MAX_HEAD = 0.6;
/** Share of the width she takes when the type is stacked above her. */
const STACK_WIDTH = 0.82;

/** Parallax travel, in CSS pixels, at the extremes of the viewport. */
const SHIFT_X = 16;
const SHIFT_Y = 9;
const TILT = 1.1;

/**
 * The layer is drawn slightly larger than the hero and scaled to match, so
 * the parallax tilt cannot swing the floor shadow off the bottom corners and
 * expose the page behind it.
 */
const OVERSCAN = 1.06;

/** Seconds for one full glance cycle when there is no cursor to follow. */
const AUTOPILOT_PERIOD = 7.5;

export interface StageBounds {
  /** Top bar — her hair is parked just under it. */
  nav: RefObject<HTMLElement | null>;
  /** Wordmark + lede block; she starts to the right of it. */
  lockup: RefObject<HTMLElement | null>;
  /** Service index; she ends to the left of it. Null when hidden. */
  index: RefObject<HTMLElement | null>;
}

interface Fit {
  /** Source-pixel scale, in hero CSS pixels. */
  s: number;
  /** Where the frame's top-left lands, in hero CSS pixels. */
  dx: number;
  dy: number;
}

export function GirlStage({bounds}: {bounds: StageBounds}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    if (!host || !layer || !canvas) return;

    const ctx = canvas.getContext('2d', {alpha: false});
    if (!ctx) return;

    let alive = true;
    let lite = getTier() === 'low';
    const offTier = onTierChange((t) => { lite = t === 'low'; relayout(); });
    let frames: HTMLImageElement[] = [];
    let hasPainted = false;

    // Devices without a hover-capable pointer get a slow autonomous glance
    // instead of a hero that never moves.
    const autopilot = !window.matchMedia('(hover: hover)').matches && !reduced;
    let autopilotOn = autopilot;
    let onScreen = true;
    let clock = 0;

    // --- animated state -------------------------------------------------
    // `cur` chases `target`; both are fractional frame indices.
    let cur = 0;
    let target = 0;
    let side: Side = 'left';
    // Parallax, normalised to -1..1, chasing the pointer.
    let px = 0;
    let py = 0;
    let tpx = 0;
    let tpy = 0;

    // --- layout ---------------------------------------------------------
    let W = 0;
    let H = 0;
    let dpr = 1;
    let fit: Fit = {s: 1, dx: 0, dy: 0};
    let bg: string | CanvasGradient = TOP_PROFILE[0];

    let lastDrawn = -1;
    let dirty = true;
    let running = false;
    let rafId = 0;
    let last = 0;

    /**
     * Sizes and places her against the type that is actually on screen,
     * measured from the live boxes rather than assumed from breakpoints —
     * the wordmark's width depends on font metrics we cannot predict, and it
     * changes again when the webfont swaps in.
     */
    const computeFit = (): Fit => {
      const r = host.getBoundingClientRect();
      const navEl = bounds.nav.current;
      const lockEl = bounds.lockup.current;
      const idxEl = bounds.index.current;
      const navR = navEl?.getBoundingClientRect();
      const lockR = lockEl?.getBoundingClientRect();
      // offsetParent is null while the element is display:none at this
      // breakpoint, in which case it claims no space.
      const idxR = idxEl?.offsetParent ? idxEl.getBoundingClientRect() : null;

      const gutter = Math.max(24, Math.min(64, W * 0.035));

      if (W >= 1024 && lockR) {
        // Side by side: she takes the column between the two blocks of type.
        const x0 = lockR.right - r.left + gutter;
        const x1 = (idxR ? idxR.left - r.left : W) - gutter;
        const gap = Math.max(160, x1 - x0);
        const cx = (x0 + x1) / 2;

        const headTop = (navR ? navR.bottom - r.top : 0) + NAV_CLEARANCE;

        // Size her to stand from just under the nav down to the hero's floor,
        // then cap that by the channel the type leaves her. Driving the scale
        // off the gap instead makes her size swing with viewport width — a
        // 60% head at one size and 38% at another — because the gap grows
        // with width while this composition is set by height.
        const s = Math.min(
          (H - headTop) / BELOW_HAIR,
          gap / FIG_W,
          (MAX_HEAD * H) / HEAD_H,
        );

        // Hair under the nav, if she is then tall enough to still reach the
        // bottom — otherwise the floor shadow would stop short and leave a
        // hard edge across the hero, so bottom-anchor and let her sit lower.
        const reaches = s * BELOW_HAIR >= H - headTop - 0.5;
        const dy = reaches ? headTop - HEAD_Y0 * s : H - SRC_H * s;
        return {s, dx: cx - FIG_CX * s, dy};
      }

      // Stacked: the type sits above her, so she is centred, bottom-anchored,
      // and only has to keep her head clear of the lede.
      const below = (lockR ? lockR.bottom - r.top : 0) + gutter;
      const s = Math.min(
        (STACK_WIDTH * W) / FIG_W,
        Math.max(0.05, (H - below) / BELOW_HAIR),
      );
      return {s, dx: W / 2 - FIG_CX * s, dy: H - SRC_H * s};
    };

    /**
     * Hero CSS pixels -> backing-store pixels. The canvas is OVERSCAN larger
     * than the hero and centred on it, so the origin shifts by half the
     * excess; lengths only pick up the device ratio.
     */
    const offX = () => (W * (OVERSCAN - 1)) / 2;
    const offY = () => (H * (OVERSCAN - 1)) / 2;

    const buildBackground = () => {
      const x0 = (fit.dx + offX()) * dpr;
      const x1 = x0 + SRC_W * fit.s * dpr;
      if (!(x1 > x0)) {
        bg = TOP_PROFILE[0];
        return;
      }
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      TOP_PROFILE.forEach((c, i) => g.addColorStop(i / (TOP_PROFILE.length - 1), c));
      // Canvas gradients hold their end stops beyond the range, so the bands
      // to either side continue the backdrop exactly.
      bg = g;
    };

    /** Nearest already-decoded frame to `i`, for the window while loading. */
    const resolveFrame = (i: number) => {
      for (let k = i; k >= 0; k--) if (frames[k]) return k;
      for (let k = i + 1; k < FRAME_COUNT; k++) if (frames[k]) return k;
      return -1;
    };

    // --- painting -------------------------------------------------------
    const draw = (index: number): boolean => {
      const img = frames[index];
      if (!img) return false;

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        img,
        (fit.dx + offX()) * dpr,
        (fit.dy + offY()) * dpr,
        SRC_W * fit.s * dpr,
        SRC_H * fit.s * dpr,
      );

      if (!hasPainted) {
        hasPainted = true;
        setPainted(true);
      }
      return true;
    };

    const paint = (wanted: number) => {
      const index = frames[wanted] ? wanted : resolveFrame(wanted);
      if (index < 0) return;
      if (index === lastDrawn && !dirty) return;
      if (draw(index)) {
        lastDrawn = index;
        dirty = false;
      }
    };

    // --- loop -----------------------------------------------------------
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (autopilotOn) {
        clock += dt;
        const phase = (clock % AUTOPILOT_PERIOD) / AUTOPILOT_PERIOD;
        const x = phase < 0.5 ? 0.12 : 0.88;
        side = nextSide(x, side);
        target = frameForPointer(x, side);
        tpx = x * 2 - 1;
      }

      if (reduced) {
        cur = target;
        tpx = 0;
        tpy = 0;
        px = 0;
        py = 0;
      } else {
        // Exponential chase for responsiveness, then a speed limit that bites
        // only across the blink so the turn plays at the cadence it was drawn
        // at instead of snapping through in the first few ticks.
        let step = (target - cur) * approach(dt, TAU_FRAME);
        const maxStep = maxFrameRate(cur) * dt;
        if (step > maxStep) step = maxStep;
        else if (step < -maxStep) step = -maxStep;
        cur += step;

        const kp = approach(dt, TAU_PARALLAX);
        px += (tpx - px) * kp;
        py += (tpy - py) * kp;
      }

      paint(Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(cur))));

      const amt = lite ? 0.35 : 1;
      layer.style.transform =
        `translate3d(${(px * SHIFT_X * amt).toFixed(2)}px, ${(py * SHIFT_Y * amt).toFixed(2)}px, 0)` +
        ` rotate(${(px * TILT * amt).toFixed(3)}deg) scale(${OVERSCAN})`;
      host.style.setProperty('--gaze-x', ((px + 1) / 2).toFixed(4));
      host.dataset.side = side;

      const settled =
        !autopilotOn &&
        Math.abs(target - cur) < 0.004 &&
        Math.abs(tpx - px) < 0.002 &&
        Math.abs(tpy - py) < 0.002;
      if (settled) {
        cur = target;
        px = tpx;
        py = tpy;
        running = false;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (running || !alive) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    // --- input ----------------------------------------------------------
    const onPointer = (e: PointerEvent) => {
      // pointermove is on the window, so it keeps firing long after the hero
      // has scrolled away. Nothing below the fold is worth a repaint.
      if (!onScreen) return;
      autopilotOn = false;
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      side = nextSide(nx, side);
      target = frameForPointer(nx, side);
      tpx = Math.max(-1, Math.min(1, nx * 2 - 1));
      tpy = Math.max(-1, Math.min(1, ny * 2 - 1));
      wake();
    };

    /**
     * Only a cursor leaving the window resets the pose. Listening on the
     * stage itself would fire every time the pointer crossed the headline,
     * which is a sibling layer rather than a descendant.
     */
    const onLeaveWindow = () => {
      if (autopilotOn) return;
      side = 'left';
      target = 0;
      tpx = 0;
      tpy = 0;
      wake();
    };

    // --- sizing ---------------------------------------------------------
    const relayout = () => {
      const r = host.getBoundingClientRect();
      // Capping DPR at 2 keeps fill rate sane on 3x phones; at this scale
      // the extra samples are invisible on a soft-shaded render.
      dpr = Math.min(window.devicePixelRatio || 1, getTier() === 'low' ? 1 : 2);
      W = r.width;
      H = r.height;

      const w = Math.max(1, Math.round(W * OVERSCAN * dpr));
      const h = Math.max(1, Math.round(H * OVERSCAN * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      fit = computeFit();
      buildBackground();
      dirty = true;
      // Resizing blanks the backing store, so repaint now rather than
      // letting a frame of empty canvas through.
      if (lastDrawn >= 0) paint(lastDrawn);
      wake();
    };

    const ro = new ResizeObserver(relayout);
    ro.observe(host);
    // The type's own boxes drive the fit, so watch them too — a reflow or a
    // font swap moves them without the hero ever changing size.
    for (const el of [bounds.nav.current, bounds.lockup.current, bounds.index.current]) {
      if (el) ro.observe(el);
    }
    relayout();

    // The webfont lands after first paint and changes the wordmark's width.
    document.fonts?.ready.then(() => {
      if (alive) relayout();
    });

    // Park the whole loop as soon as the hero scrolls away.
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (autopilot) autopilotOn = onScreen;
        if (onScreen && autopilotOn) wake();
      },
      {threshold: 0},
    );
    io.observe(host);

    window.addEventListener('pointermove', onPointer, {passive: true});
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);

    // --- load -----------------------------------------------------------
    loadFrames((_loaded, _total, all) => {
      if (!alive) return;
      frames = all;
      dirty = true;
      wake();
    }).catch(() => {
      /* A dropped frame just means the hero holds the pose it already has. */
    });

    return () => {
      alive = false;
      running = false;
      offTier();
      cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
    };
  }, [reduced, bounds]);

  return (
    <div ref={hostRef} className="girl-stage" style={{['--gaze-x' as string]: '0.5'}} aria-hidden="true">
      <div ref={layerRef} className="girl-stage__layer">
        <canvas ref={canvasRef} className="girl-stage__canvas" style={{opacity: painted ? 1 : 0}} />
      </div>
      {/* Luz que sigue la mirada y viñeta tomada del propio clip. */}
      <div className="girl-stage__light" />
      <div className="girl-stage__vignette" />
    </div>
  );
}
