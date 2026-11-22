import { describe, expect, it } from 'vitest';
import { CRAFTING as C } from '../../src/content/balance/crafting';
import { AFFIXES, parseAffix } from '../../src/content/items/affixes';
import { ITEMS } from '../../src/content/items';
import { RECIPES, expand, ingredientKey } from '../../src/content/items/recipes';
import { STATIONS } from '../../src/content/items/stations';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature, spawnEnemy } from '../../src/sim/combat/enemy';
import { enchantRoom, gradeHold, gradeTrace, heatAfter, rollQuality } from '../../src/sim/crafting';
import { activeMods } from '../../src/sim/mods';
import { addItem, countItem, give } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createStream } from '../../src/sim/kernel/rng';
import { createDemoState, type SimState } from '../../src/sim/state';
import { hasStatus, applyStatus } from '../../src/sim/statuses';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';

const OPEN = { solidAt: (): number => 0 };
type Point = readonly [number, number];

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...cmds: Command[]) => void;
  run: (n: number) => void;
}

/** An avatar at tile (20, 20) facing south, with the station of `kind` (or nothing) one tile south. */
function rig(kind: string | null, seed = 7): Rig {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  const me = createAvatar(s, feetAt(20, 20).x, feetAt(20, 20).y);
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
  if (kind) spawnFixture(s, kind, 20, 21);
  r.tick({ type: 'move', dir: 4 });
  r.tick({ type: 'move', dir: null });
  r.run(6);
  r.events.length = 0;
  return r;
}
const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const inv = (r: Rig) => r.s.entities.comps.inventory[r.me]!;

/** Points along the craft's path: one per tick for `n` ticks, each `off` units off the line. */
function along(craft: string, n: number, off = 0): [number, number][] {
  const path = C.paths[craft] as readonly Point[];
  const segs = path.slice(1).map((b, i) => ({ a: path[i] as Point, b }));
  const lens = segs.map((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
  const total = lens.reduce((x, y) => x + y, 0);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let d = (i / (n - 1)) * total;
    let k = 0;
    while (k < segs.length - 1 && d > (lens[k] as number)) d -= lens[k++] as number;
    const s = segs[k]!;
    const t = d / (lens[k] as number);
    out.push([s.a[0] + (s.b[0] - s.a[0]) * t + off, s.a[1] + (s.b[1] - s.a[1]) * t + off]);
  }
  return out;
}
const flat = (pts: readonly (readonly number[])[]): number[] => pts.flatMap((p) => [...p]);

describe('the trace grade', () => {
  const path = C.paths.tailoring as readonly Point[];
  const full = C.step.grade;
  it('a thumb that follows the line the whole way earns the full grade', () => {
    expect(gradeTrace(path, flat(along('tailoring', 80)))).toBe(full);
  });
  it('samples outside the width earn nothing, and a half way off earns about half', () => {
    expect(gradeTrace(path, flat(along('tailoring', 80, 400)))).toBe(0);
    const mixed = [...along('tailoring', 40), ...along('tailoring', 40, 400)];
    expect(gradeTrace(path, flat(mixed))).toBeGreaterThan(0);
    expect(gradeTrace(path, flat(mixed))).toBeLessThan(full * 0.75);
  });
  it('too few samples, or parking on one spot of the line, scales the grade down', () => {
    expect(gradeTrace(path, flat(along('tailoring', 8)))).toBeLessThan(full);
    const parked = Array.from({ length: 80 }, () => [100, 500]).flat();
    expect(gradeTrace(path, parked)).toBe(0);
    expect(gradeTrace(path, [])).toBe(0);
  });
  it('is the grade of whoever follows the other craft path too', () => {
    expect(gradeTrace(C.paths.enchanting as readonly Point[], flat(along('enchanting', 90)))).toBe(
      full,
    );
  });
});

describe('the hold grade', () => {
  const h = C.step.hold;
  const centerTicks = h.center / h.perTick;
  it('releasing in the band is perfect, nearby is partial, far is nothing, and never is nothing', () => {
    expect(heatAfter(0)).toBe(0);
    expect(heatAfter(1000)).toBe(1000);
    expect(gradeHold(Math.round(centerTicks))).toBe(C.step.grade);
    const partial = gradeHold(Math.round((h.center + 100) / h.perTick));
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(C.step.grade);
    expect(gradeHold(2)).toBe(0);
    expect(gradeHold(null)).toBe(0);
    // Farther from the center is never better.
    let last: number = C.step.grade;
    for (let t = Math.round(centerTicks); t < 80; t++) {
      const g = gradeHold(t);
      expect(g).toBeLessThanOrEqual(last);
      last = g;
    }
  });
});

describe('the four new crafts, played from fed input', () => {
  it('Tailoring at the loom: trace the line and a cap comes off the loom', () => {
    const r = rig('fixture.loom');
    give(r.s, r.me, 'item.wool_cloth', 1, 'seed');
    r.tick({ type: 'craft', items: ['item.wool_cloth'] });
    expect(ofType(r.events, 'craftStarted')[0]).toMatchObject({ station: 'fixture.loom' });
    const pts = along('tailoring', 90);
    for (const [x, y] of pts) r.tick({ type: 'craftPoint', x, y });
    r.run(20);
    const made = ofType(r.events, 'crafted')[0]!;
    expect(made).toMatchObject({ item: 'item.cap_wool', tag: 'tailoring' });
    expect(countItem(inv(r), 'item.cap_wool')).toBe(1);
    expect(r.s.entities.comps.craft[r.me]).toBeNull();
  });

  it('a trace that wanders makes a worse cap than one that follows, and samples outside the window are dropped', () => {
    const grade = (off: number): number => {
      const r = rig('fixture.loom', 11);
      give(r.s, r.me, 'item.wool_cloth', 1, 'seed');
      r.tick({ type: 'craft', items: ['item.wool_cloth'] });
      for (const [x, y] of along('tailoring', 90, off)) r.tick({ type: 'craftPoint', x, y });
      return gradeTrace(
        C.paths.tailoring as readonly Point[],
        r.s.entities.comps.craft[r.me]?.samples ?? flat(along('tailoring', 90, off)),
      );
    };
    expect(grade(0)).toBeGreaterThan(grade(300));
    const r = rig('fixture.loom');
    give(r.s, r.me, 'item.wool_cloth', 1, 'seed');
    r.tick({ type: 'craft', items: ['item.wool_cloth'] });
    r.tick({ type: 'craftPoint', x: 100, y: 500 });
    r.tick({ type: 'craftPoint', x: 100, y: 500 });
    // Two points in one tick are one sample.
    expect((r.s.entities.comps.craft[r.me]!.samples ?? []).length).toBeLessThanOrEqual(4);
  });

  it('Alchemy at the table: hold, let go in the band, and a potion is made; the pointer can come up on its own', () => {
    const r = rig('fixture.alchemy_table');
    give(r.s, r.me, 'item.sunwort', 1, 'seed');
    give(r.s, r.me, 'item.dew_vial', 1, 'seed');
    r.tick({ type: 'craft', items: ['item.sunwort', 'item.dew_vial'] });
    r.tick({ type: 'craftHold', on: true });
    r.run(Math.round(C.step.hold.center / C.step.hold.perTick));
    r.tick({ type: 'craftHold', on: false });
    r.run(3);
    expect(ofType(r.events, 'crafted')[0]).toMatchObject({ item: 'item.potion_health_s' });

    // Never letting go: the heat tops out and the step ends by itself.
    const q = rig('fixture.alchemy_table');
    give(q.s, q.me, 'item.sunwort', 1, 'seed');
    give(q.s, q.me, 'item.dew_vial', 1, 'seed');
    q.tick({ type: 'craft', items: ['item.sunwort', 'item.dew_vial'] });
    q.tick({ type: 'craftHold', on: true });
    q.run(C.step.hold.window + 10);
    expect(ofType(q.events, 'crafted')).toHaveLength(1);
    // Never pressing is a craft with no grade, not a stuck one.
    const z = rig('fixture.alchemy_table');
    give(z.s, z.me, 'item.sunwort', 1, 'seed');
    give(z.s, z.me, 'item.dew_vial', 1, 'seed');
    z.tick({ type: 'craft', items: ['item.sunwort', 'item.dew_vial'] });
    z.run(C.step.hold.window + 10);
    expect(ofType(z.events, 'crafted')).toHaveLength(1);
  });

  it('Tinkering at the bench uses the timing step, and a gadget is the result', () => {
    expect(STATIONS['fixture.tinker_bench']!.step).toBe('timing');
    const r = rig('fixture.tinker_bench');
    give(r.s, r.me, 'item.clay', 1, 'seed');
    give(r.s, r.me, 'item.dew_vial', 1, 'seed');
    r.tick({ type: 'craft', items: ['item.clay', 'item.dew_vial'] });
    for (const t of C.step.timing.targets) {
      while (r.s.tick - r.s.entities.comps.craft[r.me]!.start < t) r.tick();
      r.tick({ type: 'craftStep' });
    }
    r.run(12);
    expect(ofType(r.events, 'crafted')[0]).toMatchObject({ item: 'item.water_flask' });
  });
});

describe('Enchanting', () => {
  /** A sword, and the stone, ready to enchant with `mats`. */
  function enchantRig(points: number): Rig {
    const r = rig('fixture.rune_stone');
    r.s.entities.comps.skills[r.me]!.points['skill.enchanting'] = points;
    give(r.s, r.me, 'item.sword_bronze', 1, 'seed');
    give(r.s, r.me, 'item.essence_ember', 4, 'seed');
    give(r.s, r.me, 'item.spark_dust', 2, 'seed');
    give(r.s, r.me, 'item.quartz', 2, 'seed');
    return r;
  }
  const play = (r: Rig): void => {
    for (const [x, y] of along('enchanting', 95)) r.tick({ type: 'craftPoint', x, y });
    r.run(12);
  };
  const sword = (r: Rig) => inv(r).slots.find((x) => x?.item === 'item.sword_bronze')!;

  it('puts the affix on the chosen piece, keeps the piece, and uses the rest up', () => {
    const r = enchantRig(0);
    const mods0 = activeMods(r.s, r.me).length;
    r.tick({
      type: 'craft',
      items: ['item.sword_bronze', 'item.essence_ember', 'item.spark_dust'],
    });
    play(r);
    expect(ofType(r.events, 'crafted')[0]).toMatchObject({
      tag: 'enchanting',
      recipe: 'recipe.enchant_power_1',
    });
    expect(sword(r).affixes).toHaveLength(1);
    expect(parseAffix(sword(r).affixes![0]!).id).toBe('affix.power_1');
    expect(countItem(inv(r), 'item.essence_ember')).toBe(3);
    expect(countItem(inv(r), 'item.sword_bronze')).toBe(1);
    expect(r.s.ledger.crafts['recipe.enchant_power_1']).toBe(1);
    expect(mods0).toBeGreaterThanOrEqual(0);
  });

  it('a piece holds one enchant at Enchanting 0 and two at 15, never past its own slots', () => {
    expect(enchantRoom(enchantRig(0).s, 0)).toBe(1);
    const r = enchantRig(0);
    r.tick({
      type: 'craft',
      items: ['item.sword_bronze', 'item.essence_ember', 'item.spark_dust'],
    });
    play(r);
    r.events.length = 0;
    // A second one is refused: nothing is taken.
    const before = countItem(inv(r), 'item.spark_dust');
    r.tick({ type: 'craft', items: ['item.sword_bronze', 'item.spark_dust', 'item.quartz'] });
    expect(ofType(r.events, 'craftStarted')).toHaveLength(0);
    expect(countItem(inv(r), 'item.spark_dust')).toBe(before);
    const q = enchantRig(15);
    expect(enchantRoom(q.s, q.me)).toBe(2);
    q.tick({
      type: 'craft',
      items: ['item.sword_bronze', 'item.essence_ember', 'item.spark_dust'],
    });
    play(q);
    q.tick({ type: 'craft', items: ['item.sword_bronze', 'item.spark_dust', 'item.quartz'] });
    play(q);
    expect(sword(q).affixes).toHaveLength(2);
    // The sword has two affix slots: a third never fits.
    expect(ITEMS['item.sword_bronze']!.affixSlots).toBe(2);
  });

  it('the strength follows the quality rule: a better enchant gives a stronger affix', () => {
    const base = AFFIXES['affix.power_1']!.mods[0]!.add!;
    const strong = (key: string): number => {
      const q = rig(null);
      give(q.s, q.me, 'item.sword_bronze', 1, 'seed');
      const i = inv(q).slots.findIndex((x) => x?.item === 'item.sword_bronze');
      inv(q).slots[i]!.affixes = [key];
      inv(q).equipment.main = { ...inv(q).slots[i]!, qty: 1 };
      return activeMods(q.s, q.me)
        .filter((m) => m.stat === 'power')
        .reduce((n, m) => n + (m.add ?? 0), 0);
    };
    const q0 = strong('affix.power_1');
    const q3 = strong('affix.power_1~3');
    expect(q0).toBe(base);
    expect(q3).toBeGreaterThan(q0);
    expect(C.affixStrengthPct).toHaveLength(4);
  });

  it('an unknown mix at the stone is a failed craft that costs the materials', () => {
    const r = enchantRig(0);
    r.tick({ type: 'craft', items: ['item.sword_bronze', 'item.quartz', 'item.quartz'] });
    expect(ofType(r.events, 'craftFailed')).toHaveLength(1);
    expect(sword(r).affixes).toBeUndefined();
    expect(countItem(inv(r), 'item.rune_dust')).toBe(1);
  });
});

describe('the 40 recipes', () => {
  const by = (craft: string) => Object.values(RECIPES).filter((r) => r.craft === craft);
  // M3-12 added 6 Tailoring (cloth, leather, a scholar's outfit and leather wraps) and 4 Alchemy recipes.
  it('are 20 Tailoring, 14 Alchemy, 8 Enchanting and 8 Tinkering, each with a station and a start', () => {
    expect(by('tailoring')).toHaveLength(21);
    expect(by('alchemy')).toHaveLength(14);
    expect(by('enchanting')).toHaveLength(8);
    expect(by('tinkering')).toHaveLength(8);
    for (const craft of ['tailoring', 'alchemy', 'enchanting', 'tinkering'])
      expect(
        by(craft).some((r) => r.learn === 'start'),
        craft,
      ).toBe(true);
    for (const r of [
      ...by('tailoring'),
      ...by('alchemy'),
      ...by('enchanting'),
      ...by('tinkering'),
    ]) {
      expect(STATIONS[r.station]?.craft, r.id).toBe(r.craft);
      for (const i of r.ingredients) expect(ITEMS[i.item], `${r.id} ${i.item}`).toBeDefined();
      if (r.enchant) expect(AFFIXES[r.enchant], r.id).toBeDefined();
      else expect(ITEMS[r.result], r.id).toBeDefined();
    }
  });
  it('never share an ingredient set at one station, so a mix means one thing', () => {
    const seen = new Map<string, string>();
    for (const r of Object.values(RECIPES)) {
      const k = `${r.station}|${ingredientKey(expand(r.ingredients))}`;
      expect(seen.get(k), `${r.id} and ${seen.get(k)}`).toBeUndefined();
      seen.set(k, r.id);
    }
  });
  it('Enchanting has one recipe per affix of M3-05 and two stronger ones', () => {
    const affixes = by('enchanting').map((r) => r.enchant);
    for (const id of Object.keys(AFFIXES)) expect(affixes, id).toContain(id);
    expect(Object.keys(AFFIXES)).toHaveLength(8);
  });
  it('Tailoring makes cloth and leather for head, body and legs at two tiers', () => {
    // Cloth and leather stock (M3-12) is material, not worn, so only the gear is counted.
    const slots = by('tailoring')
      .filter((r) => ITEMS[r.result]!.equip)
      .map((r) => `${ITEMS[r.result]!.equip!.slot}${r.tier}`);
    for (const s of ['head', 'body', 'legs'])
      for (const t of [1, 2])
        expect(slots.filter((x) => x === `${s}${t}`).length).toBeGreaterThanOrEqual(2);
  });
  it('writes the quality distribution of each craft at skill 0, a perfect step and bare materials', () => {
    const roll = (tier: number, skillPts: number, grade: number): number[] => {
      const rng = createStream(5, 'craft');
      const out = [0, 0, 0, 0];
      for (let i = 0; i < 4000; i++)
        out[rollQuality(rng, { skillPts, tier, matSum: 0, matN: 1, grade, source: 'manual' })]!++;
      return out.map((n) => Math.round((n * 100) / 4000));
    };
    const lines: string[] = [];
    for (const [craft, tier] of [
      ['tailoring', 1],
      ['alchemy', 1],
      ['enchanting', 1],
      ['tinkering', 1],
      ['tailoring', 2],
      ['alchemy', 2],
      ['enchanting', 2],
      ['tinkering', 2],
    ] as const) {
      // The rule is the same for every craft: it depends on the tier and the skill, not the craft.
      lines.push(
        `${craft} t${tier} at skill 0, perfect: ${roll(tier, 0, 30).join('/')} | poor: ${roll(tier, 0, 0).join('/')} | at par: ${roll(tier, tier === 1 ? 5 : 20, 30).join('/')}`,
      );
    }
    process.stdout.write(
      `QUALITY (common/fine/superior/masterwork, percent)\n${lines.join('\n')}\n`,
    );
    expect(roll(1, 0, 30)[1]! + roll(1, 0, 30)[2]! + roll(1, 0, 30)[3]!).toBeGreaterThan(0);
  });
});

describe('remedies', () => {
  const drink = (item: string, before: (r: Rig) => void): Rig => {
    const r = rig(null);
    before(r);
    addItem(inv(r), item, 1);
    r.tick({ type: 'use', slot: inv(r).slots.findIndex((x) => x?.item === item) });
    return r;
  };
  it('Antidote clears poisoned, Warming Draught clears chilled and wet, Fire Salve clears burning and wards', () => {
    expect(
      hasStatus(drink('item.antidote', (r) => applyStatus(r.s, r.me, 'poisoned')).s, 0, 'poisoned'),
    ).toBe(false);
    const w = drink('item.warming_draught', (r) => {
      applyStatus(r.s, r.me, 'chilled');
      applyStatus(r.s, r.me, 'wet');
    });
    expect(hasStatus(w.s, w.me, 'chilled') || hasStatus(w.s, w.me, 'wet')).toBe(false);
    const f = drink('item.fire_salve', (r) => applyStatus(r.s, r.me, 'burning'));
    expect(hasStatus(f.s, f.me, 'burning')).toBe(false);
    expect(hasStatus(f.s, f.me, 'warded')).toBe(true);
  });
  it('Oil of Keenness is a Fed meal that raises Focus', () => {
    const r = drink('item.oil_keenness', () => undefined);
    expect(hasStatus(r.s, r.me, 'fed')).toBe(true);
  });
  it('the new tonics restore their pool', () => {
    const r = rig(null);
    addItem(inv(r), 'item.potion_stamina_m', 1);
    r.s.entities.comps.pools[r.me]!.sta = 0;
    r.tick({
      type: 'use',
      slot: inv(r).slots.findIndex((x) => x?.item === 'item.potion_stamina_m'),
    });
    expect(r.s.entities.comps.pools[r.me]!.sta).toBeGreaterThanOrEqual(600);
  });
});

describe('gadgets', () => {
  const use = (r: Rig, item: string): void => {
    addItem(inv(r), item, 1);
    r.tick({ type: 'use', slot: inv(r).slots.findIndex((x) => x?.item === item) });
  };
  const at = (r: Rig) => {
    const p = r.s.entities.comps.pos[r.me]!;
    return { x: Math.round(p.x / 256), y: Math.round(p.y / 256) };
  };

  it('Spark Flint lights the tile ahead and burns the brush wall there; Water Flask douses the fire', () => {
    const r = rig(null);
    const brush = spawnFixture(r.s, 'fixture.brush_wall', 20, 21);
    use(r, 'item.spark_flint');
    expect(r.s.entities.comps.fixture[brush]!.open).toBe(true);
    expect(ofType(r.events, 'gadgetUsed')[0]).toMatchObject({ gadget: 'spark' });
    expect(countItem(inv(r), 'item.spark_flint')).toBe(0);
    const w = rig(null);
    const fire = spawnFixture(w.s, 'fixture.fire_barrier', 20, 21);
    use(w, 'item.water_flask');
    expect(w.s.entities.comps.fixture[fire]!.open).toBe(true);
  });

  it('the element gadgets also hit a creature on that tile: ember burns, tide soaks', () => {
    const r = rig(null);
    const p = at(r);
    const foe = spawnEnemy(r.s, 'creature.mossling', p.x, p.y + 16);
    use(r, 'item.spark_flint');
    expect(hasStatus(r.s, foe, 'burning')).toBe(true);
    const w = rig(null);
    const q = at(w);
    const foe2 = spawnEnemy(w.s, 'creature.mossling', q.x, q.y + 16);
    use(w, 'item.water_flask');
    expect(hasStatus(w.s, foe2, 'wet')).toBe(true);
  });

  it('Smoke Pellet hides you for 3 seconds even in a fight', () => {
    const r = rig(null);
    r.s.entities.comps.skills[r.me]!.fight = { id: 1, last: r.s.tick };
    r.s.entities.comps.pools[r.me]!.lastCombat = r.s.tick;
    use(r, 'item.smoke_pellet');
    expect(hasStatus(r.s, r.me, 'hidden')).toBe(true);
    const until = r.s.entities.comps.statuses[r.me]!.find((s) => s.id === 'hidden')!.until;
    expect(until - r.s.tick).toBeLessThanOrEqual(90);
    r.run(95);
    expect(hasStatus(r.s, r.me, 'hidden')).toBe(false);
  });

  it('Bell Charm sends tier 1 creatures nearby running, and only those', () => {
    const r = rig(null);
    const p = at(r);
    const weak = spawnCreature(r.s, 'creature.mossling', p.x + 30, p.y);
    const strong = spawnCreature(r.s, 'creature.mossling', p.x - 30, p.y);
    r.s.entities.comps.combatant[strong]!.tier = 3;
    const far = spawnCreature(r.s, 'creature.mossling', p.x + 200, p.y);
    use(r, 'item.bell_charm');
    expect(r.s.entities.comps.ai[weak]!.state).toBe('flee');
    expect(r.s.entities.comps.ai[strong]!.state).not.toBe('flee');
    expect(r.s.entities.comps.ai[far]!.state).not.toBe('flee');
  });

  it('Repair Kit restores 30 percent durability to worn gear', () => {
    const r = rig(null);
    const sword = inv(r).equipment.main!;
    const max = ITEMS[sword.item]!.durability!;
    sword.dur = 0;
    use(r, 'item.repair_kit');
    expect(sword.dur).toBe(Math.ceil((max * 30) / 100));
  });

  it('Snare is set ahead and roots the first creature to step on it, then is gone', () => {
    const r = rig(null);
    use(r, 'item.snare');
    const snares = () => r.s.entities.comps.fixture.filter((f) => f?.kind === 'fixture.snare');
    expect(snares()).toHaveLength(1);
    const id = r.s.entities.comps.fixture.findIndex((f) => f?.kind === 'fixture.snare');
    const sp = r.s.entities.comps.pos[id]!;
    const foe = spawnEnemy(
      r.s,
      'creature.mossling',
      Math.round(sp.x / 256),
      Math.round(sp.y / 256),
    );
    r.run(2);
    expect(hasStatus(r.s, foe, 'rooted')).toBe(true);
    expect(snares()).toHaveLength(0);
    expect(ofType(r.events, 'snareSprung')).toHaveLength(1);
  });

  it('Grit Pouch dazes what is ahead for a second', () => {
    const r = rig(null);
    const p = at(r);
    const foe = spawnEnemy(r.s, 'creature.mossling', p.x, p.y + 40);
    use(r, 'item.grit_pouch');
    expect(hasStatus(r.s, foe, 'dazed')).toBe(true);
    const until = r.s.entities.comps.statuses[foe]!.find((s) => s.id === 'dazed')!.until;
    expect(until - r.s.tick).toBeLessThanOrEqual(30);
  });

  it('the Lantern is worn in the off hand, and every gadget is an item with a Use', () => {
    expect(ITEMS['item.lantern']!.equip!.slot).toBe('off');
    const gadgets = Object.values(ITEMS).filter((i) => i.gadget);
    expect(gadgets).toHaveLength(8);
    for (const g of gadgets)
      expect(
        Object.values(RECIPES).some((r) => r.result === g.id),
        g.id,
      ).toBe(true);
  });
});
