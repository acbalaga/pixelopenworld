import { SUBPX } from '../sim/kernel/fixed';

/**
 * Keeps each entity's previous-tick position so drawing can blend between the last two sim
 * states. Call `capture` right before each tick. Arrays are reused, so no per-frame allocation.
 */
export class Interpolator {
  private px: number[] = [];
  private py: number[] = [];

  /** Records current positions (sub-pixel units) as "previous". */
  capture(pos: readonly ({ x: number; y: number } | null)[]): void {
    for (let i = 0; i < pos.length; i++) {
      const p = pos[i];
      if (p) {
        this.px[i] = p.x;
        this.py[i] = p.y;
      }
    }
  }

  /** Interpolated x in px for entity `id` whose current sub-pixel x is `cur`. */
  x(id: number, cur: number, alpha: number): number {
    const prev = this.px[id] ?? cur;
    return (prev + (cur - prev) * alpha) / SUBPX;
  }

  /** Interpolated y in px. */
  y(id: number, cur: number, alpha: number): number {
    const prev = this.py[id] ?? cur;
    return (prev + (cur - prev) * alpha) / SUBPX;
  }
}
