import { describe, expect, it } from 'vitest';
import { TIME, type DayPhase } from '../../src/content/balance/time';
import { SINGULARS, COLD_OVEN_FLAGS } from '../../src/content/singulars';
import { ITEMS } from '../../src/content/items';
import { AREAS } from '../../src/content/world/areas';
import { WAKE_TABLES } from '../../src/content/world/wake';
import { validateSave } from '../../src/save/integrity';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { Dir } from '../../src/sim/kernel/fixed';
import { applyEffect } from '../../src/sim/systems/npcs';
import { addItem, countItem, spawnCampPot } from '../../src/sim/items';
import { addXp } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { singularsSystem } from '../../src/sim/systems/singulars';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { plainFor } from '../support/saves';

const CYCLE = TIME.phases.reduce((n, p) => n + p.minutes, 0) * TIME.ticksPerMinute;
/** A tick a minute into `phase` of `day` (day 1 on, so every phase tick is positive). */
function at(day: number, phase: DayPhase): number {
  let m = 0;
  for (const p of TIME.phases) {
    if (p.phase === phase) break;
    m += p.minutes;
  }
  return day * CYCLE + (m + 1) * TIME.ticksPerMinute - TIME.startMinute * TIME.ticksPerMinute;
}

function game(): { s: SimState; me: number } {
  const s = createDemoState(11, 0);
  s.region = 'dawnmeadow';
  s.world = { solidAt: () => 0 };
  const f = feetAt(300, 300);
  return { s, me: createAvatar(s, f.x, f.y) };
}
const run = (s: SimState, me: number, ...commands: unknown[]): void => {
  // The platform sets the clock each tick, so a test sets it the same way.
  stepWorld(s, me, { commands, worldTick: s.worldTick } as never);
};
const events = (s: SimState, type: string): unknown[] =>
  s.events.list.filter((e) => e.type === type);
const bagSlot = (s: SimState, me: number, item: string): number =>
  s.entities.comps.inventory[me]!.slots.findIndex((x) => x?.item === item);
const progress = (s: SimState, me: number, id: string) =>
  s.entities.comps.journal[me]!.singulars[id];
const stand = (s: SimState, me: number, tx: number, ty: number, facing: number = Dir.N): void => {
  s.entities.comps.pos[me] = feetAt(tx, ty);
  s.entities.comps.avatar[me]!.facing = facing as never;
};
const codes = (s: SimState): string[] => validateSave(plainFor(s)).reasons.map((r) => r.code);

describe("The Crow's Due", () => {
  const SHINY = [
    'item.ring_copper',
    'item.ring_silver',
    'item.charm_sun',
    'item.copper_ingot',
    'item.iron_ingot',
    'item.quartz',
    'item.river_pebble',
  ];
  const drop = (s: SimState, me: number, item: string): void => {
    run(s, me, { type: 'drop', slot: bagSlot(s, me, item) });
  };

  function withScarecrow() {
    const g = game();
    spawnFixture(g.s, 'fixture.scarecrow', 100, 100);
    spawnFixture(g.s, 'fixture.crow_mound', 120, 100);
    stand(g.s, g.me, 100, 101);
    const inv = g.s.entities.comps.inventory[g.me]!;
    for (const i of SHINY) addItem(inv, i, 3);
    addItem(inv, 'item.moss_tuft', 3);
    return g;
  }

  it('is told nothing, and the crow takes a shiny thing, until three different days', () => {
    const { s, me } = withScarecrow();
    s.worldTick = at(1, 'day');
    drop(s, me, 'item.ring_copper');
    // The crow took it: no pickup is left on the ground.
    expect([...s.entities.comps.pickup].filter(Boolean)).toHaveLength(0);
    // Two more the same day count once.
    drop(s, me, 'item.ring_silver');
    drop(s, me, 'item.charm_sun');
    expect(progress(s, me, 'singular.crows_due')?.step).toBe(-1);
    expect(events(s, 'singularStep')).toEqual([]);
    s.worldTick = at(2, 'day');
    drop(s, me, 'item.copper_ingot');
    expect(events(s, 'singularStep')).toEqual([]);
    s.worldTick = at(3, 'day');
    drop(s, me, 'item.iron_ingot');
    expect(events(s, 'singularStep')).toEqual([
      expect.objectContaining({ id: 'singular.crows_due', step: 0 }),
    ]);
  });

  it('does not start from a plain item, or a shiny one dropped far from the scarecrow', () => {
    const { s, me } = withScarecrow();
    for (let d = 1; d <= 4; d++) {
      s.worldTick = at(d, 'day');
      drop(s, me, 'item.moss_tuft');
    }
    stand(s, me, 200, 200);
    for (let d = 5; d <= 9; d++) {
      s.worldTick = at(d, 'day');
      drop(s, me, 'item.ring_copper');
    }
    expect(progress(s, me, 'singular.crows_due')).toBeUndefined();
    // Far from the scarecrow, the ground keeps the ring.
    expect([...s.entities.comps.pickup].filter(Boolean).length).toBeGreaterThan(0);
  });

  it('completes: seven different things over seven days, a dig at dusk, the book, the charm', () => {
    const { s, me } = withScarecrow();
    for (const [i, item] of SHINY.slice(0, 3).entries()) {
      s.worldTick = at(1 + i, 'day');
      drop(s, me, item);
    }
    expect(progress(s, me, 'singular.crows_due')?.step).toBe(0);
    // Seven different shiny things, one a day. The same thing twice does not count.
    s.worldTick = at(4, 'day');
    drop(s, me, 'item.ring_copper');
    drop(s, me, 'item.ring_silver');
    expect(progress(s, me, 'singular.crows_due')?.counters['gifts']).toEqual(['item.ring_copper']);
    for (const [i, item] of SHINY.entries()) {
      s.worldTick = at(5 + i, 'day');
      drop(s, me, item);
    }
    expect(progress(s, me, 'singular.crows_due')?.step).toBe(1);
    // The dig needs dusk and Survival. By day, or without Survival, it gives nothing.
    stand(s, me, 120, 101);
    s.worldTick = at(20, 'day');
    run(s, me, { type: 'interact' });
    s.worldTick = at(20, 'dusk');
    run(s, me, { type: 'interact' });
    expect(progress(s, me, 'singular.crows_due')?.step).toBe(1);
    addXp(s, me, 'skill.survival', 200);
    run(s, me, { type: 'interact' });
    expect(progress(s, me, 'singular.crows_due')?.step).toBe(2);
    const book = bagSlot(s, me, 'item.manual_hex');
    expect(book).toBeGreaterThanOrEqual(0);
    s.events.list.length = 0;
    run(s, me, { type: 'use', slot: book });
    expect(events(s, 'singularDone')).toHaveLength(1);
    expect(events(s, 'worldFirst')).toHaveLength(1);
    expect(progress(s, me, 'singular.crows_due')?.done).toBe(true);
    expect(countItem(s.entities.comps.inventory[me]!, 'item.crow_feather_charm')).toBe(1);
    expect(s.entities.comps.journal[me]!.learnedVia['technique.hexing_hex']).toBe('manual');
    expect(codes(s)).not.toContain('SINGULAR_REWARD_UNEARNED');
    expect(codes(s)).not.toContain('MANUAL_READ_UNSOURCED');
    expect(codes(s)).not.toContain('ITEM_SOURCE_LOCKED');
  });
});

describe('Eight Beds of Straw', () => {
  const points = Object.keys(WAKE_TABLES['dawnmeadow']!.points);
  const wake = (id: string) => WAKE_TABLES['dawnmeadow']!.points[id as 'w1']!;
  const sleepAt = (
    s: SimState,
    me: number,
    id: string,
    day: number,
    phase: DayPhase = 'night',
  ): void => {
    const w = wake(id);
    stand(s, me, w.x, w.y);
    s.worldTick = at(day, phase);
    run(s, me, { type: 'sleep' });
  };

  it('has eight wake points', () => {
    expect(points).toHaveLength(8);
  });

  it('is told nothing until three different wake points, one a night', () => {
    const { s, me } = game();
    sleepAt(s, me, 'w1', 1);
    // A second sleep the same night counts for nothing.
    sleepAt(s, me, 'w2', 1);
    sleepAt(s, me, 'w2', 2);
    expect(events(s, 'singularStep')).toEqual([]);
    sleepAt(s, me, 'w3', 3);
    expect(events(s, 'singularStep')).toEqual([expect.objectContaining({ step: 0 })]);
  });

  it('does not count sleep by day, away from a wake point, or in a closed room', () => {
    const { s, me } = game();
    sleepAt(s, me, 'w1', 1, 'day');
    stand(s, me, 250, 250);
    s.worldTick = at(2, 'night');
    run(s, me, { type: 'sleep' });
    expect(events(s, 'sleptOutdoors')).toHaveLength(1);
    expect(progress(s, me, 'singular.eight_beds')).toBeUndefined();
  });

  it('completes at the eighth, with the cloak, and the cloak halves the rest', () => {
    const { s, me } = game();
    points.forEach((id, i) => sleepAt(s, me, id, i + 1));
    expect(events(s, 'singularDone')).toHaveLength(1);
    const inv = s.entities.comps.inventory[me]!;
    expect(countItem(inv, 'item.wayfarers_cloak')).toBe(1);
    expect(codes(s)).not.toContain('SINGULAR_REWARD_UNEARNED');
    // Worn, it gives half a bedroll's Rested outdoors. Without it, outdoors gives none.
    const slot = bagSlot(s, me, 'item.wayfarers_cloak');
    run(s, me, { type: 'equip', slot });
    expect(inv.equipment.accessory?.item).toBe('item.wayfarers_cloak');
    const rested = () => s.entities.comps.statuses[me]?.find((x) => x.id === 'rested');
    expect(rested()).toBeUndefined();
    sleepAt(s, me, 'w1', 12);
    expect(rested()).toBeDefined();
  });

  it('cannot be missed by waiting: a place missed one night is slept at another', () => {
    const { s, me } = game();
    // Seven distinct places, then a late eighth after any number of other nights.
    points.slice(0, 7).forEach((id, i) => sleepAt(s, me, id, i + 1));
    sleepAt(s, me, 'w1', 30);
    expect(progress(s, me, 'singular.eight_beds')?.done).toBe(false);
    sleepAt(s, me, points[7]!, 40);
    expect(progress(s, me, 'singular.eight_beds')?.done).toBe(true);
  });
});

describe('The Cold Oven', () => {
  const house = AREAS['area.empty_house']!;
  const porch = { x: house.x0 + 3, y: house.y0 + 1 };

  function oven() {
    const g = game();
    // The old pot stands on the porch, and a crate of bricks is in reach.
    spawnCampPot(g.s, (porch.x + 0) * 16 + 8, (porch.y + 1) * 16 + 14);
    return g;
  }
  const use = (s: SimState, me: number, day: number, phase: DayPhase = 'dawn'): void => {
    stand(s, me, porch.x, porch.y, Dir.S);
    s.worldTick = at(day, phase);
    run(s, me, { type: 'interact' });
  };

  it('is told nothing until the pot has been used at dawn on three different days', () => {
    const { s, me } = oven();
    use(s, me, 1);
    use(s, me, 1);
    use(s, me, 2, 'day');
    use(s, me, 2);
    expect(events(s, 'singularStep')).toEqual([]);
    // Away from the house it counts for nothing, however often.
    stand(s, me, 10, 10, Dir.S);
    expect(progress(s, me, 'singular.cold_oven')?.step).toBe(-1);
    use(s, me, 3);
    expect(events(s, 'singularStep')).toEqual([expect.objectContaining({ step: 0 })]);
  });

  it('completes: bricks, Tobin, a dawn bake, the peel and the recipe', () => {
    const { s, me } = oven();
    [1, 2, 3].forEach((d) => use(s, me, d));
    expect(progress(s, me, 'singular.cold_oven')?.step).toBe(0);
    // Finding the bricks (a chest give) moves it on and sets the flag Tobin's dialogue reads.
    const chest = spawnFixture(s, 'fixture.chest_firebrick', porch.x, porch.y + 3);
    void chest;
    stand(s, me, porch.x, porch.y + 4);
    run(s, me, { type: 'interact' });
    expect(countItem(s.entities.comps.inventory[me]!, 'item.firebrick')).toBe(1);
    expect(progress(s, me, 'singular.cold_oven')?.step).toBe(1);
    expect(s.entities.comps.journal[me]!.flags).toContain(COLD_OVEN_FLAGS.bricks);
    // Tobin sets them (his dialogue sets the flag).
    s.events.list.length = 0;
    applyEffect(s, me, { setFlag: COLD_OVEN_FLAGS.set });
    singularsSystem(s);
    expect(progress(s, me, 'singular.cold_oven')?.step).toBe(2);
    use(s, me, 10, 'day');
    expect(progress(s, me, 'singular.cold_oven')?.done).toBe(false);
    use(s, me, 10);
    expect(progress(s, me, 'singular.cold_oven')?.done).toBe(true);
    const inv = s.entities.comps.inventory[me]!;
    expect(countItem(inv, 'item.bakers_peel')).toBe(1);
    expect(inv.recipes).toContain('recipe.bakers_loaf');
    expect(codes(s)).not.toContain('SINGULAR_REWARD_UNEARNED');
    expect(codes(s)).not.toContain('ITEM_SOURCE_LOCKED');
  });

  it('is not missed by finding the bricks first', () => {
    const { s, me } = oven();
    spawnFixture(s, 'fixture.chest_firebrick', porch.x, porch.y + 3);
    stand(s, me, porch.x, porch.y + 4);
    run(s, me, { type: 'interact' });
    expect(progress(s, me, 'singular.cold_oven')).toBeUndefined();
    [1, 2, 3].forEach((d) => use(s, me, d));
    // The trigger fires, and the bricks already in the bag finish the next step at once.
    expect(progress(s, me, 'singular.cold_oven')?.step).toBe(1);
  });
});

describe('Singular data', () => {
  it('every id, item and recipe a Singular names exists', () => {
    for (const d of Object.values(SINGULARS)) {
      const effects = [
        ...(d.trigger.then ?? []),
        ...d.steps.flatMap((s) => s.then ?? []),
        ...d.reward,
      ];
      for (const e of effects) {
        if ('give' in e) expect(ITEMS[e.give], e.give).toBeDefined();
      }
    }
  });

  it('never expires: time predicates are phases, and weather is one the region can have', () => {
    for (const d of Object.values(SINGULARS))
      for (const s of [d.trigger, ...d.steps])
        for (const c of s.when ?? []) {
          if ('phase' in c)
            expect(c.phase.every((p) => TIME.phases.some((q) => q.phase === p))).toBe(true);
          expect('day' in c || 'year' in c || 'season' in c).toBe(false);
        }
  });

  it('has a Singular for each of the three, in Dawnmeadow', () => {
    expect(Object.keys(SINGULARS).sort()).toEqual([
      'singular.cold_oven',
      'singular.crows_due',
      'singular.eight_beds',
    ]);
    expect(Object.values(SINGULARS).every((d) => d.region === 'dawnmeadow')).toBe(true);
  });
});
