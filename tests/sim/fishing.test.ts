import { describe, expect, it } from 'vitest';
import { FISHING as F } from '../../src/content/balance/fishing';
import { ITEMS_BALANCE as B } from '../../src/content/balance/items';
import { DAYS_PER_SEASON, TIME } from '../../src/content/balance/time';
import { FISH, FISH_BY_ITEM, WATERS } from '../../src/content/fishing/fish';
import { FISH_PLACES, placeOf } from '../../src/content/fishing/places';
import { ITEMS } from '../../src/content/items';
import { NODES } from '../../src/content/items/recipes';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { bandWidth, newFight, reelStep } from '../../src/sim/fishing';
import { give, spawnNode } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { Dir } from '../../src/sim/kernel/fixed';
import {
  createDemoState,
  deserializeState,
  hashState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { dayPhase, seasonOf, weatherOn } from '../../src/sim/time';
import { fight, playCast, rate } from '../support/reelBot';

/**
 * Fishing (POW-M6-05): the fight, the bite, the species table, the records and Old Gnarl. The save
 * and the integrity rules are in `tests/unit/fishingSave.test.ts`.
 */

const OPEN = { solidAt: (): number => 0 };
const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  offset: number;
  tick: (...cmds: Command[]) => void;
}

/** An avatar at tile (tx, ty) with a node of `kind` one step east. */
function rig(seed: number, kind: string, tx = 20, ty = 20): Rig & { node: number } {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  const f = feetAt(tx, ty);
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
  };
  r.tick({ type: 'scheme', scheme: 'classic' });
  const p = s.entities.comps.pos[me]!;
  const node = spawnNode(s, kind, Math.round(p.x / 256) + 12, Math.round(p.y / 256));
  r.tick({ type: 'move', dir: Dir.E });
  r.tick({ type: 'move', dir: null });
  for (let i = 0; i < 4; i++) r.tick();
  r.events.length = 0;
  return Object.assign(r, { node });
}

describe('the fight', () => {
  it('holding the line lifts the marker and letting go lets it sink', () => {
    const s = createDemoState(1, 0);
    const up = newFight(false);
    up.item = 'item.fish_river';
    up.phase = 'reel';
    up.band = 400;
    up.hold = true;
    const down = { ...up, hold: false };
    // No pull: the fish is resting.
    up.rest = down.rest = 1000;
    for (let i = 0; i < 6; i++) {
      reelStep(s, up);
      reelStep(s, down);
    }
    expect(up.m).toBeGreaterThan(F.center);
    expect(down.m).toBeLessThan(F.center);
  });

  it('the catch bar rises in the band, falls outside it, and a full bar lands the fish', () => {
    const s = createDemoState(2, 0);
    const f = newFight(false);
    f.item = 'item.fish_river';
    f.phase = 'reel';
    f.band = 400;
    f.rest = 1000;
    f.m = F.center;
    f.hold = false;
    // Pin the marker inside the band and read the bar.
    const before = f.fill;
    f.v = 0;
    f.m = F.center;
    reelStep(s, f);
    expect(f.fill).toBe(before + F.fill.rise);
    // Pin it outside.
    const out = newFight(false);
    out.item = 'item.fish_river';
    out.phase = 'reel';
    out.band = 100;
    out.rest = 1000;
    out.m = 0;
    out.hold = false;
    reelStep(s, out);
    expect(out.fill).toBe(F.fill.start - F.fill.fall);
    // A bar that reaches full is landed, an empty one is lost.
    f.fill = F.fill.full - 1;
    f.v = 0;
    f.m = F.center;
    expect(reelStep(s, f)).toBe('landed');
    out.fill = 1;
    out.m = 0;
    expect(reelStep(s, out)).toBe('lost');
  });

  it('a fight that runs out of time is lost', () => {
    const s = createDemoState(2, 0);
    const f = newFight(false);
    f.item = 'item.fish_river';
    f.phase = 'reel';
    f.band = 1000;
    f.t = F.maxReelTicks - 1;
    f.fill = 1;
    f.rest = 1000;
    // A band as wide as the track keeps the bar at full, so time is what ends it.
    f.fill = F.fill.full - 100 * F.fill.rise;
    expect(reelStep(s, f)).toBe('lost');
  });

  it('is deterministic: the same seed and the same thumb give the same fight', () => {
    const a = fight(11, 3, 7);
    const b = fight(11, 3, 7);
    expect(a).toBe(b);
  });
});

describe('the band', () => {
  it('narrows with difficulty, widens with the rod and with Patient Line', () => {
    const w = [1, 2, 3, 4, 5].map((d) => bandWidth(d, 1, false));
    for (let i = 1; i < w.length; i++) expect(w[i]!).toBeLessThan(w[i - 1]!);
    expect(bandWidth(3, 2, false)).toBe(bandWidth(3, 1, false) + F.band.perRodTier);
    expect(bandWidth(3, 0, false)).toBe(bandWidth(3, 1, false) + F.band.noRod);
    expect(bandWidth(3, 1, true)).toBe(Math.floor((bandWidth(3, 1, false) * 115) / 100));
  });

  it('a hooked fish gets the band of its difficulty, the rod in the bag and Patient Line at Fishing 15', () => {
    const r = rig(5, 'node.fishing_spot');
    give(r.s, r.me, 'item.rod_ash', 1, 'start');
    const skills = r.s.entities.comps.skills[r.me]!;
    const hookBand = (): number => {
      r.s.entities.comps.gather[r.me] = null;
      r.s.entities.comps.node[r.node]!.readyAt = 0;
      r.tick({ type: 'interact' });
      while (r.s.entities.comps.gather[r.me]!.fish!.phase === 'wait') r.tick();
      const f = r.s.entities.comps.gather[r.me]!.fish!;
      const d = FISH_BY_ITEM[f.item]!.difficulty;
      r.tick({ type: 'interact' });
      return (
        r.s.entities.comps.gather[r.me]!.fish!.band -
        bandWidth(d, 1, skills.points['skill.fishing']! >= 15)
      );
    };
    expect(hookBand()).toBe(0);
    skills.points['skill.fishing'] = 15;
    expect(hookBand()).toBe(0);
  });
});

describe('the catch rate (the bot, three thumbs)', () => {
  // A scripted player holds the line by a rule and sees the marker `lag` ticks late. The three
  // levels and the ranges are data in `balance/fishing.ts`.
  for (const [d, row] of Object.entries(F.targets)) {
    F.levels.forEach((lvl, i) => {
      const [lo, hi] = row[i]!;
      it(`difficulty ${d}, ${lvl.name} thumb: ${lo} to ${hi} percent landed`, () => {
        const got = rate(Number(d), lvl.lag, 300);
        expect(got).toBeGreaterThanOrEqual(lo);
        expect(got).toBeLessThanOrEqual(hi);
      });
    });
  }
  it('a harder fish is never easier, for the same thumb', () => {
    for (const lvl of F.levels) {
      let last = 101;
      for (let d = 1; d <= 5; d++) {
        const got = rate(d, lvl.lag, 150);
        expect(got).toBeLessThanOrEqual(last);
        last = got;
      }
    }
  });
});

describe('the table', () => {
  const dawnWaters = new Set(
    DAWNMEADOW.placements.filter((p) => p.kind.startsWith('node.fishing_')).map((p) => p.kind),
  );

  it('has 14 species and a legend, each with an item, a size range and a difficulty from 1 to 5', () => {
    expect(FISH.filter((f) => !f.legend)).toHaveLength(14);
    expect(FISH.filter((f) => f.legend)).toHaveLength(1);
    for (const f of FISH) {
      expect(ITEMS[f.item], f.item).toBeDefined();
      expect(f.size[0]).toBeLessThan(f.size[1]);
      expect(f.difficulty).toBeGreaterThanOrEqual(1);
      expect(f.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it('every water in the table has a spot on the Dawnmeadow map, and every spot kind is a real node', () => {
    for (const w of WATERS) {
      const kind = Object.values(NODES).find((n) => n.water === w)!;
      expect(dawnWaters.has(kind.id), w).toBe(true);
    }
    for (const k of dawnWaters) expect(NODES[k]?.fishing, k).toBe(true);
  });

  it('every fish can be caught: its water has a spot, and its phase, season and weather all occur together', () => {
    const s = createDemoState(1, 0);
    s.region = 'dawnmeadow';
    // Two years of days, each sampled at the middle of every phase.
    const seen = new Set<string>();
    const dayTicks =
      TIME.ticksPerMinute * 24 * 60 > 0
        ? TIME.phases.reduce((a, p) => a + p.minutes, 0) * TIME.ticksPerMinute
        : 0;
    for (let day = 0; day < DAYS_PER_SEASON * 4 * 3; day++) {
      for (let p = 0; p < 8; p++) {
        const t = day * dayTicks + Math.floor((p / 8) * dayTicks);
        const key = `${dayPhase(t)}|${seasonOf(t)}|${weatherOn(s, t)}`;
        seen.add(key);
      }
    }
    for (const f of FISH.filter((x) => !x.legend)) {
      const spot = f.water.some((w) => [...dawnWaters].some((k) => NODES[k]?.water === w));
      expect(spot, `${f.item} has a spot`).toBe(true);
      const ok = [...seen].some((k) => {
        const [ph, se, we] = k.split('|');
        return (
          (!f.phases || f.phases.includes(ph as never)) &&
          (!f.seasons || f.seasons.includes(se as never)) &&
          (!f.weather || f.weather.includes(we as never))
        );
      });
      expect(ok, `${f.item} has a time that suits it`).toBe(true);
    }
  });

  it('a spot never runs dry: some fish is open in every phase, season and weather', () => {
    const s = createDemoState(1, 0);
    for (const w of WATERS) {
      const node = Object.values(NODES).find((n) => n.water === w)!;
      expect(
        node.yields.some((y) => !y.phases && !y.seasons && !y.weather),
        w,
      ).toBe(true);
    }
    expect(s).toBeDefined();
  });

  it('every fish lands in the ledger as gathered', async () => {
    const { canCome } = await import('../../src/save/integrity/sources');
    for (const f of FISH) expect(canCome(f.item, 'gather'), f.item).toBe(true);
  });
});

describe('landing a fish', () => {
  /** Casts and plays the fight until a fish is landed, up to `tries` casts. */
  function landOne(r: Rig & { node: number }, tries = 12): SimEvent | undefined {
    for (let i = 0; i < tries; i++) {
      r.s.entities.comps.node[r.node]!.readyAt = 0;
      r.events.length = 0;
      r.tick({ type: 'interact' });
      playCast(r.s, r.me, r.tick);
      const e = ofType(r.events, 'fishLanded')[0];
      if (e) return e;
    }
    return undefined;
  }

  it('pays one fish, writes its record, and wears the rod', () => {
    const r = rig(8, 'node.fishing_spot');
    give(r.s, r.me, 'item.rod_ash', 1, 'start');
    const e = landOne(r) as Extract<SimEvent, { type: 'fishLanded' }>;
    expect(e).toBeDefined();
    const fd = FISH_BY_ITEM[e.item]!;
    expect(e.size).toBeGreaterThanOrEqual(fd.size[0]);
    expect(e.size).toBeLessThanOrEqual(fd.size[1]);
    expect(e.record).toBe(true);
    expect(r.s.fishing.records[e.item]).toEqual({ n: 1, best: e.size, where: e.place });
    expect(ofType(r.events, 'gatherResolved')[0]!.qty).toBe(1);
    expect(ofType(r.events, 'gathered')[0]!.tag).toBe('fishing');
    // The spot rests, and the catch is in the bag.
    expect(r.s.entities.comps.node[r.node]!.readyAt).toBeGreaterThan(r.s.worldTick);
    const bag = r.s.entities.comps.inventory[r.me]!;
    expect(bag.slots.some((x) => x?.item === e.item)).toBe(true);
  }, 60_000);

  it('the records page keeps the biggest of each species and where it came from', () => {
    const r = rig(9, 'node.fishing_spot', 242, 164);
    give(r.s, r.me, 'item.rod_ash', 1, 'start');
    const seen = new Map<string, number>();
    for (let i = 0; i < 25; i++) {
      const e = landOne(r, 2) as Extract<SimEvent, { type: 'fishLanded' }> | undefined;
      if (!e) continue;
      seen.set(e.item, Math.max(seen.get(e.item) ?? 0, e.size));
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const [item, best] of seen) {
      const rec = r.s.fishing.records[item]!;
      expect(rec.best).toBe(best);
      expect(rec.where).toBe('lark');
    }
  }, 120_000);

  it('names the nearest water', () => {
    expect(placeOf(238, 170)).toBe('lark');
    expect(placeOf(307, 247)).toBe('reedmouth');
    expect(placeOf(352, 114)).toBe('millbrook_pond');
    expect(placeOf(144, 312)).toBe('south_coast');
    expect(FISH_PLACES.map((p) => p.id)).toHaveLength(4);
  });
});

describe('bait', () => {
  it('a minnow on the hook shortens the wait and is used up, even if the fish is lost', () => {
    const plain = rig(21, 'node.fishing_spot');
    plain.tick({ type: 'interact' });
    const base = plain.s.entities.comps.gather[plain.me]!.wait;
    const baited = rig(21, 'node.fishing_spot');
    give(baited.s, baited.me, 'item.fish_minnow', 2, 'gather');
    baited.tick({ type: 'interact' });
    const g = baited.s.entities.comps.gather[baited.me]!;
    expect(g.wait).toBe(Math.max(1, Math.floor((base * F.bait.waitPct) / 100)));
    expect(g.fish!.bait).toBe(true);
    expect(ofType(baited.events, 'fishBaited')).toHaveLength(1);
    const minnows = baited.s.entities.comps.inventory[baited.me]!.slots.filter(
      (x) => x?.item === 'item.fish_minnow',
    ).reduce((n, x) => n + x!.qty, 0);
    expect(minnows).toBe(1);
    // Cast within the table's range.
    expect(base).toBeGreaterThanOrEqual(B.gather.fishWaitMin);
    expect(base).toBeLessThanOrEqual(B.gather.fishWaitMax);
  });
});

describe('Old Gnarl', () => {
  /** A pond spot at the Millbrook shore, at dusk in autumn, for a Fishing 25 hand. */
  function pond(seed: number): Rig & { node: number } {
    const r = rig(seed, 'node.fishing_pond', 350, 110);
    r.s.region = 'dawnmeadow';
    r.s.weatherOverride = 'clear';
    give(r.s, r.me, 'item.rod_yew', 1, 'start');
    r.s.entities.comps.skills[r.me]!.points['skill.fishing'] = 25;
    let t = 0;
    while (!(seasonOf(t) === 'autumn' && dayPhase(t) === 'dusk')) t += 300;
    r.offset = t - r.s.tick;
    return r;
  }
  const bites = (r: Rig & { node: number }, n: number): string[] => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      r.s.entities.comps.node[r.node]!.readyAt = 0;
      r.events.length = 0;
      r.tick({ type: 'interact' });
      while (r.s.entities.comps.gather[r.me]?.fish?.phase === 'wait') r.tick();
      const f = r.s.entities.comps.gather[r.me]?.fish;
      if (f) out.push(f.item);
      playCast(r.s, r.me, r.tick);
    }
    return out;
  };

  it('is the pond at dusk in autumn and nowhere else, and not below Fishing 25', () => {
    const r = pond(31);
    expect(bites(r, 40)).toContain('item.old_gnarl');
    const low = pond(31);
    low.s.entities.comps.skills[low.me]!.points['skill.fishing'] = 24;
    expect(bites(low, 40)).not.toContain('item.old_gnarl');
    const day = pond(31);
    let t = 0;
    while (!(seasonOf(t) === 'autumn' && dayPhase(t) === 'day')) t += 300;
    day.offset = t - day.s.tick;
    expect(bites(day, 40)).not.toContain('item.old_gnarl');
    // Another water at the same time never gives her.
    const river = rig(31, 'node.fishing_spot', 240, 165);
    river.s.region = 'dawnmeadow';
    river.s.entities.comps.skills[river.me]!.points['skill.fishing'] = 25;
    river.offset = pond(31).offset;
    expect(bites(river, 40)).not.toContain('item.old_gnarl');
  }, 120_000);

  it('is landed once per save: after the catch she never bites again, and a reload keeps it', () => {
    const r = pond(32);
    let landed = false;
    for (let i = 0; i < 200 && !landed; i++) {
      bites(r, 1);
      landed = r.s.fishing.gnarl;
    }
    expect(landed).toBe(true);
    expect(r.s.fishing.records['item.old_gnarl']!.n).toBe(1);
    expect(r.s.fishing.records['item.old_gnarl']!.where).toBe('millbrook_pond');
    const held = (s: SimState, me: number): number =>
      s.entities.comps.inventory[me]!.slots.filter((x) => x?.item === 'item.old_gnarl').reduce(
        (n, x) => n + x!.qty,
        0,
      );
    expect(held(r.s, r.me)).toBe(1);
    // Reload, then fish her pond for a long while.
    const back = deserializeState(serializeState(r.s));
    expect(back.fishing.gnarl).toBe(true);
    expect(hashState(back)).toBe(hashState(r.s));
    r.s.fishing = back.fishing;
    expect(bites(r, 60)).not.toContain('item.old_gnarl');
    expect(held(r.s, r.me)).toBe(1);
  }, 300_000);
});

describe('the fight and the save', () => {
  it('a fight saved mid-reel and loaded plays out exactly like the one that never stopped', () => {
    const play = (split: boolean): string => {
      let r = rig(41, 'node.fishing_spot');
      r.tick({ type: 'interact' });
      while (r.s.entities.comps.gather[r.me]!.fish!.phase === 'wait') r.tick();
      r.tick({ type: 'interact' });
      for (let i = 0; i < 40; i++) r.tick({ type: 'reel', on: i % 3 !== 0 });
      if (split) {
        const s2 = deserializeState(serializeState(r.s));
        s2.world = OPEN;
        r = { ...r, s: s2, tick: r.tick };
        const offset = r.offset;
        r.tick = (...cmds) => {
          stepWorld(s2, r.me, { commands: cmds, worldTick: s2.tick + 1 + offset });
          r.events.push(...s2.events.list);
        };
      }
      for (let i = 0; i < 60; i++) r.tick({ type: 'reel', on: i % 4 !== 0 });
      return hashState(r.s);
    };
    expect(play(true)).toBe(play(false));
  });

  it('walking away from the spot lets the fish go and costs nothing else', () => {
    const r = rig(42, 'node.fishing_spot');
    r.tick({ type: 'interact' });
    while (r.s.entities.comps.gather[r.me]!.fish!.phase === 'wait') r.tick();
    r.tick({ type: 'interact' });
    for (let i = 0; i < 8; i++) r.tick({ type: 'move', dir: Dir.W });
    expect(r.s.entities.comps.gather[r.me] ?? null).toBeNull();
    expect(r.s.entities.comps.node[r.node]!.readyAt).toBeLessThanOrEqual(r.s.worldTick);
    expect(Object.keys(r.s.fishing.records)).toHaveLength(0);
  });
});
