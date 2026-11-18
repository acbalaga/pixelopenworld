import { COMBAT as C } from '../../content/balance/combat';
import { getComp, type EntityId } from '../kernel/entities';
import type { SimState } from '../state';
import { facingOf, hitAngle256 } from './guard';
import type { Vec } from '../kernel/fixed';

/**
 * The built-in property of each weapon family (design/04). Each is a rule here and a number in
 * `content/balance/combat.ts`. A hit's `tag` is its weapon family, so a spell or an arrow never
 * triggers another family's rule.
 */

/** What a swing carries into damage: the percent the family's property adds, 100 for none. */
export function propertyPct(
  state: SimState,
  dst: EntityId,
  tag: string,
  at: Vec,
  from: Vec,
  wasStaggered: boolean,
): number {
  if (tag !== 'blades') return 100;
  const w = C.weapons.blades;
  let pct = 100;
  // Behind: the attacker is more than 120 degrees from where the target faces.
  if (hitAngle256(facingOf(state, dst), at, from) < w.behindCos256) pct = (pct * w.behindPct) / 100;
  if (wasStaggered) pct = (pct * w.staggeredPct) / 100;
  return Math.floor(pct);
}

/** Stagger bar points a hit adds. Heavy Arms builds it fast. */
export function staggerPoints(tag: string, base: number): number {
  return tag === 'heavy' ? Math.floor((base * C.weapons.heavy.staggerPct) / 100) : base;
}

/**
 * Knockback distance in px. A polearm leaves the target at least `keepOutPx` from the wielder,
 * so a common melee swipe cannot reach back.
 */
export function knockPx(tag: string, base: number, dist: number): number {
  if (tag !== 'polearms') return base;
  return Math.max(base, Math.ceil(C.weapons.polearms.keepOutPx - dist));
}

/** Hits of this family on a raised guard break it instead of being blocked. */
export function breaksGuard(tag: string): boolean {
  return tag === 'heavy';
}

/** Stamina refunded to the attacker for a landed hit, in tenths. */
export function refundOf(tag: string): number {
  return tag === 'unarmed' ? C.weapons.unarmed.refund : 0;
}

/** Percent of full damage an arrow does after `still` ticks of standing still. */
export function chargePct(still: number): number {
  const a = C.weapons.archery;
  const t = Math.min(Math.max(still, 0), a.chargeTicks);
  return a.minPct + Math.floor(((a.maxPct - a.minPct) * t) / a.chargeTicks);
}

/** Ticks the fighter has stood still. */
export function stillOf(state: SimState, id: EntityId): number {
  return getComp(state.entities, id, 'fighter')?.still ?? 0;
}
