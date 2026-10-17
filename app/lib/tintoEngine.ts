// Motor de mirada 2D de Tinto (portado de pouterby/gazeEngine).
//
// Cada cuadro del clip "mira alrededor" tiene un vector de mirada (meta.gaze, x: -1 izq .. 1 der,
// y: -1 arriba .. 1 abajo). La dirección del cursor respecto de la cabeza se convierte en un vector
// objetivo; elegimos el cuadro que mejor coincide y viajamos hacia él por el camino más corto del
// loop, así la cabeza siempre pasa por poses reales intermedias.
//
// Un solo rAF, cero re-renders de React: los componentes se suscriben y escriben al DOM directo.

export type TintoMeta = {
  count: number; width: number; height: number; loop: boolean;
  crop: [number, number, number, number]; sizes: number[];
  gaze: [number, number][]; avoid?: number[]; head: [number, number];
  subjectBox: [number, number, number, number];
  backdrop: Record<string, string>; plate: { src: string; padX: number; padY: number };
  edgeColor: string; floorColor: string;
};
type Vec = { x: number; y: number };
type Mode = 'track' | 'idle' | 'script';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (t: number) => t * t * (3 - 2 * t);

const IDLE_AFTER = 4200;
const DEAD_ZONE = 0.14;
const MAX_SPEED = 105;
const CONTINUITY = 0.55;
const AVOID_COST = 0.35;

export class TintoEngine {
  meta: TintoMeta | null = null;
  n = 0;
  f = 0;
  goal = 0;
  aim: Vec = { x: 0, y: 0 };
  look: Vec = { x: 0, y: 0 };
  pointer: Vec;
  parallax: Vec = { x: 0, y: 0 };
  head: Vec;
  speed = 0;
  dt = 1 / 60;
  mode: Mode = 'idle';
  lastInput: number;
  script: { travelled: number } | null = null;
  subs = new Set<(e: TintoEngine) => void>();
  reduced: boolean;
  private avoid = new Set<number>();
  private dist = 0;
  private last = 0;
  private raf = 0;
  private idleT0: number | null = null;
  running = false;

  constructor() {
    this.pointer = { x: innerWidth / 2, y: innerHeight / 2 };
    this.head = { x: innerWidth / 2, y: innerHeight / 3 };
    this.lastInput = performance.now() - IDLE_AFTER + 1500;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  setMeta(meta: TintoMeta) {
    this.meta = meta;
    this.n = meta.count;
    this.avoid = new Set(meta.avoid || []);
    this.f = this.goal = this.pick({ x: 0, y: 0 }, 0);
  }

  subscribe(fn: (e: TintoEngine) => void) {
    this.subs.add(fn);
    fn(this);
    return () => { this.subs.delete(fn); };
  }

  point(x: number, y: number) {
    this.dist += Math.hypot(x - this.pointer.x, y - this.pointer.y);
    this.pointer.x = x;
    this.pointer.y = y;
    this.lastInput = performance.now();
    this.idleT0 = null;
  }

  release() { this.lastInput = performance.now() - IDLE_AFTER + 1200; }

  /** Una vuelta completa del loop ("mirá cómo revisa"). */
  lookAround() { if (this.n) this.script = { travelled: 0 }; }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    const loop = (now: number) => { this.raf = requestAnimationFrame(loop); this.tick(now); };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  private delta(a: number, b: number) {
    const n = this.n;
    let d = (b - a) % n;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  }

  private cost(i: number, aim: Vec, from: number) {
    const g = this.meta!.gaze[i];
    const dx = g[0] - aim.x;
    const dy = g[1] - aim.y;
    const c = this.delta(from, i) / this.n;
    return dx * dx + dy * dy + CONTINUITY * c * c + (this.avoid.has(i) ? AVOID_COST : 0);
  }

  private pick(aim: Vec, from: number) {
    let best = 0;
    let bestCost = Infinity;
    for (let i = 0; i < this.n; i++) {
      const c = this.cost(i, aim, from);
      if (c < bestCost) { bestCost = c; best = i; }
    }
    return best;
  }

  private aimFromPointer(): Vec {
    const r = Math.min(innerWidth, innerHeight) * 0.42;
    const dx = (this.pointer.x - this.head.x) / r;
    const dy = (this.pointer.y - this.head.y) / r;
    const m = Math.hypot(dx, dy);
    if (m < 1e-4) return { x: 0, y: 0 };
    const k = clamp((m - DEAD_ZONE) / (1 - DEAD_ZONE), 0, 1) / m;
    return { x: dx * k, y: dy * k };
  }

  tick(now: number) {
    const dt = Math.min((now - (this.last || now)) / 1000, 0.05) || 1 / 60;
    this.last = now;
    this.dt = dt;

    if (this.n && this.meta) {
      if (this.script) {
        this.mode = 'script';
        const step = 44 * dt;
        this.f = (this.f + step) % this.n;
        this.script.travelled += step;
        if (this.script.travelled >= this.n) { this.script = null; this.lastInput = now; }
        this.goal = Math.round(this.f) % this.n;
      } else {
        const idle = !this.reduced && now - this.lastInput > IDLE_AFTER;
        if (idle) {
          this.mode = 'idle';
          if (this.idleT0 === null) this.idleT0 = now;
          const s = (now - this.idleT0) / 1000;
          const ramp = smooth(clamp(s / 2.5, 0, 1));
          const r = (0.55 + 0.35 * Math.sin(s * 0.37)) * ramp;
          const a = Math.PI - s * 0.55;
          this.aim = { x: Math.cos(a) * r, y: Math.sin(a) * r };
        } else {
          this.mode = 'track';
          this.aim = this.aimFromPointer();
        }
        const cand = this.pick(this.aim, this.f);
        if (cand !== this.goal && this.cost(cand, this.aim, this.f) < this.cost(this.goal, this.aim, this.f) - 0.012) this.goal = cand;
        const d = this.delta(this.f, this.goal);
        let step = d * (1 - Math.exp(-dt * (this.reduced ? 30 : 9)));
        const cap = MAX_SPEED * dt * (this.reduced ? 4 : 1);
        step = clamp(step, -cap, cap);
        this.f = (this.f + step + this.n) % this.n;
      }
      const a = Math.floor(this.f) % this.n;
      const b = (a + 1) % this.n;
      const t = this.f - Math.floor(this.f);
      const ga = this.meta.gaze[a];
      const gb = this.meta.gaze[b];
      this.look.x = ga[0] + (gb[0] - ga[0]) * t;
      this.look.y = ga[1] + (gb[1] - ga[1]) * t;
    }

    const instant = this.dist / dt;
    this.dist = 0;
    this.speed += (instant - this.speed) * (1 - Math.exp(-dt * 2.5));
    const k = 1 - Math.exp(-dt * 4);
    this.parallax.x += (this.look.x - this.parallax.x) * k;
    this.parallax.y += (this.look.y - this.parallax.y) * k;
    for (const fn of this.subs) fn(this);
  }
}
