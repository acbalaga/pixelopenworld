import { COMBAT as C } from '../../content/balance/combat';
import { ITEMS } from '../../content/items';
import { getComp, type EntityId } from '../kernel/entities';
import { dirStep, type Vec } from '../kernel/fixed';
import type { SimState } from '../state';
import { len } from './geometry';

/** True if a shield is worn in the off hand. Only then does a Guard button exist. */
export function hasShield(state: SimState, who: EntityId): boolean {
  const stack = getComp(state.entities, who, 'inventory')?.equipment.off;
  const def = stack ? ITEMS[stack.item] : undefined;
  return def?.equip?.doll?.offHand === 'shield';
}

/** The way a fighter faces, as a vector. The avatar faces its facing, a creature its heading, else its aim. */
export function facingOf(state: SimState, id: EntityId): Vec {
  const a = getComp(state.entities, id, 'avatar');
  if (a) return dirStep(a.facing);
  const ai = getComp(state.entities, id, 'ai');
  if (ai) return dirStep((ai.heading % 8) as 0);
  return getComp(state.entities, id, 'fighter')?.aim ?? { x: 0, y: 1 };
}

/**
 * Cosine times 256 of the angle between `facing` and the direction from `at` (the target's
 * center) to `from` (where the hit came from). 256 is straight ahead, -256 straight behind. A
 * hit from the same point counts as ahead.
 */
export function hitAngle256(facing: Vec, at: Vec, from: Vec): number {
  const d = { x: from.x - at.x, y: from.y - at.y };
  const l = len(d);
  const fl = len(facing);
  if (l === 0 || fl === 0) return 256;
  return Math.round((256 * (d.x * facing.x + d.y * facing.y)) / (l * fl));
}

/** The guard is up and nothing else is happening, so it can block. */
export function blocking(state: SimState, id: EntityId): boolean {
  const f = getComp(state.entities, id, 'fighter');
  return !!f && f.guard && f.state === 'idle';
}

/** Raises or lowers the guard. Raising needs a shield and starts the parry window. */
export function setGuard(state: SimState, who: EntityId, on: boolean): void {
  const f = getComp(state.entities, who, 'fighter');
  if (!f || f.state === 'dead') return;
  if (on) {
    if (f.guard || !hasShield(state, who)) return;
    f.guard = true;
    f.guardT = 0;
  } else {
    f.guard = false;
  }
}

/** Walk speed factor while guarding, percent. */
export function guardWalkPct(state: SimState, who: EntityId): number {
  return blocking(state, who) ? C.guard.walkPct : 100;
}
