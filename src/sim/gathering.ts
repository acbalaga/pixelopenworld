import { ITEMS_BALANCE as B } from '../content/balance/items';
import { ITEMS } from '../content/items';
import { NODES } from '../content/items/recipes';
import type { NodeDef, SweepDef, YieldDef } from '../content/items/types';
import { getComp, setComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { int, weighted } from './kernel/rng';
import { give, useTool } from './items';
import { pointsOf } from './skills';
import type { Inventory, SimState } from './state';
import { currentWeather, dayPhase, seasonOf } from './time';

/** The best tool of `kind` in the bag, without equipping it: the highest tier, the first slot on a tie. */
export function bestTool(inv: Inventory, kind: string): { slot: number; tier: number } | null {
  let best: { slot: number; tier: number } | null = null;
  inv.slots.forEach((s, slot) => {
    const t = s ? ITEMS[s.item]?.tool : undefined;
    if (t && t.kind === kind && (!best || t.tier > best.tier)) best = { slot, tier: t.tier };
  });
  return best;
}

/** The base sweep for a node, before any tool: the default with the node's own overrides. */
export function baseSweep(def: NodeDef): SweepDef {
  const g = B.gather;
  return {
    ticks: g.sweepTicks,
    sweetFrom: g.sweetFrom,
    sweetTo: g.sweetTo,
    baseMin: g.baseMin,
    baseMax: g.baseMax,
    sweetBonus: g.sweetBonus,
    swings: g.swings,
    ...def.sweep,
  };
}

/**
 * The sweep a tool of `toolTier` (0 for none) gives on `def`. A tool below the node's tier, or
 * none, slows the sweep and costs 1 yield. A tier above widens the sweet window. A node that
 * needs no tool is never changed.
 */
export function sweepFor(def: NodeDef, toolTier: number): { sweep: SweepDef; penalty: number } {
  const sweep = baseSweep(def);
  if (!def.tool) return { sweep, penalty: 0 };
  if (toolTier < def.tier) {
    sweep.ticks = Math.ceil((sweep.ticks * (100 + B.gather.toolSlowPct)) / 100);
    return { sweep, penalty: 1 };
  }
  sweep.sweetTo = Math.min(
    sweep.ticks - 1,
    sweep.sweetTo + (toolTier - def.tier) * B.gather.toolWindowTicks,
  );
  return { sweep, penalty: 0 };
}

/**
 * What a node can give right now: its yields that hold in this day phase, season and weather.
 * If none do, the yields with no condition at all, so a node never runs dry.
 */
export function yieldsFor(def: NodeDef, state: SimState): readonly YieldDef[] {
  const phase = dayPhase(state.worldTick);
  const season = seasonOf(state.worldTick);
  const weather = currentWeather(state);
  const open = def.yields.filter(
    (y) =>
      (!y.phases || y.phases.includes(phase)) &&
      (!y.seasons || y.seasons.includes(season)) &&
      (!y.weather || y.weather.includes(weather)),
  );
  if (open.length > 0) return open;
  return def.yields.filter((y) => !y.phases && !y.seasons && !y.weather);
}

/** True when the node is ready to work. Respawn counts in world ticks, so it runs while closed. */
export function nodeReady(state: SimState, id: EntityId): boolean {
  const n = getComp(state.entities, id, 'node');
  return !!n && state.worldTick >= n.readyAt;
}

/** The sweep and yield penalty of a gather in progress, from the node and the tool it picked. */
export function gatherSweep(
  state: SimState,
  who: EntityId,
): { sweep: SweepDef; penalty: number; def: NodeDef } | null {
  const g = getComp(state.entities, who, 'gather');
  const node = g ? getComp(state.entities, g.node, 'node') : null;
  const def = node ? NODES[node.kind] : undefined;
  if (!g || !def) return null;
  const inv = getComp(state.entities, who, 'inventory');
  const stack = g.tool >= 0 ? inv?.slots[g.tool] : null;
  const tier = (stack ? ITEMS[stack.item]?.tool?.tier : undefined) ?? 0;
  return { ...sweepFor(def, tier), def };
}

/** Starts working a ready node. Picks the best tool in the bag and, for a rod, casts. */
export function startGather(state: SimState, who: EntityId, target: EntityId): boolean {
  const node = getComp(state.entities, target, 'node');
  const def = node ? NODES[node.kind] : undefined;
  const inv = getComp(state.entities, who, 'inventory');
  if (!node || !def || !inv || !nodeReady(state, target)) return false;
  const tool = def.tool ? bestTool(inv, def.tool) : null;
  const wait = def.fishing ? int(state.rng.world, B.gather.fishWaitMin, B.gather.fishWaitMax) : 0;
  setComp(state.entities, who, 'gather', {
    node: target,
    t: 0,
    swing: 0,
    hits: 0,
    tool: tool?.slot ?? -1,
    wait,
  });
  emit(state.events, { type: 'gatherStarted', id: who, node: target });
  return true;
}

/** The second press of the context button: lands a sweep or taps the bite. */
export function pressGather(state: SimState, who: EntityId): void {
  const g = getComp(state.entities, who, 'gather');
  const s = gatherSweep(state, who);
  if (!g || !s) return;
  if (s.def.fishing) {
    // Before the bite a press does nothing: there is nothing to land yet.
    if (g.t >= g.wait && g.t < g.wait + B.gather.fishBiteTicks) finishSweep(state, who, true);
    return;
  }
  finishSweep(state, who, g.t >= s.sweep.sweetFrom && g.t <= s.sweep.sweetTo);
}

/** One tick of a gather in progress. Runs the sweep out, or the wait for a bite. */
export function tickGather(state: SimState, who: EntityId): void {
  const g = getComp(state.entities, who, 'gather');
  const s = gatherSweep(state, who);
  if (!g || !s) return;
  g.t++;
  if (s.def.fishing) {
    if (g.t === g.wait) emit(state.events, { type: 'gatherBite', id: who, node: g.node });
    // A bite let go still lands the common catch.
    if (g.t >= g.wait + B.gather.fishBiteTicks) finishSweep(state, who, false);
    return;
  }
  // Running out the sweep still yields, with no bonus.
  if (g.t >= s.sweep.ticks) finishSweep(state, who, false);
}

/** Ends one sweep. A node with more sweeps starts the next, and the last one pays out. */
function finishSweep(state: SimState, who: EntityId, sweet: boolean): void {
  const g = getComp(state.entities, who, 'gather');
  const s = gatherSweep(state, who);
  if (!g || !s) return;
  if (g.swing + 1 < s.sweep.swings) {
    g.hits += sweet ? 1 : 0;
    g.swing++;
    g.t = 0;
    emit(state.events, { type: 'gatherSwing', id: who, node: g.node, sweet });
    return;
  }
  resolveGather(state, who, g.hits + (sweet ? 1 : 0));
}

/** Ends a gather: picks the yield, pays it, wears the tool, and starts the node's respawn. */
export function resolveGather(state: SimState, who: EntityId, hits: number): void {
  const g = getComp(state.entities, who, 'gather');
  const s = gatherSweep(state, who);
  const node = g ? getComp(state.entities, g.node, 'node') : null;
  state.entities.comps.gather[who] = null;
  if (!g || !s || !node) return;
  const { def, sweep, penalty } = s;
  const item = weighted(
    state.rng.loot,
    yieldsFor(def, state).map((y) => [y.item, y.weight] as const),
  );
  const base = Math.max(1, int(state.rng.loot, sweep.baseMin, sweep.baseMax) - penalty);
  const qty = base + hits * sweep.sweetBonus;
  // A sweet hit can lift the catch to Fine, more often with skill.
  let q: 0 | 1 = 0;
  if (hits > 0 && ITEMS[item]?.quality) {
    const pct = Math.min(100, pointsOf(state, who, `skill.${def.tag}`) * B.gather.finePctPerPoint);
    if (pct > 0 && int(state.rng.loot, 0, 99) < pct) q = 1;
  }
  node.readyAt = state.worldTick + def.respawn;
  emit(state.events, { type: 'gatherResolved', id: who, node: g.node, sweet: hits > 0, item, qty });
  give(state, who, item, qty, 'gather', q ? { q } : {});
  if (g.tool >= 0) useTool(state, who, g.tool);
  emit(state.events, { type: 'gathered', id: who, tag: def.tag, item, tier: def.tier });
}
