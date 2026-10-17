'use client';

// Efectos de sonido sintetizados con Web Audio: sin archivos, pesan 0 KB y suenan al instante.
// El navegador solo deja sonar después de la primera interacción, así que el contexto se crea ahí.

type Sfx = 'tick' | 'click' | 'pop' | 'paper' | 'print' | 'cut' | 'ding' | 'error' | 'stamp' | 'toggle' | 'swoosh' | 'key';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;
let unlocked = false;
const subs = new Set<(on: boolean) => void>();

if (typeof window !== 'undefined') {
  try { enabled = localStorage.getItem('pt-sound') !== 'off'; } catch {}
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  unlocked = true;
  if (enabled) audio();
}

export const soundEnabled = () => enabled;
export function setSoundEnabled(on: boolean) {
  enabled = on;
  try { localStorage.setItem('pt-sound', on ? 'on' : 'off'); } catch {}
  subs.forEach((fn) => fn(on));
  if (on) { unlockAudio(); play('toggle'); }
}
export function onSoundChange(fn: (on: boolean) => void) { subs.add(fn); return () => { subs.delete(fn); }; }

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
  const a = ctx!; const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  env(g, t, peak, 0.004, dur);
  o.connect(g).connect(master!); o.start(t); o.stop(t + dur + 0.05);
}

function hiss(dur: number, peak: number, filter: BiquadFilterType, f0: number, f1: number, q = 0.8, delay = 0) {
  const a = ctx!; const t = a.currentTime + delay;
  const s = a.createBufferSource(); s.buffer = noise; s.loop = true;
  const bq = a.createBiquadFilter(); bq.type = filter; bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t); bq.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  const g = a.createGain(); env(g, t, peak, 0.006, dur);
  s.connect(bq).connect(g).connect(master!); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

let lastTick = 0;
export function play(name: Sfx) {
  if (!enabled || !unlocked) return;
  if (!audio() || !master) return;
  switch (name) {
    case 'tick': {
      const now = performance.now(); if (now - lastTick < 55) return; lastTick = now;
      tone('sine', 2400, 1800, 0.025, 0.05); break;
    }
    case 'key': tone('triangle', 1700 + Math.random() * 500, 900, 0.02, 0.035); break;
    case 'click': tone('sine', 680, 320, 0.07, 0.22); hiss(0.02, 0.06, 'highpass', 3000, 3000); break;
    case 'pop': tone('sine', 420, 980, 0.09, 0.22); tone('sine', 980, 1400, 0.06, 0.08, 0.05); break;
    case 'toggle': tone('square', 900, 900, 0.018, 0.05); tone('square', 1350, 1350, 0.018, 0.05, 0.05); break;
    case 'paper': hiss(0.28, 0.16, 'bandpass', 900, 3200, 0.7); break;
    case 'swoosh': hiss(0.35, 0.09, 'bandpass', 400, 1800, 1.2); break;
    case 'print': tone('square', 92, 88, 0.045, 0.05); hiss(0.035, 0.07, 'bandpass', 5200, 3800, 2.5); break;
    case 'cut': hiss(0.22, 0.28, 'highpass', 6000, 1400, 0.6); tone('sawtooth', 220, 90, 0.08, 0.04); break;
    case 'stamp': tone('sine', 140, 48, 0.16, 0.5); hiss(0.05, 0.12, 'lowpass', 1200, 300); break;
    case 'ding': tone('sine', 1318, 1318, 0.9, 0.2); tone('sine', 1760, 1760, 1.1, 0.14, 0.12); tone('sine', 2637, 2637, 0.5, 0.04, 0.12); break;
    case 'error': tone('square', 196, 180, 0.09, 0.08); tone('square', 156, 140, 0.12, 0.08, 0.11); break;
  }
}
