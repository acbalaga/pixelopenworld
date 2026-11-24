import { describe, expect, it } from 'vitest';
import { createAvatar } from '../../src/sim/avatar';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { chooseNext, crowdOf, newCrowd, travelersSystem } from '../../src/sim/travelers/crowd';
import { hash01, standPx, travelerViews } from '../../src/sim/travelers/entities';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { PLACE_LIST } from '../../src/sim/travelers/lists';
import { PLACES } from '../../src/content/people/places';

const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;
const OPEN = { solidAt: (): number => 0 };
const SQUARE = standPx(0, PLACE_LIST.indexOf('hearthford.square'))!;
const DUSK = 54_100;

function world(seed: number, worldTick = 0): SimState {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  createAvatar(s, px(SQUARE.x), px(SQUARE.y));
  // Brin's counter: the shopkeeper stands where the shop is.
  const shop = PLACES['hearthford.brin_shop']!.spot!.rect;
  spawnNpc(s, 'npc.shopkeeper', shop.x + (shop.w >> 1), shop.y + 1);
  s.worldTick = worldTick;
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

function run(s: SimState, ticks: number, each?: () => void): void {
  const base = s.clock!.nowMs;
  const start = s.tick;
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    s.worldTick++;
    s.clock = { ...s.clock!, nowMs: base + Math.floor(((s.tick - start) * 1000) / 30) };
    s.events.list.length = 0;
    travelersSystem(s);
    if (each && i % 15 === 0) each();
  }
}

describe('what promoted Travelers do', () => {
  it('at the evening peak someone is crafting, shopping, idling, AFK and standing in a group, in every one of 10 runs', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = world(seed);
      const seen = new Set<string>();
      run(s, 600);
      run(s, 7200, () => {
        for (const v of travelerViews(s)) {
          if (v.mode === 'craft') seen.add('craft');
          if (v.mode === 'shop') seen.add('shop');
          if (v.mode === 'idle' || v.mode === 'stand') seen.add('idle');
          if (v.mode === 'afk') seen.add('afk');
          if (v.group >= 2) seen.add('group');
        }
      });
      expect([...seen].sort(), `seed ${seed}`).toEqual(['afk', 'craft', 'group', 'idle', 'shop']);
    }
  }, 120_000);

  it('shows emotes as a glyph and a pose, and sleeps when AFK', () => {
    const s = world(3);
    run(s, 600);
    const glyphs = new Set<string>();
    run(s, 7200, () => {
      for (const v of travelerViews(s)) if (v.glyph) glyphs.add(v.glyph);
    });
    expect(glyphs.has('zzz')).toBe(true);
    expect([...glyphs].filter((g) => g !== 'zzz').length).toBeGreaterThan(0);
  });

  it('dances more at dusk than at midday', () => {
    const count = (tick: number): number => {
      let n = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const s = world(seed, tick);
        run(s, 600);
        run(s, 1500, () => {
          for (const v of travelerViews(s)) if (v.mode === 'dance') n++;
        });
      }
      return n;
    };
    expect(count(DUSK)).toBeGreaterThan(count(9000));
  }, 120_000);

  it('seats the inn crowd', () => {
    const s = world(4);
    run(s, 600);
    let sat = 0;
    run(s, 7200, () => {
      for (const v of travelerViews(s)) if (v.mode === 'sit') sat++;
    });
    expect(sat).toBeGreaterThan(0);
  });
});

describe('weather and the hour', () => {
  it('rain moves at least 60% of idle Travelers indoors within 2 in-game minutes', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = world(seed);
      run(s, 600);
      const c = crowdOf(s);
      // Wait for a few Travelers idling in the open.
      let idle: number[] = [];
      for (let i = 0; i < 40 && idle.length < 4; i++) {
        run(s, 120);
        idle = [...c.ents.values()]
          .filter((e) => {
            const d = c.doing[e.slot];
            return (
              d &&
              d.eta === 0 &&
              (d.kind === 'social' || d.kind === 'afk') &&
              !PLACES[PLACE_LIST[d.place] ?? '']!.indoors
            );
          })
          .map((e) => e.slot);
      }
      if (idle.length < 3) continue;
      s.weatherOverride = 'rain';
      run(s, 121);
      const indoors = idle.filter((slot) => {
        const d = c.doing[slot];
        // Still online and sent indoors, or already logged out (not counted).
        return !c.online[slot] || (d && PLACES[PLACE_LIST[d.place] ?? '']!.indoors);
      });
      expect(indoors.length / idle.length, `seed ${seed}`).toBeGreaterThanOrEqual(0.6);
    }
  }, 120_000);

  it('draws the social crowd to the inn at night', () => {
    const inn = PLACE_LIST.indexOf('hearthford.inn');
    const share = (tick: number): number => {
      const s = createDemoState(5, 0);
      s.worldTick = tick;
      const crowd = newCrowd(5);
      const t = identitiesOf(5).find((x) => x.archetype === 'Socializer')!;
      let n = 0;
      let social = 0;
      for (let i = 0; i < 1500; i++) {
        const d = chooseNext(s, crowd, t);
        if (d.kind !== 'social') continue;
        social++;
        if (d.place === inn) n++;
      }
      return n / social;
    };
    // Night is 38 to 48 minutes into the cycle: tick (48 - 4) * 1800 - 900 from the day's start.
    expect(share((44 - 4) * 1800 + 900)).toBeGreaterThan(share(9000) + 0.1);
  });

  it('keeps entity dice off the sim streams', () => {
    expect(hash01(1, 2, 3, 4)).toBe(hash01(1, 2, 3, 4));
    expect(hash01(1, 2, 3, 4)).not.toBe(hash01(1, 2, 3, 5));
    const a = world(7);
    const b = world(7);
    run(a, 900);
    run(b, 900);
    expect(a.rng.travelers).toEqual(b.rng.travelers);
  });
});
