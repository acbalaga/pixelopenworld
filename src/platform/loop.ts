/** Frame loop: fixed 30 Hz sim ticks inside a variable-rate render loop. */

/** Sim ticks per second. */
export const TICK_HZ = 30;
/** Most ticks run in one frame. Longer gaps are dropped here and handled by settlement. */
export const MAX_CATCHUP_TICKS = 5;

/** Everything the loop touches from the outside, injected so tests use a fake clock. */
export interface LoopDeps {
  /** Runs one sim tick. */
  tick: () => void;
  /** Draws a frame. `alpha` in [0, 1) is the fraction between the last two sim states. */
  render: (alpha: number) => void;
  /** Called when time was dropped (hidden tab or long stall), with the dropped milliseconds. */
  onGap?: (droppedMs: number) => void;
}

/** A running loop. Feed it frame timestamps in ms. */
export interface Loop {
  /** Call once per animation frame with a monotonic timestamp in ms. Returns ticks run. */
  frame: (nowMs: number) => number;
  /** Stop advancing (tab hidden). The next frame after resume discards the gap. */
  pause: () => void;
  resume: () => void;
}

// Accumulate in units of (ms * TICK_HZ) so one tick is exactly 1000 units and float drift stays tiny.
const UNIT_PER_TICK = 1000;
const EPS = 1e-6;

/** Creates the loop core. */
export function createLoop(deps: LoopDeps): Loop {
  let last: number | null = null;
  let acc = 0;
  let paused = false;

  return {
    frame(nowMs) {
      if (paused) return 0;
      if (last === null) {
        last = nowMs;
        deps.render(0);
        return 0;
      }
      const dt = Math.max(0, nowMs - last);
      last = nowMs;
      acc += dt * TICK_HZ;
      let ran = 0;
      while (acc >= UNIT_PER_TICK - EPS && ran < MAX_CATCHUP_TICKS) {
        deps.tick();
        acc -= UNIT_PER_TICK;
        ran++;
      }
      if (acc >= UNIT_PER_TICK - EPS) {
        deps.onGap?.((acc / TICK_HZ) | 0);
        acc = 0;
      }
      if (acc < 0) acc = 0;
      deps.render(Math.min(acc / UNIT_PER_TICK, 0.999999));
      return ran;
    },
    pause() {
      paused = true;
    },
    resume() {
      if (!paused) return;
      paused = false;
      last = null;
      acc = 0;
    },
  };
}

/** Wires the loop to requestAnimationFrame and page visibility. Returns a stop function. */
export function startBrowserLoop(deps: LoopDeps): () => void {
  const loop = createLoop(deps);
  let id = 0;
  let stopped = false;
  const onFrame = (t: number): void => {
    if (stopped) return;
    loop.frame(t);
    id = requestAnimationFrame(onFrame);
  };
  const onVisibility = (): void => {
    if (document.hidden) loop.pause();
    else loop.resume();
  };
  document.addEventListener('visibilitychange', onVisibility);
  if (document.hidden) loop.pause();
  id = requestAnimationFrame(onFrame);
  return () => {
    stopped = true;
    cancelAnimationFrame(id);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
