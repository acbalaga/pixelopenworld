import { ATTACKS } from '../content/combat/attacks';
import { len } from '../sim/combat/geometry';
import type { SimState } from '../sim/state';
import { Layer, type Renderer } from './renderer';

/** What to draw on the ground for a creature attack that is winding up. */
export type Telegraph =
  /** A circle around the attacker: slams. */
  | { kind: 'circle'; x: number; y: number; radius: number; progress: number }
  /** A lane from the attacker along its aim: charges and thrown seeds. */
  | {
      kind: 'lane';
      x: number;
      y: number;
      dx: number;
      dy: number;
      length: number;
      halfWidth: number;
      progress: number;
    }
  /** No ground marker; the creature itself flashes (close melee). */
  | { kind: 'flash'; progress: number };

/**
 * The telegraph of creature `id` this tick, or null when it is not winding up an attack. `progress`
 * runs 0 to 1 across the wind-up, so the marker can build toward the strike.
 */
export function telegraphOf(state: SimState, id: number): Telegraph | null {
  const f = state.entities.comps.fighter[id];
  const p = state.entities.comps.pos[id];
  if (!f || !p || f.team !== 1 || f.state !== 'attack' || !f.atk) return null;
  const def = ATTACKS[f.atk];
  if (!def || f.t >= def.windup) return null;
  const progress = Math.max(0, f.t) / def.windup;
  const x = p.x / 256;
  const y = p.y / 256;
  const l = len(f.aim) || 1;
  const dx = f.aim.x / l;
  const dy = f.aim.y / l;
  const shape = def.shape;
  if (shape.kind === 'circle') return { kind: 'circle', x, y, radius: shape.radius, progress };
  if (def.dash)
    return {
      kind: 'lane',
      x,
      y,
      dx,
      dy,
      length: def.dash + shape.reach,
      halfWidth: shape.kind === 'line' ? shape.halfWidth : 8,
      progress,
    };
  if (def.projectile) {
    const reach = def.projectile.speed * def.projectile.ttl;
    return { kind: 'lane', x, y, dx, dy, length: reach, halfWidth: 1, progress };
  }
  return { kind: 'flash', progress };
}

const FILL = (a: number): string => `rgba(194, 64, 42, ${a.toFixed(2)})`;

/** Draws every creature's ground marker. World layer, under the actors. */
export function drawTelegraphs(r: Renderer, state: SimState): void {
  for (let id = 0; id < state.entities.capacity; id++) {
    if (!state.entities.alive[id]) continue;
    const t = telegraphOf(state, id);
    if (!t || t.kind === 'flash') continue;
    const a = 0.18 + 0.32 * t.progress;
    if (t.kind === 'circle') {
      // Filled disc from rows, grown from the middle out to the full radius as the strike nears.
      const rad = Math.round(t.radius * (0.4 + 0.6 * t.progress));
      for (let dy = -rad; dy <= rad; dy += 2) {
        const half = Math.floor(Math.sqrt(rad * rad - dy * dy));
        r.drawRect(
          Layer.Detail,
          Math.round(t.x) - half,
          Math.round(t.y) + dy - 4,
          half * 2,
          2,
          FILL(a),
        );
      }
      // Outline ring at the full radius so the final size is readable from the start.
      for (let k = 0; k < 24; k++) {
        const ang = (k / 24) * Math.PI * 2;
        r.drawRect(
          Layer.Detail,
          Math.round(t.x + Math.cos(ang) * t.radius),
          Math.round(t.y - 4 + Math.sin(ang) * t.radius),
          2,
          2,
          FILL(0.55),
        );
      }
    } else {
      const reach = Math.round(t.length * (0.5 + 0.5 * t.progress));
      for (let d = 4; d <= reach; d += 2) {
        for (let w = -t.halfWidth; w <= t.halfWidth; w += 2) {
          r.drawRect(
            Layer.Detail,
            Math.round(t.x + t.dx * d - t.dy * w),
            Math.round(t.y - 4 + t.dy * d + t.dx * w),
            2,
            2,
            FILL(a),
          );
        }
      }
    }
  }
}
