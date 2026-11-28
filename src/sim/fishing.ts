import { FISHING as F } from '../content/balance/fishing';
import { ITEMS_BALANCE as B } from '../content/balance/items';
import { FISH_BY_ITEM, LEGEND_PLACE } from '../content/fishing/fish';
import { placeOf } from '../content/fishing/places';
import { ITEMS } from '../content/items';
import type { NodeDef } from '../content/items/types';
import { getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { SUBPX } from './kernel/fixed';
import { int, weighted } from './kernel/rng';
import type { Fight } from './fishState';
import { give, removeItem, useTool } from './items';
import { pointsOf } from './skills';
import type { SimState } from './state';
import { dayPhase, seasonOf } from './time';

/**
 * The fishing minigame (POW-M6-05), pure and on the sim clock. A cast waits for a bite (`wait`
 * ticks), the bite holds for a tap (`F.biteTicks`), then the fight runs until the catch bar is
 * full (landed), empty or out of time (lost). Losing a fish costs the bait and nothing else.
 */

/** A fight at the cast: waiting, with the bait already used up if there was one. */
export function newFight(bait: boolean): Fight {
  return {
    item: '',
    size: 0,
    phase: 'wait',
    m: F.center,
    v: 0,
    band: 0,
    fill: F.fill.start,
    t: 0,
    hold: false,
    pull: 0,
    pullT: 0,
    rest: 0,
    bait,
  };
}

/**
 * Rolls the wait for a bite, and takes a minnow from the bag if there is one (it shortens the
 * wait). The first value is the wait in ticks, the second whether bait was used.
 */
export function castWait(state: SimState, who: EntityId): { wait: number; bait: boolean } {
  const inv = getComp(state.entities, who, 'inventory');
  const base = int(state.rng.world, B.gather.fishWaitMin, B.gather.fishWaitMax);
  if (inv && removeItem(inv, F.bait.item, 1)) {
    emit(state.events, { type: 'fishBaited', id: who });
    return { wait: Math.max(1, Math.floor((base * F.bait.waitPct) / 100)), bait: true };
  }
  return { wait: base, bait: false };
}

/** Tier of the rod in use: 0 for none. */
function rodTier(state: SimState, who: EntityId, slot: number): number {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = slot >= 0 ? inv?.slots[slot] : null;
  return (stack ? ITEMS[stack.item]?.tool?.tier : undefined) ?? 0;
}

/** The band width for a fish of `difficulty` on a rod of `tier`, after Patient Line. */
export function bandWidth(difficulty: number, tier: number, patient: boolean): number {
  const b = F.band;
  let w = b.byDifficulty[Math.max(0, Math.min(4, difficulty - 1))] as number;
  w += tier > 0 ? b.perRodTier * (tier - 1) : b.noRod;
  if (patient) w = Math.floor((w * F.patientLine.pct) / 100);
  return Math.max(b.min, Math.min(F.track, w));
}

/** The shove a fish of `difficulty` gives each tick of a pull. */
export function pullForce(difficulty: number): number {
  return F.pull.byDifficulty[Math.max(0, Math.min(4, difficulty - 1))] as number;
}

/** The tile a node stands on, for naming its water. */
function tileOf(state: SimState, node: EntityId): { x: number; y: number } {
  const p = getComp(state.entities, node, 'pos');
  return p ? { x: Math.floor(p.x / SUBPX / 16), y: Math.floor(p.y / SUBPX / 16) } : { x: 0, y: 0 };
}

/**
 * Picks what bites: the spot's open fish by weight, or Old Gnarl on the right pond at dusk in
 * autumn for a Fishing 25 hand who has not landed her. Rolled on the loot stream.
 */
function pickFish(
  state: SimState,
  who: EntityId,
  def: NodeDef,
  node: EntityId,
  open: readonly { item: string; weight: number }[],
): string {
  const t = tileOf(state, node);
  if (
    def.water === 'pond' &&
    !state.fishing.gnarl &&
    placeOf(t.x, t.y) === LEGEND_PLACE &&
    dayPhase(state.worldTick) === 'dusk' &&
    seasonOf(state.worldTick) === 'autumn' &&
    pointsOf(state, who, 'skill.fishing') >= F.legend.skill &&
    int(state.rng.loot, 0, 99) < F.legend.pct
  )
    return 'item.old_gnarl';
  return weighted(
    state.rng.loot,
    open.map((y) => [y.item, y.weight] as const),
  );
}

/** A catch's length: the average of `sizeDraws` rolls, so the middle is common. */
function rollSize(state: SimState, lo: number, hi: number): number {
  let sum = 0;
  for (let i = 0; i < F.sizeDraws; i++) sum += int(state.rng.loot, lo, hi);
  return Math.round(sum / F.sizeDraws);
}

/** The bite arrives: a fish is chosen and the tap window opens. */
export function bite(
  state: SimState,
  who: EntityId,
  g: { node: EntityId; fish?: Fight },
  def: NodeDef,
  open: readonly { item: string; weight: number }[],
): void {
  const f = g.fish;
  if (!f) return;
  const item = pickFish(state, who, def, g.node, open);
  const fd = FISH_BY_ITEM[item];
  f.item = item;
  f.size = fd ? rollSize(state, fd.size[0], fd.size[1]) : 1;
  f.phase = 'bite';
  emit(state.events, { type: 'gatherBite', id: who, node: g.node });
}

/** The tap on the bite: the fish is hooked and the fight starts. */
export function hook(
  state: SimState,
  who: EntityId,
  g: { node: EntityId; tool: number; fish?: Fight },
): void {
  const f = g.fish;
  if (!f || f.phase !== 'bite') return;
  const d = FISH_BY_ITEM[f.item]?.difficulty ?? 1;
  f.phase = 'reel';
  f.t = 0;
  f.m = F.center;
  f.v = 0;
  f.fill = F.fill.start;
  f.band = bandWidth(
    d,
    rodTier(state, who, g.tool),
    pointsOf(state, who, 'skill.fishing') >= F.patientLine.at,
  );
  emit(state.events, { type: 'fishHooked', id: who, node: g.node, item: f.item });
}

/** One tick of a fight: the player's line, the fish's shove, the marker, then the catch bar. */
export function reelStep(state: SimState, f: Fight): 'landed' | 'lost' | null {
  const d = FISH_BY_ITEM[f.item]?.difficulty ?? 1;
  const mk = F.marker;
  f.t++;
  // The fish pulls in bursts: a direction rolled on the world stream, a run, then a rest.
  if (f.pullT > 0) {
    f.v += f.pull * pullForce(d);
    if (--f.pullT === 0) f.rest = int(state.rng.world, F.pull.restMin, F.pull.restMax);
  } else if (f.rest > 0) {
    f.rest--;
  } else {
    f.pull = int(state.rng.world, 0, 1) === 0 ? -1 : 1;
    f.pullT = int(state.rng.world, F.pull.ticksMin, F.pull.ticksMax);
  }
  f.v += f.hold ? mk.up : -mk.down;
  f.v -= Math.trunc((f.v * mk.drag) / 256);
  f.v = Math.max(-mk.maxSpeed, Math.min(mk.maxSpeed, f.v));
  f.m += f.v;
  if (f.m < 0 || f.m > F.track) {
    f.m = f.m < 0 ? 0 : F.track;
    f.v = 0;
  }
  const inBand = Math.abs(f.m - F.center) * 2 <= f.band;
  f.fill = Math.min(F.fill.full, f.fill + (inBand ? F.fill.rise : -F.fill.fall));
  if (f.fill >= F.fill.full) return 'landed';
  if (f.fill <= 0 || f.t >= F.maxReelTicks) return 'lost';
  return null;
}

/** The line is held or let go. Only a fight in the reel phase listens. */
export function setReel(state: SimState, who: EntityId, on: boolean): void {
  const g = getComp(state.entities, who, 'gather');
  if (g?.fish?.phase === 'reel') g.fish.hold = on;
}

/** The fish gets away: the cast ends, the spot stays ready, the bait is gone. */
export function lose(state: SimState, who: EntityId, node: EntityId, reason: string): void {
  state.entities.comps.gather[who] = null;
  emit(state.events, { type: 'fishLost', id: who, node, reason });
}

/** The fish is landed: the record, the bag, the rod's wear and the spot's rest. */
export function land(
  state: SimState,
  who: EntityId,
  g: { node: EntityId; tool: number; fish?: Fight },
  def: NodeDef,
): void {
  const f = g.fish;
  const node = getComp(state.entities, g.node, 'node');
  state.entities.comps.gather[who] = null;
  if (!f || !node) return;
  const fd = FISH_BY_ITEM[f.item];
  const t = tileOf(state, g.node);
  const place = placeOf(t.x, t.y);
  const rec = state.fishing.records[f.item];
  const better = !rec || f.size > rec.best;
  state.fishing.records[f.item] = {
    n: (rec?.n ?? 0) + 1,
    best: better ? f.size : (rec as { best: number }).best,
    where: better ? place : (rec as { where: string }).where,
  };
  if (fd?.legend) state.fishing.gnarl = true;
  // A clean fight, landed in about the fewest ticks it can take, can lift the catch to Fine.
  const fewest = Math.ceil((F.fill.full - F.fill.start) / F.fill.rise);
  let q: 0 | 1 = 0;
  if (ITEMS[f.item]?.quality && f.t <= fewest + F.cleanSlack) {
    const pct = Math.min(100, pointsOf(state, who, 'skill.fishing') * B.gather.finePctPerPoint);
    if (pct > 0 && int(state.rng.loot, 0, 99) < pct) q = 1;
  }
  node.readyAt = state.worldTick + def.respawn;
  emit(state.events, {
    type: 'gatherResolved',
    id: who,
    node: g.node,
    sweet: q === 1,
    item: f.item,
    qty: 1,
  });
  emit(state.events, {
    type: 'fishLanded',
    id: who,
    item: f.item,
    size: f.size,
    place,
    record: better,
  });
  give(state, who, f.item, 1, 'gather', q ? { q } : {});
  if (g.tool >= 0) useTool(state, who, g.tool, def.tag);
  const tier = fd?.legend ? 3 : 1;
  emit(state.events, { type: 'gathered', id: who, tag: def.tag, item: f.item, tier, qty: 1 });
}
