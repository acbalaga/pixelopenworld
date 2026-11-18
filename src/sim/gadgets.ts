import { ITEMS } from '../content/items';
import { EQUIP_SLOTS } from '../content/items/types';
import { centerPx, nearestInArc } from './combat/fighter';
import { len } from './combat/geometry';
import { elementHitsUnit, elementHitsWorld } from './elements';
import { destroy, getComp, query, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { dirStep, SUBPX, type Vec } from './kernel/fixed';
import type { SimState } from './state';
import { applyStatus } from './statuses';
import { scare } from './systems/ai';
import { spawnFixture } from './systems/fixtures';

/**
 * Gadgets (M3-14): the Use button on an item with a `gadget` does its one thing and uses it up.
 * The tile ahead is the point 16 px along the avatar's facing.
 */

/** How long a bolted creature runs, a placed snare lasts, and the effect numbers. */
const GADGET = {
  smokeTicks: 90,
  bellRadius: 64,
  bellMaxTier: 1,
  gritTicks: 30,
  gritRange: 80,
  repairPct: 30,
  snareTicks: 1800,
  snareRoot: 90,
  snareTrigger: 8,
  /** Reach of the element gadgets on a creature, px. */
  strikeRadius: 12,
} as const;

/** The point on the tile ahead of the avatar, in px. */
function ahead(state: SimState, who: EntityId): Vec | null {
  const a = getComp(state.entities, who, 'avatar');
  const me = centerPx(state, who);
  if (!a || !me) return null;
  const d = dirStep(a.facing);
  return { x: me.x + d.x * 16, y: me.y + d.y * 16 };
}

/** Uses a gadget from a bag slot. Returns false, using nothing, if it is not one or cannot be used now. */
export function useGadget(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const f = getComp(state.entities, who, 'fighter');
  const stack = inv?.slots[slot];
  const kind = stack ? ITEMS[stack.item]?.gadget : undefined;
  if (!inv || !stack || !f || !kind || kind === 'lantern' || f.state === 'dead') return false;
  // Smoke is for getting out of a fight; the rest need a free hand.
  if (kind !== 'smoke' && f.state !== 'idle') return false;
  const at = ahead(state, who);
  const me = centerPx(state, who);
  if (!at || !me) return false;
  const item = stack.item;

  if (kind === 'spark' || kind === 'flask') {
    const element = kind === 'spark' ? 'ember' : 'tide';
    elementHitsWorld(state, element, at);
    for (const id of query(state.entities, 'fighter', 'pos')) {
      const c = centerPx(state, id);
      if (id === who || !c || getComp(state.entities, id, 'fighter')?.state === 'dead') continue;
      if (len({ x: c.x - at.x, y: c.y - at.y }) <= GADGET.strikeRadius)
        elementHitsUnit(state, id, element, who, true);
    }
  } else if (kind === 'smoke') {
    applyStatus(state, who, 'hidden', who, { ticks: GADGET.smokeTicks });
  } else if (kind === 'bell') {
    for (const id of query(state.entities, 'fighter', 'combatant', 'pos')) {
      const g = getComp(state.entities, id, 'fighter');
      const cb = getComp(state.entities, id, 'combatant');
      const c = centerPx(state, id);
      if (!g || !cb || !c || g.team === 0 || g.state === 'dead' || cb.tier > GADGET.bellMaxTier)
        continue;
      if (len({ x: c.x - me.x, y: c.y - me.y }) <= GADGET.bellRadius) scare(state, id, who);
    }
  } else if (kind === 'repair') {
    for (const s of EQUIP_SLOTS) {
      const w = inv.equipment[s];
      const max = w ? ITEMS[w.item]?.durability : undefined;
      if (w && max !== undefined)
        w.dur = Math.min(max, (w.dur ?? max) + Math.ceil((max * GADGET.repairPct) / 100));
    }
  } else if (kind === 'snare') {
    const id = spawnFixture(state, 'fixture.snare', 0, 0);
    const pos = getComp(state.entities, id, 'pos');
    const fx = getComp(state.entities, id, 'fixture');
    const p = getComp(state.entities, who, 'pos');
    const a = getComp(state.entities, who, 'avatar');
    if (!pos || !fx || !p || !a) return false;
    const d = dirStep(a.facing);
    pos.x = p.x + d.x * 16 * SUBPX;
    pos.y = p.y + d.y * 16 * SUBPX;
    fx.home = { ...pos };
    fx.temp = true;
    fx.until = state.worldTick + GADGET.snareTicks;
  } else if (kind === 'grit') {
    const a = getComp(state.entities, who, 'avatar');
    const target = a ? nearestInArc(state, who, dirStep(a.facing), GADGET.gritRange, 0) : null;
    if (target !== null) applyStatus(state, target, 'dazed', who, { ticks: GADGET.gritTicks });
  }

  stack.qty--;
  if (stack.qty === 0) inv.slots[slot] = null;
  emit(state.events, { type: 'gadgetUsed', who, item, gadget: kind });
  return true;
}

/** A snare roots the first creature to step on it, then is gone. */
export function snareSystem(state: SimState): void {
  const foes = query(state.entities, 'fighter', 'pos').filter((id) => {
    const f = getComp(state.entities, id, 'fighter');
    return f !== undefined && f.team === 1 && f.state !== 'dead';
  });
  if (foes.length === 0) return;
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const fx = getComp(state.entities, id, 'fixture');
    const p = getComp(state.entities, id, 'pos');
    if (fx?.kind !== 'fixture.snare' || !p) continue;
    for (const foe of foes) {
      const c = getComp(state.entities, foe, 'pos');
      if (!c || Math.hypot(c.x - p.x, c.y - p.y) / SUBPX > GADGET.snareTrigger) continue;
      applyStatus(state, foe, 'rooted', -1, { ticks: GADGET.snareRoot });
      emit(state.events, { type: 'snareSprung', id, foe });
      destroy(state.entities, id);
      break;
    }
  }
}
