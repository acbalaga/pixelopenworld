import {
  BLEND_FRACTION,
  LIGHT_FROM_ALPHA,
  PHASE_GRADE,
  WEATHER_GRADE,
} from '../content/world/atmosphere';
import type { Weather } from '../content/balance/time';
import { PALETTE } from '../content/sprites/palette';
import { phaseProgress } from '../sim/time';

/** A tint ready to draw: a hex colour, a strength, and how it combines. */
export interface Tint {
  color: string;
  alpha: number;
  blend: 'multiply' | 'normal';
}

function rgb(index: number): [number, number, number] {
  const h = (PALETTE[index] as string).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const hex = (c: readonly number[]): string =>
  `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * The tint of the sky at a world tick. Each phase blends in from the one before over the first
 * {@link BLEND_FRACTION} of its length, so the light changes smoothly and never jumps.
 */
export function phaseTint(tick: number): Tint {
  const { phase, t, prev } = phaseProgress(tick);
  const cur = PHASE_GRADE[phase];
  const k = t < BLEND_FRACTION ? t / BLEND_FRACTION : 1;
  const from = PHASE_GRADE[prev];
  const a = rgb(from.color);
  const b = rgb(cur.color);
  return {
    color: hex([0, 1, 2].map((i) => (a[i] as number) + ((b[i] as number) - (a[i] as number)) * k)),
    alpha: from.alpha + (cur.alpha - from.alpha) * k,
    blend: 'multiply',
  };
}

/** The tint of the weather. Clear has none (alpha 0). */
export function weatherTint(weather: Weather): Tint {
  const g = WEATHER_GRADE[weather];
  return { color: PALETTE[g.color] as string, alpha: g.alpha, blend: g.blend };
}

/**
 * How lit the night's lights are, 0 (day, off) to 1 (full night). Dusk and dawn show them in
 * proportion to how dark the phase tint has got.
 */
export function lightLevel(tick: number): number {
  const night = PHASE_GRADE.night.alpha;
  const a = phaseTint(tick).alpha;
  return a <= LIGHT_FROM_ALPHA
    ? 0
    : Math.min(1, (a - LIGHT_FROM_ALPHA) / (night - LIGHT_FROM_ALPHA));
}

/** The overlays for a frame: at most one multiply (hour and weather merged) and one plain haze. */
export interface SkyOverlays {
  /** Colour to multiply the whole frame by, or null when the frame is untinted. */
  multiply: string | null;
  haze: Tint | null;
}

/**
 * Works out the frame's overlays. Two multiply tints (the hour's and a storm's) are exactly one
 * multiply by the product of their per-channel factors, so they are merged into a single full
 * screen fill, which is what keeps a night storm inside the frame budget.
 */
export function skyOverlays(tick: number, weather: Weather): SkyOverlays {
  const tints = [phaseTint(tick), weatherTint(weather)];
  const factor = [1, 1, 1];
  let any = false;
  let haze: Tint | null = null;
  for (const t of tints) {
    if (t.alpha <= 0.004) continue;
    if (t.blend === 'multiply') {
      any = true;
      const h = t.color.slice(1);
      for (let i = 0; i < 3; i++) {
        const v = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
        factor[i] = (factor[i] as number) * (1 - t.alpha + t.alpha * v);
      }
    } else haze = t;
  }
  return { multiply: any ? hex(factor.map((f) => f * 255)) : null, haze };
}
