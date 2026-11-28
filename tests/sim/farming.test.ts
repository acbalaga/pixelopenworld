import { describe, expect, it } from 'vitest';
import { FARMING as F } from '../../src/content/balance/farming';
import type { Season, Weather } from '../../src/content/balance/time';
import { DIALOGUES, SHOPS } from '../../src/content/dialogue';
import { CROPS, CROP_LIST, type CropDef } from '../../src/content/farming/crops';
import { ITEMS } from '../../src/content/items';
import { RECIPES } from '../../src/content/items/recipes';
import { DIALOGUE_STRINGS } from '../../src/content/strings/dialogue';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import {
  DAY_TICKS,
  SHADED,
  WEEK_TICKS,
  checkGiants,
  fertilize,
  growthAt,
  harvest,
  interactField,
  isRipe,
  lease,
  needOf,
  newFarm,
  newPlot,
  plant,
  podCrop,
  settle,
  stageOf,
  till,
  water,
  type Plot,
} from '../../src/sim/farming';
import { countItem, give } from '../../src/sim/items';
import { earnCoin } from '../../src/sim/ledger';
import { TRADEABLE } from '../../src/sim/market';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { spawnNpc, talk } from '../../src/sim/systems/npcs';
import { dayIndex, seasonOf } from '../../src/sim/time';

const OPEN = { solidAt: (): number => 0 };

/** The first world tick of the season, in the first year. */
function seasonStart(season: Season): number {
  for (let t = 0; ; t += DAY_TICKS) if (seasonOf(t) === season) return t + DAY_TICKS / 2;
}

/** A field hand: an avatar with coin, a hoe, a can and Farming points, all plots leased and tilled. */
function farm(o: { seed?: number; at?: number; points?: number } = {}): {
  s: SimState;
  me: number;
} {
  const s = createDemoState(o.seed ?? 3, 0);
  s.world = OPEN;
  s.weatherOverride = 'clear';
  s.worldTick = o.at ?? seasonStart('spring');
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  s.entities.comps.skills[me]!.points['skill.farming'] = o.points ?? 50;
  earnCoin(s, me, 1000, 'seed');
  give(s, me, 'item.hoe', 1, 'shop');
  give(s, me, 'item.watering_can', 1, 'shop');
  expect(lease(s, me, F.plots, F.lease.maxWeeks)).toBe(true);
  for (let i = 0; i < F.plots; i++) expect(till(s, me, i)).toBe(true);
  return { s, me };
}

/** Puts a seed in the bag and plants it. */
function sow(s: SimState, me: number, plot: number, crop: string): void {
  const c = CROPS[crop]!;
  give(s, me, c.seed, 1, 'shop');
  const inv = s.entities.comps.inventory[me]!;
  const slot = inv.slots.findIndex((x) => x?.item === c.seed);
  expect(plant(s, me, plot, slot), `plant ${crop}`).toBe(true);
}

/** A plot with a crop in the ground, watered at `watered`, for the pure growth function. */
function grown(c: CropDef, watered: number, fert = false): Plot {
  return {
    ...newPlot(),
    tilled: true,
    crop: c.id,
    planted: 0,
    watered,
    wetFor: DAY_TICKS,
    fert,
    paidUntil: 1e12,
  };
}

describe('growth on the world clock (M6-02)', () => {
  // Five crops of different lengths and seasons, over three days that start in their season.
  const five = ['crop.turnip', 'crop.potato', 'crop.wheat', 'crop.pepper', 'crop.honeyvine'];
  const rainy = (t: number): Weather => (dayIndex(t) % 3 === 1 ? 'rain' : 'clear');
  const dry = (): Weather => 'clear';

  for (const id of five)
    for (const [label, w] of [
      ['with rain days', rainy],
      ['without rain', dry],
    ] as const)
      it(`${id}: an offline gap grows exactly what one tick at a time grows, ${label}`, () => {
        const c = CROPS[id]!;
        const from = seasonStart(c.seasons[0]!);
        const to = from + 3 * DAY_TICKS;
        const p = grown(c, from + DAY_TICKS / 3, id === 'crop.potato');
        const long = growthAt(p, from, to, w);
        let stepped = 0;
        for (let t = from; t < to; t++) stepped += growthAt(p, t, t + 1, w);
        expect(stepped).toBe(long);
        expect(long).toBeGreaterThan(0);
        // Rain makes a difference, so the two cases test different things.
        if (w === rainy) expect(long).toBeGreaterThan(growthAt(p, from, to, dry));
      });

  it('settling a plot in many steps gives the same state as one step', () => {
    const a = farm();
    const b = farm();
    for (const x of [a, b]) {
      sow(x.s, x.me, 0, 'crop.potato');
      water(x.s, x.me, 0);
    }
    const end = a.s.worldTick + 2 * DAY_TICKS;
    for (let t = a.s.worldTick; t <= end; t += 997) settle(a.s, a.s.farm.plots[0]!, t);
    settle(a.s, a.s.farm.plots[0]!, end);
    settle(b.s, b.s.farm.plots[0]!, end);
    expect(a.s.farm.plots[0]).toEqual(b.s.farm.plots[0]);
  });

  it('a watered plot grows at full rate, a dry one at dryRate, a day out of season not at all', () => {
    const c = CROPS['crop.radish']!; // spring only
    const spring = seasonStart('spring');
    const p = grown(c, spring);
    expect(growthAt(p, spring, spring + 1000, () => 'clear')).toBe(1000 * F.unitsPerTick);
    const dryP = grown(c, -1);
    expect(growthAt(dryP, spring, spring + 1000, () => 'clear')).toBe(
      1000 * F.unitsPerTick * F.dryRate,
    );
    expect(growthAt(dryP, spring, spring + 1000, () => 'storm')).toBe(1000 * F.unitsPerTick);
    const summer = seasonStart('summer');
    expect(growthAt(grown(c, summer), summer, summer + DAY_TICKS, () => 'rain')).toBe(0);
  });

  it('a turnip planted and watered at dawn is ripe a day later', () => {
    const { s, me } = farm();
    sow(s, me, 0, 'crop.turnip');
    water(s, me, 0);
    const p = s.farm.plots[0]!;
    expect(stageOf(s, p)).toBe(0);
    s.worldTick += DAY_TICKS / 2;
    expect(stageOf(s, p)).toBe(1);
    s.worldTick += DAY_TICKS / 2;
    expect(isRipe(s, p)).toBe(true);
    expect(stageOf(s, p)).toBe(3);
  });
});

describe('nothing is destroyed (M6-02)', () => {
  it('a plot left for 30 in-game days keeps its ripe crop', () => {
    const { s, me } = farm();
    sow(s, me, 0, 'crop.turnip');
    water(s, me, 0);
    s.worldTick += 30 * DAY_TICKS;
    const p = s.farm.plots[0]!;
    expect(p.crop).toBe('crop.turnip');
    expect(isRipe(s, p)).toBe(true);
    const before = countItem(s.entities.comps.inventory[me]!, 'item.turnip');
    expect(harvest(s, me, 0)).toBe(true);
    expect(countItem(s.entities.comps.inventory[me]!, 'item.turnip')).toBeGreaterThan(before);
  });

  it('a lapsed lease pauses growth, keeps the crop and the soil, and growth resumes when paid', () => {
    const s0 = createDemoState(3, 0);
    s0.world = OPEN;
    s0.weatherOverride = 'clear';
    s0.worldTick = seasonStart('spring');
    const f = feetAt(20, 20);
    const me = createAvatar(s0, f.x, f.y);
    s0.entities.comps.skills[me]!.points['skill.farming'] = 50;
    earnCoin(s0, me, 500, 'seed');
    give(s0, me, 'item.hoe', 1, 'shop');
    // A glowcap bed grows in any season, so only the lease stops it.
    const i = SHADED[0]!;
    expect(lease(s0, me, F.plots, 1)).toBe(true);
    expect(till(s0, me, i)).toBe(true);
    // Planted five days into the week: unwatered it is half grown when the lease runs out.
    s0.worldTick += 5 * DAY_TICKS;
    sow(s0, me, i, 'crop.glowcap');
    const p = s0.farm.plots[i]!;
    s0.worldTick = p.paidUntil + 3 * DAY_TICKS;
    const g = (): number => {
      settle(s0, p);
      return p.growth;
    };
    const atLapse = g();
    expect(atLapse).toBeGreaterThan(0);
    s0.worldTick += 10 * DAY_TICKS;
    expect(g()).toBe(atLapse);
    expect(isRipe(s0, p)).toBe(false);
    expect(p.crop).toBe('crop.glowcap');
    expect(p.tilled).toBe(true);
    // The plot cannot be worked while lapsed, but nothing is taken.
    give(s0, me, 'item.watering_can', 1, 'shop');
    expect(water(s0, me, i)).toBe(false);
    expect(lease(s0, me, F.plots, 1)).toBe(true);
    // The lapsed days are not paid back as growth.
    expect(g()).toBe(atLapse);
    s0.worldTick += DAY_TICKS / 4;
    expect(g()).toBeGreaterThan(atLapse);
  });

  it('a crop out of season waits and does not die', () => {
    const { s, me } = farm();
    sow(s, me, 0, 'crop.radish');
    s.worldTick = seasonStart('winter');
    const p = s.farm.plots[0]!;
    settle(s, p);
    const g = p.growth;
    s.worldTick += 3 * DAY_TICKS;
    settle(s, p);
    expect(p.growth).toBe(g);
    expect(p.crop).toBe('crop.radish');
  });
});

describe('soil, rotation and fertilizer (M6-02)', () => {
  it('the same family again lowers soil, a different one raises it, fallow days and compost raise it', () => {
    const { s, me } = farm();
    const p = s.farm.plots[0]!;
    // Two days ripens any one-day crop unwatered, and the whole run stays inside spring and summer.
    const ripen = (): void => {
      s.worldTick += 2 * DAY_TICKS + 1;
    };
    expect(p.soil).toBe(F.soilStart);
    sow(s, me, 0, 'crop.turnip');
    ripen();
    expect(harvest(s, me, 0)).toBe(true);
    expect(p.soil).toBe(F.soilStart); // the first harvest sets the family only
    expect(p.family).toBe('root');
    // A root again straight away: the soil tires.
    sow(s, me, 0, 'crop.radish');
    ripen();
    expect(harvest(s, me, 0)).toBe(true);
    expect(p.soil).toBe(F.soilStart - 1);
    // An herb after roots rests it.
    sow(s, me, 0, 'crop.dewmint');
    ripen();
    expect(harvest(s, me, 0)).toBe(true);
    expect(p.soil).toBe(F.soilStart);
    // Two whole fallow days before planting raise it by two (to the cap).
    s.worldTick += 2 * DAY_TICKS + 10;
    sow(s, me, 0, 'crop.dewmint');
    expect(p.soil).toBe(Math.min(F.soilMax, F.soilStart + 2));
    // Compost on an empty plot raises soil; on a growing crop it speeds growth instead.
    const q = s.farm.plots[1]!;
    give(s, me, 'item.compost', 2, 'shop');
    expect(fertilize(s, me, 1)).toBe(true);
    expect(q.soil).toBe(F.soilStart + 1);
    sow(s, me, 1, 'crop.dewmint');
    const before = q.soil;
    expect(fertilize(s, me, 1)).toBe(true);
    expect(q.soil).toBe(before);
    expect(q.fert).toBe(true);
    const fed = growthAt(q, s.worldTick, s.worldTick + 1000, () => 'clear');
    expect(fed).toBe(Math.round(1000 * F.unitsPerTick * F.dryRate * (1 + F.fertBoost / 100)));
  });

  it('soil raises the yield and the quality roll by its steps', () => {
    const yields: Record<number, number[]> = { 0: [], 3: [] };
    const qual: Record<number, number> = { 0: 0, 3: 0 };
    for (const soil of [0, 3] as const)
      for (let k = 0; k < 200; k++) {
        const { s, me } = farm({ seed: 100 + k, points: 10 });
        const p = s.farm.plots[0]!;
        sow(s, me, 0, 'crop.potato');
        p.soil = soil;
        s.worldTick += 6 * DAY_TICKS;
        const n0 = countItem(s.entities.comps.inventory[me]!, 'item.potato');
        harvest(s, me, 0);
        const inv = s.entities.comps.inventory[me]!;
        yields[soil]!.push(countItem(inv, 'item.potato') - n0);
        qual[soil]! += inv.slots.find((x) => x?.item === 'item.potato')?.q ?? 0;
      }
    expect(new Set(yields[0])).toEqual(new Set([F.yieldBase]));
    const top = (F.yieldBase * (100 + F.soilYieldPct[3]!)) / 100;
    for (const n of yields[3]!) expect([Math.floor(top), Math.ceil(top)]).toContain(n);
    const mean = yields[3]!.reduce((a, b) => a + b, 0) / yields[3]!.length;
    expect(Math.abs(mean - top)).toBeLessThan(0.15);
    expect(qual[3]!).toBeGreaterThan(qual[0]! * 1.5);
  });
});

describe('giant crops (M6-02)', () => {
  /** Four ripe pumpkins in the top square at `soil`, and the check run. */
  function square(seed: number, o: { soil?: number; odd?: boolean; unripe?: boolean } = {}) {
    const { s, me } = farm({ seed, at: seasonStart('autumn') });
    for (const i of [0, 1, 2, 3]) sow(s, me, i, o.odd && i === 3 ? 'crop.beet' : 'crop.pumpkin');
    for (const i of [0, 1, 2, 3]) {
      const p = s.farm.plots[i]!;
      p.soil = o.soil ?? 3;
      // Grown to ripe (or half way, for the last plant of an unripe square).
      p.growth = o.unripe && i === 3 ? 0 : needOf(CROPS[p.crop!]!);
    }
    checkGiants(s, me);
    return { s, me };
  }

  it('merges four ripe plants at soil 3 at the stated chance over 1000 seeded trials', () => {
    let hits = 0;
    for (let k = 0; k < 1000; k++) {
      const { s } = square(5000 + k);
      const ps = [0, 1, 2, 3].map((i) => s.farm.plots[i]!);
      expect(ps.every((p) => p.rolled)).toBe(true);
      if (ps.every((p) => p.giant === 0)) hits++;
      else expect(ps.every((p) => p.giant === undefined)).toBe(true);
    }
    // Farming 50 doubles the chance (13 section 2.2): the hand here has 50.
    const pct = F.giant.chanceHighPct;
    expect(hits).toBeGreaterThan(pct * 10 - 45);
    expect(hits).toBeLessThan(pct * 10 + 45);
  }, 60_000);

  it('never merges below soil 3, with a different crop in the square, or before all four ripen', () => {
    for (let k = 0; k < 200; k++) {
      for (const o of [{ soil: 2 }, { odd: true }, { unripe: true }]) {
        const { s } = square(9000 + k, o);
        expect([0, 1, 2, 3].some((i) => s.farm.plots[i]!.giant !== undefined)).toBe(false);
      }
    }
  }, 60_000);

  it('a giant gives twelve at Masterwork and clears its square', () => {
    for (let k = 0; k < 200; k++) {
      const { s, me } = square(7000 + k);
      if (s.farm.plots[0]!.giant === undefined) continue;
      expect(harvest(s, me, 2)).toBe(true);
      const stack = s.entities.comps.inventory[me]!.slots.find((x) => x?.item === 'item.pumpkin');
      expect(stack?.qty).toBe(F.giant.qty);
      expect(stack?.q).toBe(3);
      for (const i of [0, 1, 2, 3]) expect(s.farm.plots[i]!.crop).toBeNull();
      return;
    }
    throw new Error('no giant in 200 squares');
  });
});

describe('seeds and seasons (M6-02)', () => {
  const sold = new Set(Object.values(SHOPS).flatMap((sh) => sh.stock.map((x) => x.item)));
  it('every crop seed is obtainable: a shop, a person, the Market or a seed pod', () => {
    for (const c of CROP_LIST) {
      const ways = [
        sold.has(c.seed),
        TRADEABLE.has(c.seed),
        // A pod grows a tier 1 or 2 crop of the season.
        c.tier <= 2 && !c.shade,
      ];
      expect(ways.some(Boolean), c.id).toBe(true);
      if ('shop' in c.seedFrom) expect(sold.has(c.seed), c.id).toBe(true);
      // Market seeds and seeds behind hearts are on the Market until POW-M6-09.
      else expect(TRADEABLE.has(c.seed), c.id).toBe(true);
    }
  });

  it('every crop can be planted in some season, in some plot of the field', () => {
    for (const c of CROP_LIST) {
      expect(c.seasons.length, c.id).toBeGreaterThan(0);
      const { s, me } = farm({ at: seasonStart(c.seasons[0]!), points: 100 });
      const plot = c.shade ? SHADED[0]! : 0;
      sow(s, me, plot, c.id);
      expect(s.farm.plots[plot]!.crop).toBe(c.id);
    }
  });

  it('Farming gates the tiers, and a glowcap bed grows only in the shaded plot', () => {
    const { s, me } = farm({ at: seasonStart('summer'), points: 0 });
    give(s, me, 'item.seed_corn', 1, 'shop');
    const slot = s.entities.comps.inventory[me]!.slots.findIndex(
      (x) => x?.item === 'item.seed_corn',
    );
    expect(plant(s, me, 0, slot)).toBe(false);
    s.entities.comps.skills[me]!.points['skill.farming'] = 15;
    expect(plant(s, me, 0, slot)).toBe(true);
    give(s, me, 'item.seed_glowcap', 2, 'shop');
    const g = s.entities.comps.inventory[me]!.slots.findIndex(
      (x) => x?.item === 'item.seed_glowcap',
    );
    expect(plant(s, me, 1, g)).toBe(false);
    expect(plant(s, me, SHADED[0]!, g)).toBe(true);
  });

  it('a seed pod grows a tier 1 or 2 crop of the season and teaches its seed', () => {
    const { s, me } = farm({ at: seasonStart('summer') });
    const want = podCrop(s, 0)!;
    expect(want.tier).toBeLessThanOrEqual(2);
    expect(want.seasons).toContain('summer');
    give(s, me, 'item.seed_pod', 1, 'gather');
    const slot = s.entities.comps.inventory[me]!.slots.findIndex(
      (x) => x?.item === 'item.seed_pod',
    );
    expect(plant(s, me, 0, slot)).toBe(true);
    expect(s.farm.plots[0]!.crop).toBe(want.id);
    expect(s.farm.known).toContain(want.id);
  });

  it('the hoe, the can and compost can be made, and the field tools are sold', () => {
    expect(RECIPES['recipe.hoe']?.craft).toBe('woodworking');
    expect(RECIPES['recipe.watering_can']?.craft).toBe('tinkering');
    expect(RECIPES['recipe.compost']?.craft).toBe('alchemy');
    expect(sold.has('item.hoe') && sold.has('item.watering_can')).toBe(true);
    for (const c of CROP_LIST) expect(ITEMS[c.result], c.result).toBeDefined();
  });
});

describe('the lease, the can and the context button (M6-02)', () => {
  it('Edda leases plots by the week for coin, and a choice shows only when it can be paid', () => {
    const s = createDemoState(4, 0);
    s.world = OPEN;
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y);
    spawnNpc(s, 'npc.reeve', 21, 20);
    earnCoin(s, me, 3 * 2 * F.lease.weekly, 'seed');
    const node = DIALOGUES['npc.reeve']!.nodes['weeks_3']!;
    const twoWeeks = node.choices!.findIndex((c) => c.text === 'dlg.reeve.c_lease_3_2');
    const threeWeeks = node.choices!.findIndex((c) => c.text === 'dlg.reeve.c_lease_3_3');
    for (const c of node.choices!) expect(DIALOGUE_STRINGS[c.text], c.text).toBeTruthy();
    talk(s, me, { npc: 'npc.reeve', node: 'weeks_3', choice: threeWeeks });
    expect(s.farm.plots[0]!.paidUntil).toBe(0);
    talk(s, me, { npc: 'npc.reeve', node: 'weeks_3', choice: twoWeeks });
    expect(s.entities.comps.avatar[me]!.coin).toBe(0);
    for (const i of [0, 1, 2])
      expect(s.farm.plots[i]!.paidUntil).toBe(s.worldTick + 2 * WEEK_TICKS);
    expect(s.farm.plots[3]!.paidUntil).toBe(0);
    expect(s.ledger.coinSpent.lease).toBe(3 * 2 * F.lease.weekly);
  });

  it('the context button tills, plants via the sheet, waters, and harvests the plot ahead', () => {
    const { s, me } = farm();
    // A fresh field: leased, not tilled, the avatar standing below plot 0, facing up into it.
    s.farm = newFarm();
    lease(s, me, 1, 1);
    spawnFixture(s, 'fixture.field_plot_0', 20, 17);
    const press = (): void => {
      stepWorld(s, me, { commands: [{ type: 'interact' }], worldTick: s.worldTick });
    };
    s.entities.comps.avatar[me]!.facing = 0;
    press();
    expect(s.farm.plots[0]!.tilled).toBe(true);
    give(s, me, 'item.seed_turnip', 1, 'shop');
    stepWorld(s, me, { commands: [{ type: 'interact' }], worldTick: s.worldTick });
    const opened = s.events.list.some((e) => e.type === 'plotOpened' && e.plot === 0);
    expect(opened).toBe(true);
    const slot = s.entities.comps.inventory[me]!.slots.findIndex(
      (x) => x?.item === 'item.seed_turnip',
    );
    stepWorld(s, me, {
      commands: [{ type: 'farm', op: 'plant', plot: 0, slot }],
      worldTick: s.worldTick,
    });
    expect(s.farm.plots[0]!.crop).toBe('crop.turnip');
    const w = s.farm.water;
    press();
    expect(s.farm.water).toBe(w - 1);
    s.worldTick += DAY_TICKS + 1;
    press();
    expect(s.farm.plots[0]!.crop).toBeNull();
    expect(countItem(s.entities.comps.inventory[me]!, 'item.turnip')).toBeGreaterThan(0);
    expect(s.events.list.some((e) => e.type === 'harvested')).toBe(true);
  });

  it('the can is filled at the water ahead', () => {
    const { s, me } = farm();
    s.farm.water = 0;
    s.world = { solidAt: (tx, ty) => (tx === 20 && ty === 19 ? 2 : 0) };
    s.entities.comps.avatar[me]!.facing = 0;
    expect(interactField(s, me)).toBe(true);
    expect(s.farm.water).toBe(F.canCharges);
  });
});

describe('Farming XP and integrity (M6-02)', () => {
  it('a harvest pays Farming XP, with the first-time bonus once per crop', () => {
    const { s, me } = farm({ points: 50 });
    const xp = (): number => s.ledger.xpEarned['skill.farming'] ?? 0;
    sow(s, me, 0, 'crop.turnip');
    s.worldTick += 2 * DAY_TICKS + 1;
    stepWorld(s, me, {
      commands: [{ type: 'farm', op: 'harvest', plot: 0 }],
      worldTick: s.worldTick,
    });
    const first = xp();
    expect(first).toBeGreaterThan(F.xp.firstTime);
    sow(s, me, 0, 'crop.turnip');
    s.worldTick += 2 * DAY_TICKS + 1;
    stepWorld(s, me, {
      commands: [{ type: 'farm', op: 'harvest', plot: 0 }],
      worldTick: s.worldTick,
    });
    expect(xp() - first).toBeLessThan(F.xp.firstTime);
    expect(xp() - first).toBeGreaterThan(0);
  });
});
