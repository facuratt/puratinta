/**
 * Gaze model for the hero.
 *
 * Measured off the source clip (per-frame pupil offset relative to the eye
 * bounding box, so head translation is factored out):
 *
 *   local 0–19   (clip 45–64)  gaze -0.12  — held looking screen-LEFT
 *   local 20–34  (clip 65–79)  eyes closed — the animator's blink
 *   local 35–44  (clip 80–89)  gaze +0.16  — held looking screen-RIGHT
 *
 * The clip holds two poses and jumps between them under cover of a blink;
 * there is no continuous sweep to scrub through. So the playhead is allowed
 * to rest only inside a hold, and crossing the middle plays the blink as the
 * transition — which is what the animation was built to do.
 */

export const LEFT_HOLD_END = 19;
export const RIGHT_HOLD_START = 35;
export const LAST_FRAME = 44;

/**
 * Hysteresis band. The side only flips once the cursor is clearly committed,
 * so a cursor jittering around the centre line cannot leave the character
 * parked mid-blink with its eyes shut.
 */
export const ENTER_RIGHT = 0.56;
export const ENTER_LEFT = 0.44;

export type Side = 'left' | 'right';

export function nextSide(x: number, current: Side): Side {
  if (x > ENTER_RIGHT) return 'right';
  if (x < ENTER_LEFT) return 'left';
  return current;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Maps normalised cursor x (0 = left edge, 1 = right edge) to a fractional
 * frame index inside whichever hold the pointer is committed to. Travel
 * within a hold is real: the head drifts a little across those frames, so
 * the character keeps responding everywhere, not only at the flip.
 */
export function frameForPointer(x: number, side: Side): number {
  if (side === 'left') {
    return clamp01(x / ENTER_RIGHT) * LEFT_HOLD_END;
  }
  const t = clamp01((x - ENTER_LEFT) / (1 - ENTER_LEFT));
  return RIGHT_HOLD_START + t * (LAST_FRAME - RIGHT_HOLD_START);
}

/** Frame-rate independent exponential approach: 63% of the gap per `tau`. */
export const approach = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

/**
 * How quickly the playhead chases the cursor inside a hold, where the frames
 * are near-identical and only the head drifts. Small, so pointing at her
 * feels direct.
 */
export const TAU_FRAME = 0.11;

/**
 * Playback ceiling, in frames per second, while crossing the blink.
 *
 * An exponential chase alone is wrong for this stretch: it is fastest at the
 * instant the gap opens, so crossing the centre line fired the blink at
 * roughly seven times the speed the animator drew it, then crawled into the
 * new pose. Capping the rate through the blink plays it at a deliberate,
 * near-constant cadence instead. The source blink runs at 30fps; 24 stretches
 * it to about two thirds of a second, which reads as a real blink. Lower is
 * slower and more languid — this is the number to tune.
 */
export const BLINK_FPS = 20;

/**
 * Hold frames may be crossed quickly — they differ only by a little head
 * drift, so there is nothing to see. High enough that the exponential chase,
 * not this cap, governs inside a hold.
 */
export const HOLD_FPS = 150;

/**
 * Where the eyes are actually in motion, measured off the clip: the lids
 * start closing at 20, are fully shut through 24–31, and have reopened by 35.
 * The speed limit must be at full strength across this whole span, not just
 * at its midpoint.
 */
const BLINK_IN = 20;
const BLINK_OUT = 34;

/**
 * Frames over which the limit eases in and out. The ramps sit *outside* the
 * blink, inside the holds, where consecutive frames are near-identical and
 * a change of speed cannot be seen.
 */
const RAMP = 4;

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 1 across the whole blink, 0 well inside either hold, ramped between. */
function blinkWeight(f: number): number {
  const entering = smoothstep(BLINK_IN - RAMP, BLINK_IN, f);
  const leaving = 1 - smoothstep(BLINK_OUT, BLINK_OUT + RAMP, f);
  return Math.min(entering, leaving);
}

/**
 * Frames per second the playhead may travel at, given where it currently is.
 * The ramp means the playhead decelerates into the blink and accelerates out
 * of it rather than changing speed on a step.
 */
export function maxFrameRate(f: number): number {
  return HOLD_FPS + (BLINK_FPS - HOLD_FPS) * blinkWeight(f);
}

/** The parallax lags the gaze slightly, which gives the head some weight. */
export const TAU_PARALLAX = 0.24;
