import type { Vec } from '../kernel/fixed';
import type { HitShape } from '../../content/combat/attacks';

/** Length of a px vector. Math.sqrt is exactly rounded in IEEE 754, so it is the same everywhere. */
export function len(v: Vec): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * True if a target at `d` (px, from the attacker's feet) is inside the shape aimed along `aim`.
 * `radius` is the target's half size, so a body is hit when any part of it reaches the shape.
 */
export function inShape(shape: HitShape, aim: Vec, d: Vec, radius: number): boolean {
  if (shape.kind === 'circle') return len(d) <= shape.radius + radius;
  const al = len(aim);
  if (al === 0) return false;
  const forward = (d.x * aim.x + d.y * aim.y) / al;
  const dist = len(d);
  if (shape.kind === 'arc') {
    if (dist > shape.reach + radius) return false;
    if (dist <= radius) return true;
    return forward / dist >= shape.cos256 / 256;
  }
  const side = Math.abs(d.x * aim.y - d.y * aim.x) / al;
  return forward >= -radius && forward <= shape.reach + radius && side <= shape.halfWidth + radius;
}
