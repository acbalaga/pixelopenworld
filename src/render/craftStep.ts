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
