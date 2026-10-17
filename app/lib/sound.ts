'use client';

// Efectos de sonido: grabaciones cortas (public/sfx, ~120 KB en total) hechas con síntesis física
// —papel, rodillos, motor de la impresora, marimba, vidrio— en vez de ondas cuadradas "de arcade".
// Se descargan apenas carga la página y se decodifican en el primer toque/clic: el navegador no deja
// sonar nada antes de esa primera interacción. El sonido está siempre encendido (no hay botón).

type Sfx = 'tick' | 'click' | 'pop' | 'paper' | 'print' | 'printing' | 'check' | 'cut' | 'ding' | 'error' | 'stamp' | 'toggle' | 'swoosh' | 'key';

const NAMES: Sfx[] = ['tick', 'click', 'pop', 'paper', 'print', 'printing', 'check', 'cut', 'ding', 'error', 'stamp', 'toggle', 'swoosh', 'key'];
// Pequeña variación de velocidad en los sonidos que se repiten mucho, para que no suenen a loop.
const VARY: Partial<Record<Sfx, number>> = { tick: 0.06, key: 0.08, print: 0.07, click: 0.03, paper: 0.05, toggle: 0.03 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
const raw = new Map<Sfx, Promise<ArrayBuffer | null>>();
const buffers = new Map<Sfx, AudioBuffer>();
let pending: { name: Sfx; at: number } | null = null;

if (typeof window !== 'undefined') {
  try { localStorage.removeItem('pt-sound'); } catch { /* sin almacenamiento */ }
  // Descarga en segundo plano (no compite con lo que se ve primero).
  const fetchAll = () => {
    for (const n of NAMES) raw.set(n, fetch(`/sfx/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(fetchAll, { timeout: 2500 }); else setTimeout(fetchAll, 1200);
}

function decodeAll(a: AudioContext) {
  for (const n of NAMES) {
    if (buffers.has(n)) continue;
    const p = raw.get(n) ?? fetch(`/sfx/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    raw.set(n, p);
    p.then((ab) => {
      if (!ab || buffers.has(n)) return;
      // Safari viejo solo acepta la versión con callbacks.
      a.decodeAudioData(ab.slice(0), (buf) => {
        buffers.set(n, buf);
        if (pending && pending.name === n && performance.now() - pending.at < 250) { const p2 = pending.name; pending = null; play(p2); }
      }, () => {});
    });
  }
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    decodeAll(ctx);
  }
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  return ctx;
}

/** Llamar desde un gesto del usuario (toque, clic, tecla). En iPhone hace falta sonar algo dentro del gesto. */
export function unlockAudio() {
  const a = audio();
  if (!a) return;
  unlocked = true;
  // Hasta que el contexto quede andando, cada gesto suena un buffer mudo (truco necesario en iOS).
  if (a.state !== 'running') {
    try {
      const s = a.createBufferSource();
      s.buffer = a.createBuffer(1, 1, 22050);
      s.connect(a.destination);
      s.start(0);
    } catch { /* nada */ }
  }
}

let lastTick = 0;
export function play(name: Sfx) {
  if (!unlocked) return;
  const a = audio();
  if (!a || !master) return;
  if (name === 'tick') { const now = performance.now(); if (now - lastTick < 55) return; lastTick = now; }
  const buf = buffers.get(name);
  if (!buf) { pending = { name, at: performance.now() }; return; }
  const src = a.createBufferSource();
  src.buffer = buf;
  const v = VARY[name];
  if (v) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * v;
  src.connect(master);
  src.start();
}
