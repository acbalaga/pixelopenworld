import { CRAFTING } from '../content/balance/crafting';
import type { StepKind } from '../content/items/stations';
import { Layer, type Renderer } from './renderer';

/** The pieces the overlay reads. Pure data: it never touches the sim. */
export interface CraftStepView {
  step: StepKind;
  /** Ticks since the craft began. */
  t: number;
  /** Tap ticks so far, as ticks since the craft began. */
  taps: readonly number[];
  /** Which craft, so a trace draws its own path. */
  craft?: string;
  /** Trace: pointer samples so far, flat x, y pairs in the 1000 by 1000 space. */
  samples?: readonly number[];
  /** Hold: ticks the pointer has been held so far, or null before it goes down. */
  held?: number | null;
  /** Hold: the tick it was let go, or null while it is held. */
  released?: boolean;
}

/** The square the trace is drawn and read in, in logical px. The world reads pointers against it. */
export function stepRect(v: {
  width: number;
  safe: { x: number; y: number; w: number; h: number };
}): { x: number; y: number; w: number; h: number } {
  const size = Math.min(130, v.safe.w - 24, Math.floor(v.safe.h * 0.5));
  return {
    x: Math.floor(v.width / 2) - Math.floor(size / 2),
    y: v.safe.y + Math.floor(v.safe.h * 0.28),
    w: size,
    h: size,
  };
}

/** Colors for the overlay. Meaning never rests on color alone: perfect is wide, good is narrow, a miss is dark. */
export interface CraftStepColors {
  ink: string;
  dark: string;
  gold: string;
  track: string;
  good: string;
}

/** How a tap at `tick` fared against `target`. */
export function judge(step: StepKind, tick: number, target: number): 'perfect' | 'good' | 'miss' {
  const cfg = step === 'rhythm' ? CRAFTING.step.rhythm : CRAFTING.step.timing;
  const d = Math.abs(tick - target);
  return d <= cfg.perfect ? 'perfect' : d <= cfg.good ? 'good' : 'miss';
}

/**
 * Draws the manual step of a craft: a track with a notch at each target (a wide gold window for
 * perfect, a thin lighter one for good), a marker that runs along it, and a pip under each target
 * that fills when it is judged. One tap anywhere in the lower zone, or the context key, is a hit.
 */
export function drawCraftStep(
  renderer: Renderer,
  v: { width: number; height: number; safe: { x: number; y: number; w: number; h: number } },
  view: CraftStepView,
  c: CraftStepColors,
): void {
  if (view.step === 'trace') return drawTrace(renderer, v, view, c);
  if (view.step === 'hold') return drawHold(renderer, v, view, c);
  const cfg = view.step === 'rhythm' ? CRAFTING.step.rhythm : CRAFTING.step.timing;
  const total = (cfg.targets[cfg.targets.length - 1] ?? 0) + CRAFTING.step.endGrace;
  const w = Math.min(120, v.safe.w - 24);
  const x0 = Math.floor(v.width / 2) - Math.floor(w / 2);
  const y = v.safe.y + Math.floor(v.safe.h * 0.58);
  const k = w / total;
  renderer.drawRect(Layer.Hud, x0 - 2, y - 2, w + 4, 12, c.dark);
  renderer.drawRect(Layer.Hud, x0, y, w, 8, c.track);
  cfg.targets.forEach((target, i) => {
    const good = Math.max(1, Math.round((cfg.good * 2 + 1) * k));
    const perfect = Math.max(2, Math.round((cfg.perfect * 2 + 1) * k));
    const cx = x0 + Math.round(target * k);
    renderer.drawRect(Layer.Hud, cx - Math.floor(good / 2), y, good, 8, c.good);
    renderer.drawRect(Layer.Hud, cx - Math.floor(perfect / 2), y, perfect, 8, c.gold);
    // A pip under each target: filled once its tap is in, with the grade as its height.
    const tap = view.taps[i];
    const how = tap === undefined ? null : judge(view.step, tap, target);
    const h = how === 'perfect' ? 5 : how === 'good' ? 3 : how === 'miss' ? 1 : 0;
    renderer.drawRect(Layer.Hud, cx - 2, y + 11, 5, 5, c.dark);
    if (h > 0)
      renderer.drawRect(Layer.Hud, cx - 1, y + 15 - h, 3, h, how === 'perfect' ? c.gold : c.ink);
  });
  renderer.drawRect(Layer.Hud, x0 + Math.min(w - 2, Math.round(view.t * k)), y - 2, 2, 12, c.ink);
}

/**
 * The trace: a square with the path drawn as a wide ribbon (its width is the width that counts),
 * a dot where each sample landed, and a bar of the time left. Meaning never rests on color alone:
 * the ribbon is wide and light, a sample inside it is a bright dot and one outside a dark one.
 */
function drawTrace(
  renderer: Renderer,
  v: { width: number; height: number; safe: { x: number; y: number; w: number; h: number } },
  view: CraftStepView,
  c: CraftStepColors,
): void {
  const r = stepRect(v);
  const path = CRAFTING.paths[view.craft ?? ''] ?? [];
  const k = r.w / 1000;
  renderer.drawRect(Layer.Hud, r.x - 2, r.y - 2, r.w + 4, r.h + 4, c.dark);
  renderer.drawRect(Layer.Hud, r.x, r.y, r.w, r.h, c.track);
  const half = Math.max(1, Math.round((CRAFTING.step.trace.width * k) / 1));
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as readonly [number, number];
    const b = path[i] as readonly [number, number];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * k));
    for (let j = 0; j <= n; j++) {
      const x = r.x + Math.round((a[0] + ((b[0] - a[0]) * j) / n) * k);
      const y = r.y + Math.round((a[1] + ((b[1] - a[1]) * j) / n) * k);
      renderer.drawRect(Layer.Hud, x - half, y - half, half * 2 + 1, half * 2 + 1, c.good);
    }
  }
  // The start of the path: a gold square, so the player knows where to begin.
  const s0 = path[0];
  if (s0)
    renderer.drawRect(
      Layer.Hud,
      r.x + Math.round(s0[0] * k) - 3,
      r.y + Math.round(s0[1] * k) - 3,
      7,
      7,
      c.gold,
    );
  const samples = view.samples ?? [];
  for (let i = 0; i + 1 < samples.length; i += 2) {
    const x = r.x + Math.round((samples[i] as number) * k);
    const y = r.y + Math.round((samples[i + 1] as number) * k);
    renderer.drawRect(Layer.Hud, x - 1, y - 1, 3, 3, c.ink);
  }
  const left = Math.max(0, 1 - view.t / CRAFTING.step.trace.window);
  renderer.drawRect(Layer.Hud, r.x, r.y + r.h + 4, r.w, 4, c.dark);
  renderer.drawRect(Layer.Hud, r.x, r.y + r.h + 4, Math.round(r.w * left), 4, c.gold);
}

/**
 * The hold: a heat bar. The band to release in is a wide gold window (its core is the perfect
 * one, the shoulders are good). The heat fills as the pointer is held, and a marker rides its tip.
 */
function drawHold(
  renderer: Renderer,
  v: { width: number; height: number; safe: { x: number; y: number; w: number; h: number } },
  view: CraftStepView,
  c: CraftStepColors,
): void {
  const cfg = CRAFTING.step.hold;
  const w = Math.min(130, v.safe.w - 24);
  const x0 = Math.floor(v.width / 2) - Math.floor(w / 2);
  const y = v.safe.y + Math.floor(v.safe.h * 0.5);
  const k = w / 1000;
  renderer.drawRect(Layer.Hud, x0 - 2, y - 2, w + 4, 16, c.dark);
  renderer.drawRect(Layer.Hud, x0, y, w, 12, c.track);
  const good = Math.round(cfg.good * 2 * k);
  const perfect = Math.max(2, Math.round(cfg.perfect * 2 * k));
  const cx = x0 + Math.round(cfg.center * k);
  renderer.drawRect(Layer.Hud, cx - Math.floor(good / 2), y, good, 12, c.good);
  renderer.drawRect(Layer.Hud, cx - Math.floor(perfect / 2), y, perfect, 12, c.gold);
  const heat =
    view.held === null || view.held === undefined ? 0 : Math.min(1000, view.held * cfg.perTick);
  renderer.drawRect(Layer.Hud, x0, y + 4, Math.round(heat * k), 4, c.ink);
  renderer.drawRect(Layer.Hud, x0 + Math.round(heat * k) - 1, y - 2, 3, 16, c.ink);
}
