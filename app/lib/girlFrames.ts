/**
 * The hero runs off a decoded WebP frame sequence rather than a <video>.
 *
 * Scrubbing a <video> means writing `currentTime` every pointer move, and
 * every browser answers that with an async seek — Safari and Firefox in
 * particular drop or coalesce seeks under a fast cursor, which reads as
 * stutter exactly when the motion should feel locked to the hand. Forty-five
 * pre-decoded bitmaps sidestep the codec entirely: picking a frame is an
 * array index and painting it is one drawImage.
 */

export const FRAME_COUNT = 45;

/** Source clip frames 45–89 at 30fps, re-indexed to 0–44. */
export const frameUrl = (i: number) =>
  `/girl/g${String(i).padStart(2, '0')}.webp`;

export type FrameSet = readonly HTMLImageElement[];

function loadOne(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    // decode() moves the cost off the first paint; if it is unsupported or
    // rejects (some Safari versions throw on cached images) the load event
    // still gives us a usable bitmap.
    const done = () => resolve(img);
    if (typeof img.decode === 'function') {
      img.decode().then(done, () => (img.complete ? done() : (img.onload = done)));
    } else {
      img.onload = done;
    }
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
  });
}

/**
 * Fills — and hands back — a sparse array that becomes dense as frames land.
 * `onProgress` receives the same array on every step, so the canvas can paint
 * the resting pose as soon as frame 0 decodes and pick up the rest as they
 * arrive, instead of staring at an empty hero until the last one is in.
 */
export async function loadFrames(
  onProgress?: (loaded: number, total: number, frames: HTMLImageElement[]) => void,
): Promise<HTMLImageElement[]> {
  const frames: HTMLImageElement[] = new Array(FRAME_COUNT);
  let loaded = 0;

  const track = async (i: number) => {
    frames[i] = await loadOne(frameUrl(i));
    onProgress?.(++loaded, FRAME_COUNT, frames);
  };

  // Frame 0 is the resting pose (gaze left) and is preloaded by index.html,
  // so it lands first and the hero can paint immediately.
  await track(0);
  await Promise.all(Array.from({length: FRAME_COUNT - 1}, (_, k) => track(k + 1)));

  return frames;
}
