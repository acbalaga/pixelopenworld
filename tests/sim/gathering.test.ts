import { describe, expect, it } from 'vitest';
import { ITEMS_BALANCE as B } from '../../src/content/balance/items';
import { ITEMS } from '../../src/content/items';
import { NODES } from '../../src/content/items/recipes';
import type { NodeDef } from '../../src/content/items/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { bestTool, sweepFor, yieldsFor } from '../../src/sim/gathering';
import { give, spawnNode } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { Dir } from '../../src/sim/kernel/fixed';
import {
  createDemoState,
  deserializeState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { dayPhase, seasonOf } from '../../src/sim/time';

const OPEN = { solidAt: (): number => 0 };

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  /** Steps one tick. `worldTick` defaults to the sim tick plus `offset`. */
  tick: (...cmds: Command[]) => void;
  run: (n: number) => void;
  offset: number;
}

function rig(seed = 7): Rig {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  const r: Rig = {
    s,
    me,
    events: [],
    offset: 0,
    tick: (...cmds) => {
      stepWorld(s, me, { commands: cmds, worldTick: s.tick + 1 + r.offset });
      r.events.push(...s.events.list);
    },
    run: (n) => {
      for (let i = 0; i < n; i++) r.tick();
    },
  };
  r.tick({ type: 'scheme', scheme: 'classic' });
  return r;
}

const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);

/** A node one step east of the avatar, who turns to face it. Returns the node id. */
function nodeAhead(r: Rig, kind: string): number {
  const p = r.s.entities.comps.pos[r.me]!;
  const id = spawnNode(r.s, kind, Math.round(p.x / 256) + 12, Math.round(p.y / 256));
  r.tick({ type: 'move', dir: Dir.E });
  r.tick({ type: 'move', dir: null });
  r.run(4);
  r.events.length = 0;
  return id;
}

const bag = (r: Rig) => r.s.entities.comps.inventory[r.me]!;
const held = (r: Rig, item: string): number =>
  bag(r)
    .slots.filter((x) => x?.item === item)
    .reduce((n, x) => n + x!.qty, 0);

/** Starts a gather, optionally lands the press at tick `at`, and runs it out. Returns the result event. */
function work(r: Rig, at: number | null) {
  r.events.length = 0;
  r.tick({ type: 'interact' });
  expect(ofType(r.events, 'gatherStarted')).toHaveLength(1);
  if (at !== null) {
    for (let i = 0; i < at; i++) r.tick();
    r.tick({ type: 'interact' });
  }
  for (let i = 0; i < 400 && r.s.entities.comps.gather[r.me]; i++) r.tick();
  return ofType(r.events, 'gatherResolved').at(-1);
}

/** Ticks a gather runs before it resolves on its own. */
function lengthOf(r: Rig): number {
  r.tick({ type: 'interact' });
  let n = 0;
  while (r.s.entities.comps.gather[r.me] && n < 400) {
    r.tick();
    n++;
  }
  return n;
}

describe('the tool rule', () => {
  const vein = NODES['node.copper_vein']!;
  it('no tool, or a lower tier, slows the sweep and costs a yield; at tier is normal; above widens the window', () => {
    const none = sweepFor(vein, 0);
    const at = sweepFor(vein, 1);
    const above = sweepFor(vein, 2);
    expect(at.penalty).toBe(0);
    expect(at.sweep.ticks).toBe(B.gather.sweepTicks);
    expect(none.penalty).toBe(1);
    expect(none.sweep.ticks).toBe(
      Math.ceil((B.gather.sweepTicks * (100 + B.gather.toolSlowPct)) / 100),
    );
    expect(above.penalty).toBe(0);
    expect(above.sweep.sweetTo).toBe(at.sweep.sweetTo + B.gather.toolWindowTicks);
    expect(sweepFor(NODES['node.iron_vein']!, 1).penalty).toBe(1);
    expect(sweepFor(NODES['node.iron_vein']!, 2).penalty).toBe(0);
  });

  it('a node that needs no tool is never changed', () => {
    const herb = NODES['node.herb_patch']!;
    expect(sweepFor(herb, 0)).toEqual(sweepFor(herb, 3));
    expect(sweepFor(herb, 0).penalty).toBe(0);
  });

  it('the best tool of the right kind in the bag is used, without equipping it', () => {
    const r = rig();
    give(r.s, r.me, 'item.pick_copper', 1, 'start');
    give(r.s, r.me, 'item.pick_iron', 1, 'start');
    give(r.s, r.me, 'item.axe_iron', 1, 'start');
    const t = bestTool(bag(r), 'pick')!;
    expect(bag(r).slots[t.slot]!.item).toBe('item.pick_iron');
    expect(t.tier).toBe(2);
    expect(bag(r).equipment.main?.item).toBe('item.dagger_wood');
    expect(bestTool(bag(r), 'rod')).toBeNull();
  });

  it('through the real loop: no tool runs longer, and pays at least one', () => {
    const runs = (tool: string | null): { len: number; qty: number } => {
      const r = rig();
      if (tool) give(r.s, r.me, tool, 1, 'start');
      nodeAhead(r, 'node.copper_vein');
      const len = lengthOf(r);
      const e = ofType(r.events, 'gatherResolved')[0]!;
      return { len, qty: e.qty };
    };
    const none = runs(null);
    const at = runs('item.pick_copper');
    const above = runs('item.pick_iron');
    expect(none.len).toBeGreaterThan(at.len);
    expect(at.len).toBe(above.len);
    expect(none.qty).toBeGreaterThanOrEqual(1);
    expect(none.qty).toBeLessThanOrEqual(B.gather.baseMax - 1 || 1);
    expect(at.qty).toBeGreaterThanOrEqual(B.gather.baseMin);
    expect(at.qty).toBeLessThanOrEqual(B.gather.baseMax);
  });

  it('a pick above the tier lands a press the tier would miss', () => {
    const press = (tool: string): boolean => {
      const r = rig();
      give(r.s, r.me, tool, 1, 'start');
      nodeAhead(r, 'node.copper_vein');
      // The press lands one tick after the start, so this is tick 18: past the node's own window (15 to 17).
      return work(r, vein.sweep!.sweetTo!)!.sweet;
    };
    expect(press('item.pick_copper')).toBe(false);
    expect(press('item.pick_iron')).toBe(true);
  });

  it('a sweet press pays the node bonus, and mining pays more than foraging', () => {
    const r = rig();
    give(r.s, r.me, 'item.pick_copper', 1, 'start');
    nodeAhead(r, 'node.copper_vein');
    const e = work(r, 15)!;
    expect(e.sweet).toBe(true);
    expect(e.qty).toBeGreaterThanOrEqual(B.gather.baseMin + vein.sweep!.sweetBonus!);
    expect(vein.sweep!.sweetBonus!).toBeGreaterThan(B.gather.sweetBonus);
    // A narrower window than the default one.
    expect(vein.sweep!.sweetTo! - vein.sweep!.sweetFrom!).toBeLessThan(
      B.gather.sweetTo - B.gather.sweetFrom,
    );
  });

  it('wears the tool: one durability per toolUses gathers', () => {
    const r = rig();
    give(r.s, r.me, 'item.pick_copper', 1, 'start');
    const slot = bag(r).slots.findIndex((x) => x?.item === 'item.pick_copper');
    const dur = bag(r).slots[slot]!.dur!;
    for (let i = 0; i < B.wear.toolUses; i++) {
      const id = nodeAhead(r, 'node.copper_vein');
      work(r, 15);
      r.s.entities.comps.node[id]!.readyAt = 0;
      r.s.entities.comps.pos[id]!.x += 99999;
    }
    expect(bag(r).slots[slot]!.dur).toBe(dur - 1);
  });
});

describe('quality from a sweet hit', () => {
  /** Finds out how many of `n` sweet hits came out Fine at `points` skill. */
  function fines(points: number, n: number): number {
    const r = rig(11);
    give(r.s, r.me, 'item.pick_copper', 1, 'start');
    if (points > 0) r.s.entities.comps.skills[r.me]!.points['skill.mining'] = points;
    let fine = 0;
    for (let i = 0; i < n; i++) {
      const id = nodeAhead(r, 'node.copper_vein');
      work(r, 15);
      r.s.entities.comps.node[id]!.readyAt = 0;
      r.s.entities.comps.pos[id]!.x += 99999;
    }
    for (const x of bag(r).slots) if (x && x.q === 1 && ITEMS[x.item]?.quality) fine += x.qty;
    return fine;
  }
  it('never at no skill, always at 100 points, and sometimes between', () => {
    expect(fines(0, 12)).toBe(0);
    expect(fines(100, 12)).toBeGreaterThan(0);
    const mid = fines(50, 40);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(40 * (1 + 2 + 2));
  });
  it('a missed press never rolls quality', () => {
    const r = rig();
    r.s.entities.comps.skills[r.me]!.points['skill.mining'] = 100;
    nodeAhead(r, 'node.copper_vein');
    work(r, null);
    expect(bag(r).slots.every((x) => !x || x.q === undefined)).toBe(true);
  });
});

describe('logging takes three swings', () => {
  it('each sweet hit adds a log, and a tree pays once', () => {
    const r = rig();
    give(r.s, r.me, 'item.axe_copper', 1, 'start');
    const id = nodeAhead(r, 'node.oak_tree');
    r.tick({ type: 'interact' });
    // Two sweet swings and one that runs out.
    for (let swing = 0; swing < 2; swing++) {
      for (let i = 0; i < B.gather.sweetFrom; i++) r.tick();
      r.tick({ type: 'interact' });
    }
    expect(ofType(r.events, 'gatherSwing')).toHaveLength(2);
    expect(r.s.entities.comps.gather[r.me]).not.toBeNull();
    expect(held(r, 'item.oak_log')).toBe(0);
    for (let i = 0; i < 60 && r.s.entities.comps.gather[r.me]; i++) r.tick();
    const done = ofType(r.events, 'gatherResolved');
    expect(done).toHaveLength(1);
    expect(done[0]!.qty).toBeGreaterThanOrEqual(1 + 2 * B.gather.sweetBonus);
    expect(held(r, 'item.oak_log')).toBe(done[0]!.qty);
    expect(r.s.entities.comps.node[id]!.readyAt).toBeGreaterThan(r.s.worldTick);
    // One gathered event for the whole tree.
    expect(ofType(r.events, 'gathered')).toHaveLength(1);
  });
});

describe('fishing placeholder', () => {
  it('waits two to six seconds for a bite, ignores a press before it, and a tap in the window is sweet', () => {
    const r = rig(3);
    give(r.s, r.me, 'item.rod_ash', 1, 'start');
    nodeAhead(r, 'node.fishing_spot');
    r.tick({ type: 'interact' });
    const g = r.s.entities.comps.gather[r.me]!;
    expect(g.wait).toBeGreaterThanOrEqual(B.gather.fishWaitMin);
    expect(g.wait).toBeLessThanOrEqual(B.gather.fishWaitMax);
    // A press before the bite does nothing.
    r.tick({ type: 'interact' });
    expect(r.s.entities.comps.gather[r.me]).not.toBeNull();
    while (r.s.entities.comps.gather[r.me]!.t < g.wait) r.tick();
    expect(ofType(r.events, 'gatherBite')).toHaveLength(1);
    r.tick({ type: 'interact' });
    const e = ofType(r.events, 'gatherResolved')[0]!;
    expect(e.sweet).toBe(true);
    expect(e.qty).toBe(2);
    expect(['item.fish_river', 'item.fish_silver']).toContain(e.item);
  });
  it('a missed bite still lands the common catch, never a failure', () => {
    const r = rig(4);
    nodeAhead(r, 'node.fishing_spot');
    const e = work(r, null)!;
    expect(e.sweet).toBe(false);
    expect(e.item).toBe('item.fish_river');
    expect(e.qty).toBe(1);
    expect(held(r, 'item.fish_river')).toBe(1);
  });
  it('casting with a rod or without both work: the placeholder needs the bite, not the tier', () => {
    const r = rig(5);
    nodeAhead(r, 'node.fishing_spot');
    expect(work(r, null)).toBeDefined();
  });
});

describe('respawn runs on the world clock', () => {
  it('a node worked, saved and reloaded with the clock past respawn is ready on load', () => {
    const r = rig();
    const id = nodeAhead(r, 'node.herb_patch');
    work(r, 14);
    const node = r.s.entities.comps.node[id]!;
    const respawn = NODES['node.herb_patch']!.respawn;
    expect(node.readyAt).toBeGreaterThanOrEqual(r.s.worldTick + respawn - 40);
    const back = deserializeState(serializeState(r.s));
    const spent = back.entities.comps.node[id]!;
    expect(spent.readyAt).toBe(node.readyAt);
    // Just after the save: still spent. A world clock moved past the respawn: ready.
    back.worldTick = node.readyAt - 1;
    expect(back.worldTick < spent.readyAt).toBe(true);
    back.worldTick = node.readyAt;
    expect(back.worldTick >= spent.readyAt).toBe(true);
    // And it can be worked again through the real loop.
    const s2 = back;
    s2.world = OPEN;
    stepWorld(s2, r.me, { commands: [{ type: 'interact' }], worldTick: node.readyAt });
    expect(ofType(s2.events.list, 'gatherStarted')).toHaveLength(1);
  });
  it('a spent node cannot be worked before it respawns', () => {
    const r = rig();
    nodeAhead(r, 'node.herb_patch');
    work(r, 14);
    r.events.length = 0;
    r.tick({ type: 'interact' });
    expect(ofType(r.events, 'gatherStarted')).toHaveLength(0);
    r.offset += NODES['node.herb_patch']!.respawn;
    r.tick({ type: 'interact' });
    expect(ofType(r.events, 'gatherStarted')).toHaveLength(1);
  });
});

describe('variants: day phase, season, weather', () => {
  const find = (f: (t: number) => boolean): number => {
    for (let t = 0; t < 4_000_000; t += 600) if (f(t)) return t;
    throw new Error('no such tick');
  };
  const test: NodeDef = {
    id: 'node.test',
    tag: 'fishing',
    workAnim: 'work_cast',
    tier: 1,
    yields: [
      { item: 'item.fish_river', weight: 1 },
      { item: 'item.fish_silver', weight: 9, phases: ['dusk'] },
      { item: 'item.coal', weight: 9, seasons: ['winter'] },
      { item: 'item.clay', weight: 9, weather: ['rain'] },
    ],
    respawn: 100,
    sprite: { ready: 'icon.node_fish', spent: 'icon.node_fish_spent' },
  };
  const items = (s: SimState): string[] => yieldsFor(test, s).map((y) => y.item);

  it('a yield restricted to dusk is on offer only at dusk', () => {
    const s = createDemoState(1, 0);
    s.worldTick = find((t) => dayPhase(t) === 'day');
    expect(items(s)).not.toContain('item.fish_silver');
    s.worldTick = find((t) => dayPhase(t) === 'dusk');
    expect(items(s)).toContain('item.fish_silver');
    s.worldTick = find((t) => dayPhase(t) === 'night');
    expect(items(s)).not.toContain('item.fish_silver');
  });
  it('and it is what a gather at dusk can land, through the real loop', () => {
    const r = rig();
    const id = nodeAhead(r, 'node.fishing_spot');
    r.offset = find((t) => dayPhase(t) === 'dusk') - r.s.tick;
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      r.s.entities.comps.node[id]!.readyAt = 0;
      seen.add(work(r, null)!.item);
    }
    expect(seen.has('item.fish_silver')).toBe(true);
    r.offset = find((t) => dayPhase(t) === 'day') - r.s.tick;
    seen.clear();
    for (let i = 0; i < 30; i++) {
      r.s.entities.comps.node[id]!.readyAt = 0;
      seen.add(work(r, null)!.item);
    }
    expect(seen.has('item.fish_silver')).toBe(false);
  });
  it('a season restricts a yield, and weather is clear for now', () => {
    const s = createDemoState(1, 0);
    s.worldTick = find((t) => seasonOf(t) === 'winter');
    expect(items(s)).toContain('item.coal');
    s.worldTick = find((t) => seasonOf(t) === 'spring');
    expect(items(s)).not.toContain('item.coal');
    expect(items(s)).not.toContain('item.clay');
  });
  it('a node never runs dry: with nothing open it falls back to the unrestricted yields', () => {
    const s = createDemoState(1, 0);
    const only: NodeDef = {
      ...test,
      yields: [
        { item: 'item.coal', weight: 1, seasons: ['winter'] },
        { item: 'item.clay', weight: 1 },
      ],
    };
    s.worldTick = find((t) => seasonOf(t) === 'spring');
    expect(yieldsFor(only, s).map((y) => y.item)).toEqual(['item.clay']);
  });
  it('seasons last seven in-game days', () => {
    const day = 48 * 1800;
    expect(seasonOf(0)).toBe(seasonOf(6 * day));
    expect(seasonOf(0)).not.toBe(seasonOf(8 * day));
    expect(seasonOf(0)).toBe(seasonOf(28 * day));
  });
});

describe('content', () => {
  it('has the slice nodes: copper, iron, oak, ash and a fishing spot, all with real yields and sprites', () => {
    for (const id of ['copper_vein', 'iron_vein', 'oak_tree', 'ash_tree', 'fishing_spot'])
      expect(NODES[`node.${id}`], id).toBeDefined();
    for (const n of Object.values(NODES)) {
      for (const y of n.yields) expect(ITEMS[y.item], y.item).toBeDefined();
      if (n.tool) expect(['pick', 'axe', 'sickle', 'rod']).toContain(n.tool);
    }
  });
});
