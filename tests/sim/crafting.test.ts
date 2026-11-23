import { describe, expect, it } from 'vitest';
import { CRAFTING as C } from '../../src/content/balance/crafting';
import { ITEMS } from '../../src/content/items';
import { RECIPES, expand } from '../../src/content/items/recipes';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { gradeStep, rollQuality, unitsOf, type ActingSource } from '../../src/sim/crafting';
import { give, learnRecipe, spawnCampPot } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import { validateCommand } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createStream } from '../../src/sim/kernel/rng';
import { offerTrial, trialPassed } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { deliverTrials } from '../../src/sim/systems/trials';

const OPEN = { solidAt: (): number => 0 };

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...cmds: Command[]) => void;
  run: (n: number) => void;
}

/** An avatar at tile (20, 20) with the station of `kind` one tile south, facing it. */
function rig(kind: 'anvil' | 'bench' | 'pot', seed = 7): Rig {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  const r: Rig = {
    s,
    me,
    events: [],
    tick: (...cmds) => {
      stepWorld(s, me, { commands: cmds });
      r.events.push(...s.events.list);
    },
    run: (n) => {
      for (let i = 0; i < n; i++) r.tick();
    },
  };
  r.tick({ type: 'scheme', scheme: 'classic' });
  if (kind === 'pot') {
    const p = s.entities.comps.pos[me]!;
    spawnCampPot(s, Math.round(p.x / 256), Math.round(p.y / 256) + 10);
  } else spawnFixture(s, kind === 'anvil' ? 'fixture.anvil' : 'fixture.workbench', 20, 21);
  // Face south, towards the station.
  r.tick({ type: 'move', dir: 4 });
  r.tick({ type: 'move', dir: null });
  r.run(6);
  r.events.length = 0;
  return r;
}

const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const bag = (r: Rig) => r.s.entities.comps.inventory[r.me]!;
const count = (r: Rig, item: string): number =>
  bag(r)
    .slots.filter((x) => x?.item === item)
    .reduce((n, x) => n + x!.qty, 0);
const stash = (r: Rig, item: string, qty = 1, q = 0): void =>
  give(r.s, r.me, item, qty, 'start', q ? { q: q as 1 | 2 | 3 } : {});

/** Stocks the bag for a recipe and crafts it, tapping each target on its tick. Returns the event. */
function craft(r: Rig, id: string, tapAt: readonly number[] | null) {
  const rec = RECIPES[id]!;
  const units = unitsOf(rec);
  for (const u of new Set(units)) {
    const need = units.filter((x) => x === u).length;
    const have = count(r, u);
    if (have < need) stash(r, u, need - have);
  }
  r.events.length = 0;
  r.tick({ type: 'craft', items: units });
  expect(ofType(r.events, 'craftStarted')).toHaveLength(1);
  const start = r.s.entities.comps.craft[r.me]!.start;
  while (r.s.entities.comps.craft[r.me]) {
    const t = r.s.tick + 1 - start;
    if (tapAt?.includes(t)) r.tick({ type: 'craftStep' });
    else r.tick();
    if (r.s.tick - start > 200) throw new Error('craft never ended');
  }
  return ofType(r.events, 'crafted')[0]!;
}

/** Tap ticks that land every target exactly. */
const PERFECT = {
  timing: C.step.timing.targets,
  rhythm: C.step.rhythm.targets,
} as const;

describe('the manual step is graded by the sim from tap ticks', () => {
  it('perfect, good and miss taps on the timing step add up to 0..30', () => {
    const t = C.step.timing;
    expect(gradeStep('timing', [...t.targets])).toBe(30);
    expect(
      gradeStep(
        'timing',
        t.targets.map((x) => x + t.perfect + 1),
      ),
    ).toBe(15);
    expect(
      gradeStep(
        'timing',
        t.targets.map((x) => x + t.good + 1),
      ),
    ).toBe(0);
    expect(gradeStep('timing', [t.targets[0]!])).toBe(10);
    expect(gradeStep('timing', [])).toBe(0);
    // Two perfect, one good.
    expect(gradeStep('timing', [t.targets[0]!, t.targets[1]!, t.targets[2]! + 4])).toBe(25);
  });
  it('rhythm has four beats and scales to the same 30', () => {
    const t = C.step.rhythm;
    expect(t.targets).toHaveLength(4);
    expect(gradeStep('rhythm', [...t.targets])).toBe(30);
    expect(
      gradeStep(
        'rhythm',
        t.targets.map((x) => x + t.perfect + 1),
      ),
    ).toBe(15);
    expect(gradeStep('rhythm', [])).toBe(0);
    expect(gradeStep('trace', [1, 2, 3])).toBe(0);
  });
  it('the sim records the tick of each craftStep itself, once per target, and ends the step', () => {
    const r = rig('anvil');
    const e = craft(r, 'recipe.copper_ingot', [...PERFECT.timing]);
    expect(ofType(r.events, 'craftTap')).toHaveLength(3);
    expect(e.item).toBe('item.copper_ingot');
    // A fourth tap, or a tap with nothing under way, does nothing.
    r.tick({ type: 'craftStep' });
    expect(ofType(r.events, 'craftTap')).toHaveLength(3);
    expect(r.s.entities.comps.craft[r.me]).toBeNull();
  });
  it('with no taps the step runs out after the last target and its grace', () => {
    const r = rig('anvil');
    const start = r.s.tick + 1;
    craft(r, 'recipe.copper_ingot', null);
    const last = C.step.timing.targets.at(-1)!;
    expect(r.s.tick - start).toBeGreaterThan(last);
    expect(r.s.tick - start).toBeLessThanOrEqual(last + C.step.endGrace + 2);
  });
  it('the context key is the tap during a craft, and one hand is enough', () => {
    const r = rig('anvil');
    for (const u of unitsOf(RECIPES['recipe.copper_ingot']!)) stash(r, u);
    r.tick({ type: 'craft', items: unitsOf(RECIPES['recipe.copper_ingot']!) });
    r.tick({ type: 'interact' });
    expect(ofType(r.events, 'craftTap')).toHaveLength(1);
  });
  it('the commands validate', () => {
    expect(validateCommand({ type: 'craft', items: ['item.copper_ore', 'item.coal'] }).ok).toBe(
      true,
    );
    expect(validateCommand({ type: 'craft', items: [] }).ok).toBe(false);
    expect(
      validateCommand({ type: 'craft', items: ['item.a', 'item.b', 'item.c', 'item.d', 'item.e'] })
        .ok,
    ).toBe(false);
    expect(validateCommand({ type: 'craftStep' }).ok).toBe(true);
    expect(validateCommand({ type: 'repair', slot: 2 }).ok).toBe(true);
    expect(validateCommand({ type: 'repair', slot: -1 }).ok).toBe(false);
  });
});

describe('quality roll', () => {
  const N = 10_000;
  const shares = (o: {
    skill: number;
    tier: number;
    matAvg: number;
    grade: number;
    source?: ActingSource;
  }): number[] => {
    const rng = createStream(12345, 'craft');
    const n = [0, 0, 0, 0];
    for (let i = 0; i < N; i++)
      n[
        rollQuality(rng, {
          skillPts: o.skill,
          tier: o.tier,
          matSum: o.matAvg * 4,
          matN: 4,
          grade: o.grade,
          source: o.source ?? 'manual',
        })
      ]!++;
    return n.map((x) => x / N);
  };
  const fine = (s: number[]): number => s[1]! + s[2]! + s[3]!;

  it('10,000 rolls at three skill levels and three material qualities: every input moves it the right way', () => {
    const bySkill = [0, 15, 30].map((skill) => shares({ skill, tier: 2, matAvg: 1, grade: 15 }));
    const byMat = [0, 1, 2].map((matAvg) => shares({ skill: 15, tier: 2, matAvg, grade: 15 }));
    const byGrade = [0, 15, 30].map((grade) => shares({ skill: 15, tier: 2, matAvg: 1, grade }));
    for (const set of [bySkill, byMat, byGrade]) {
      expect(fine(set[1]!)).toBeGreaterThan(fine(set[0]!));
      expect(fine(set[2]!)).toBeGreaterThan(fine(set[1]!));
      // Common falls as each input rises.
      expect(set[1]![0]!).toBeLessThan(set[0]![0]!);
      expect(set[2]![0]!).toBeLessThan(set[1]![0]!);
    }
    // Masterwork only shows at the top.
    expect(bySkill[0]![3]!).toBeLessThan(bySkill[2]![3]!);
  });

  it('skill above par stops counting at 15 points, and below at minus 15', () => {
    const a = shares({ skill: 30, tier: 2, matAvg: 1, grade: 15 });
    const b = shares({ skill: 80, tier: 2, matAvg: 1, grade: 15 });
    expect(b).toEqual(a);
    const c = shares({ skill: 0, tier: 5, matAvg: 1, grade: 15 });
    const d = shares({ skill: 0, tier: 8, matAvg: 1, grade: 15 });
    expect(d).toEqual(c);
  });

  it('a routine source never rolls Masterwork across 10,000 rolls, a manual one does', () => {
    const top = { skill: 100, tier: 2, matAvg: 3, grade: 30 };
    const manual = shares({ ...top, source: 'manual' });
    const routine = shares({ ...top, source: 'routine' });
    expect(manual[3]).toBeGreaterThan(0.3);
    expect(routine[3]).toBe(0);
    // What would have been Masterwork stops at Superior.
    expect(routine[2]).toBeCloseTo(manual[2]! + manual[3]!, 10);
  });

  it('ingredients with no quality do not count against the average', () => {
    const rng1 = createStream(5, 'craft');
    const rng2 = createStream(5, 'craft');
    const a = rollQuality(rng1, {
      skillPts: 15,
      tier: 2,
      matSum: 0,
      matN: 0,
      grade: 15,
      source: 'manual',
    });
    const b = rollQuality(rng2, {
      skillPts: 15,
      tier: 2,
      matSum: 0,
      matN: 0,
      grade: 15,
      source: 'manual',
    });
    expect(a).toBe(b);
  });
});

describe('experimenting', () => {
  it('an unknown valid combination is discovered once and crafts, and the second time it just crafts', () => {
    const r = rig('anvil');
    const id = 'recipe.sword_steel';
    expect(bag(r).recipes).not.toContain(id);
    const units = unitsOf(RECIPES[id]!);
    for (const u of units) stash(r, u);
    r.tick({ type: 'craft', items: units });
    while (r.s.entities.comps.craft[r.me]) r.tick();
    expect(ofType(r.events, 'recipeDiscovered')).toEqual([
      { type: 'recipeDiscovered', id: r.me, recipe: id },
    ]);
    expect(bag(r).recipes).toContain(id);
    expect(count(r, 'item.sword_steel')).toBe(1);
    for (const u of units) stash(r, u);
    r.tick({ type: 'craft', items: units });
    while (r.s.entities.comps.craft[r.me]) r.tick();
    expect(ofType(r.events, 'recipeDiscovered')).toHaveLength(1);
    expect(count(r, 'item.sword_steel')).toBe(2);
  });
  it("no match gives the craft's fail item and takes the ingredients: slag, wood scraps, burnt mess", () => {
    for (const [kind, fail] of [
      ['anvil', 'item.slag'],
      ['bench', 'item.wood_scraps'],
      ['pot', 'item.burnt_mess'],
    ] as const) {
      const r = rig(kind);
      stash(r, 'item.clay', 2);
      r.tick({ type: 'craft', items: ['item.clay', 'item.clay'] });
      expect(ofType(r.events, 'craftFailed'), kind).toHaveLength(1);
      expect(count(r, fail), kind).toBe(1);
      expect(count(r, 'item.clay'), kind).toBe(0);
      expect(r.s.entities.comps.craft[r.me]).toBeNull();
    }
  });
  it('a recipe of another craft is a failure here: a sword at the pot', () => {
    const r = rig('pot');
    const units = unitsOf(RECIPES['recipe.sword_iron']!);
    for (const u of units) stash(r, u);
    r.tick({ type: 'craft', items: units });
    expect(count(r, 'item.sword_iron')).toBe(0);
    expect(count(r, 'item.burnt_mess')).toBe(1);
  });
  it('needs a station in front and the ingredients, and takes nothing otherwise', () => {
    const r = rig('anvil');
    stash(r, 'item.copper_ore', 1);
    r.tick({ type: 'craft', items: ['item.copper_ore', 'item.copper_ore', 'item.coal'] });
    expect(count(r, 'item.copper_ore')).toBe(1);
    expect(r.s.entities.comps.craft[r.me]).toBeNull();
    // Five units is too many.
    r.tick({ type: 'craft', items: Array(5).fill('item.copper_ore') });
    expect(count(r, 'item.copper_ore')).toBe(1);
  });
  it('the start recipes are known from the first day, and the others are not', () => {
    const r = rig('anvil');
    const start = Object.values(RECIPES).filter((x) => x.learn === 'start');
    expect(start).toHaveLength(24);
    for (const x of start) expect(bag(r).recipes).toContain(x.id);
    expect(bag(r).recipes).not.toContain('recipe.sword_iron');
    expect(learnRecipe(r.s, r.me, 'recipe.sword_iron')).toBe(true);
    expect(learnRecipe(r.s, r.me, 'recipe.sword_iron')).toBe(false);
  });
  // M3-12 added the gear and cloth recipes nothing made before: 7 smithing, 2 woodworking.
  it('there are 53 recipes: 23 smithing, 15 woodworking, 15 cooking', () => {
    const by = (c: string): number => Object.values(RECIPES).filter((x) => x.craft === c).length;
    expect([by('smithing'), by('woodworking'), by('cooking')]).toEqual([23, 16, 15]);
    for (const x of Object.values(RECIPES))
      expect(expand(x.ingredients).length, x.id).toBeLessThanOrEqual(C.maxIngredients);
  });
});

describe('what a craft makes', () => {
  it("gear and tools carry the maker's mark, materials do not, and the ledger counts both", () => {
    const r = rig('anvil');
    craft(r, 'recipe.copper_ingot', [...PERFECT.timing]);
    for (const u of ['item.copper_ingot', 'item.copper_ingot', 'item.oak_plank'])
      if (count(r, u) < 2) stash(r, u, 2);
    craft(r, 'recipe.pick_copper', [...PERFECT.timing]);
    const pick = bag(r).slots.find((x) => x?.item === 'item.pick_copper')!;
    expect(pick.mark).toBe(1);
    expect(pick.dur).toBe(ITEMS['item.pick_copper']!.durability);
    const ingot = bag(r).slots.find((x) => x?.item === 'item.copper_ingot');
    expect(ingot?.mark).toBeUndefined();
    expect(r.s.ledger.marked['item.pick_copper']).toBe(1);
    expect(r.s.ledger.marked['item.copper_ingot']).toBeUndefined();
    expect(r.s.ledger.crafts['recipe.pick_copper']).toBe(1);
    expect(r.s.ledger.itemsMade.craft?.['item.pick_copper']).toBe(1);
  });
  it('a recipe with a quantity makes that many: two planks from two logs', () => {
    const r = rig('bench');
    const e = craft(r, 'recipe.oak_plank', [...PERFECT.timing]);
    expect(e.qty).toBe(2);
    expect(count(r, 'item.oak_plank')).toBe(2);
    expect(r.s.ledger.itemsMade.craft?.['item.oak_plank']).toBe(2);
  });
  it('an experiment with Fine materials rolls higher than Common ones over many crafts', () => {
    const avg = (q: number): number => {
      const r = rig('pot', 3);
      let sum = 0;
      for (let i = 0; i < 80; i++) {
        stash(r, 'item.sunwort', 1, q);
        stash(r, 'item.dewmint', 1, q);
        sum += craft(r, 'recipe.herb_tea', [...PERFECT.rhythm]).quality;
      }
      return sum / 80;
    };
    expect(avg(2)).toBeGreaterThan(avg(0));
  });
  it('a top craft makes a Masterwork, tallied in the ledger, and a Masterwork the ledger does not know is flagged', () => {
    const r = rig('anvil', 9);
    r.s.entities.comps.skills[r.me]!.points['skill.smithing'] = 100;
    let got = false;
    for (let i = 0; i < 40 && !got; i++) {
      const e = craft(r, 'recipe.copper_ingot', [...PERFECT.timing]);
      got = e.quality === 3;
    }
    expect(got).toBe(true);
    const held = bag(r).slots.find((x) => x?.item === 'item.copper_ingot' && x.q === 3)!;
    expect(held).toBeDefined();
    expect(r.s.ledger.masterworks['item.copper_ingot']).toBeGreaterThanOrEqual(held.qty);
  });
});

describe('repair at the anvil', () => {
  it('costs one material of the tier, restores a share of the durability, and pays Smithing', () => {
    const r = rig('anvil');
    stash(r, 'item.pick_copper');
    const slot = bag(r).slots.findIndex((x) => x?.item === 'item.pick_copper');
    const max = ITEMS['item.pick_copper']!.durability!;
    bag(r).slots[slot]!.dur = 10;
    stash(r, 'item.copper_ingot');
    const xp0 = r.s.entities.comps.skills[r.me]!.xp['skill.smithing'] ?? 0;
    r.tick({ type: 'repair', slot });
    expect(bag(r).slots[slot]!.dur).toBe(Math.min(max, 10 + Math.ceil((max * C.repairPct) / 100)));
    expect(count(r, 'item.copper_ingot')).toBe(0);
    expect(ofType(r.events, 'repaired')).toHaveLength(1);
    const sk = r.s.entities.comps.skills[r.me]!;
    expect((sk.xp['skill.smithing'] ?? 0) + (sk.points['skill.smithing'] ?? 0)).toBeGreaterThan(
      xp0,
    );
  });
  it('refuses with no material, at full durability, or away from an anvil', () => {
    const r = rig('anvil');
    stash(r, 'item.pick_copper');
    const slot = bag(r).slots.findIndex((x) => x?.item === 'item.pick_copper');
    r.tick({ type: 'repair', slot });
    expect(ofType(r.events, 'repaired')).toHaveLength(0);
    bag(r).slots[slot]!.dur = 5;
    r.tick({ type: 'repair', slot });
    expect(ofType(r.events, 'repaired')).toHaveLength(0);
    stash(r, 'item.copper_ingot');
    const pot = rig('pot');
    stash(pot, 'item.pick_copper');
    stash(pot, 'item.copper_ingot');
    const ps = bag(pot).slots.findIndex((x) => x?.item === 'item.pick_copper');
    bag(pot).slots[ps]!.dur = 5;
    pot.tick({ type: 'repair', slot: ps });
    expect(ofType(pot.events, 'repaired')).toHaveLength(0);
    r.tick({ type: 'repair', slot });
    expect(ofType(r.events, 'repaired')).toHaveLength(1);
    r.events.length = 0;
    bag(r).slots[slot]!.dur = ITEMS['item.pick_copper']!.durability!;
    stash(r, 'item.copper_ingot');
    r.tick({ type: 'repair', slot });
    expect(ofType(r.events, 'repaired')).toHaveLength(0);
  });
});

describe('the two Trials, in scripted runs through the crafting engine', () => {
  it('smithing: an iron sword at Fine or better, made at the anvil', () => {
    const r = rig('anvil', 21);
    expect(offerTrial(r.s, r.me, 'trial.smithing.15')).toBe(true);
    learnRecipe(r.s, r.me, 'recipe.sword_iron');
    r.s.entities.comps.skills[r.me]!.points['skill.smithing'] = 14;
    const done = (): boolean => trialPassed(r.s.entities.comps.skills[r.me]!, 'skill.smithing', 15);
    let tries = 0;
    while (!done() && tries < 60) {
      craft(r, 'recipe.sword_iron', [...PERFECT.timing]);
      tries++;
    }
    expect(done()).toBe(true);
  });
  it('cooking: a Hearty Stew at Fine or better, handed to Hesper', () => {
    const r = rig('pot', 22);
    expect(offerTrial(r.s, r.me, 'trial.cooking.15')).toBe(true);
    r.s.entities.comps.skills[r.me]!.points['skill.cooking'] = 14;
    let fine = false;
    for (let i = 0; i < 60 && !fine; i++) {
      const e = craft(r, 'recipe.hearty_stew', [...PERFECT.rhythm]);
      fine = e.quality >= 1;
    }
    expect(fine).toBe(true);
    deliverTrials(r.s, r.me, 'npc.cook');
    expect(trialPassed(r.s.entities.comps.skills[r.me]!, 'skill.cooking', 15)).toBe(true);
  });
});
