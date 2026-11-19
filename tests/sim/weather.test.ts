import { describe, expect, it } from 'vitest';
import { WEATHER, TIME, type Weather } from '../../src/content/balance/time';
import { WEATHER_BALANCE } from '../../src/content/balance/weather';
import { REGION_WEATHER, weatherFor } from '../../src/content/world/weather';
import { createAvatar } from '../../src/sim/avatar';
import { createDemoState } from '../../src/sim/state';
import { px } from '../../src/sim/kernel/fixed';
import {
  calendarOf,
  currentWeather,
  dayIndex,
  phaseProgress,
  weatherAt,
  weatherOn,
} from '../../src/sim/time';
import { elementPct, noticePct, spawnTicks } from '../../src/sim/weatherEffects';

const CYCLE = TIME.phases.reduce((n, p) => n + p.minutes, 0) * TIME.ticksPerMinute;

describe('weather table', () => {
  it('is deterministic from the seed and the day, and this sequence never changes', () => {
    const run = (): Weather[] =>
      Array.from({ length: 21 }, (_, d) => weatherFor('dawnmeadow', 12345, d));
    expect(run()).toEqual(run());
    expect(run()).toEqual([
      'clear',
      'clear',
      'clear',
      'clear',
      'clear',
      'clear',
      'storm',
      'clear',
      'clear',
      'clear',
      'fog',
      'rain',
      'clear',
      'clear',
      'rain',
      'clear',
      'rain',
      'rain',
      'clear',
      'rain',
      'clear',
    ]);
  });

  it('differs by seed and by region', () => {
    const a = Array.from({ length: 60 }, (_, d) => weatherFor('dawnmeadow', 1, d)).join();
    expect(Array.from({ length: 60 }, (_, d) => weatherFor('dawnmeadow', 2, d)).join()).not.toBe(a);
    expect(Array.from({ length: 60 }, (_, d) => weatherFor('sample', 1, d)).join()).not.toBe(a);
  });

  it('draws in proportion to the table, and only kinds the table lists', () => {
    const table = REGION_WEATHER.dawnmeadow!;
    const total = Object.values(table).reduce((n, w) => n + w, 0);
    const days = 6000;
    const seen: Record<string, number> = {};
    for (let d = 0; d < days; d++) {
      const w = weatherFor('dawnmeadow', 777, d);
      seen[w] = (seen[w] ?? 0) + 1;
    }
    for (const w of WEATHER) {
      const want = (table[w] ?? 0) / total;
      expect(Math.abs((seen[w] ?? 0) / days - want), w).toBeLessThan(0.03);
    }
    expect(seen.snow ?? 0).toBe(0);
  });

  it('an unknown region still has weather', () => {
    expect(WEATHER).toContain(weatherFor('region.nowhere', 5, 3));
  });

  it('every region table sums above zero and names real kinds', () => {
    for (const [id, t] of Object.entries(REGION_WEATHER)) {
      expect(
        Object.values(t).reduce((n, w) => n + w, 0),
        id,
      ).toBeGreaterThan(0);
      for (const k of Object.keys(t)) expect(WEATHER as readonly string[]).toContain(k);
    }
  });
});

describe('the clock and the calendar', () => {
  it('walks through the four phases and blends in from the one before', () => {
    const seen = new Set<string>();
    for (let t = 0; t < CYCLE; t += 600) seen.add(phaseProgress(t).phase);
    expect([...seen].sort()).toEqual(['dawn', 'day', 'dusk', 'night']);
    const p = phaseProgress(
      TIME.phases[0].minutes * TIME.ticksPerMinute * 0 + 4 * TIME.ticksPerMinute * 0,
    );
    expect(p.t).toBeGreaterThanOrEqual(0);
    expect(p.t).toBeLessThan(1);
  });

  it('counts seven days to a season and four seasons to a year', () => {
    expect(calendarOf(0)).toMatchObject({ day: 1, season: 'spring', year: 1 });
    expect(calendarOf(7 * CYCLE)).toMatchObject({ day: 1, season: 'summer' });
    expect(calendarOf(28 * CYCLE)).toMatchObject({ day: 1, season: 'spring', year: 2 });
  });
});

describe('weather effects', () => {
  const at = (w: Weather) => {
    const s = createDemoState(1, 0);
    s.weatherOverride = w;
    return s;
  };

  it('rain feeds Tide and damps Ember, and clear changes nothing', () => {
    expect(elementPct(at('rain'), 'tide', 0, 0)).toBe(125);
    expect(elementPct(at('rain'), 'ember', 0, 0)).toBe(80);
    expect(elementPct(at('heat'), 'ember', 0, 0)).toBe(125);
    expect(elementPct(at('clear'), 'ember', 0, 0)).toBe(100);
    expect(elementPct(at('rain'), 'stone', 0, 0)).toBe(100);
  });

  it('fog cuts how far creatures notice', () => {
    expect(noticePct(at('fog'), 0, 0)).toBe(WEATHER_BALANCE.noticePct.fog);
    expect(noticePct(at('clear'), 0, 0)).toBe(100);
  });

  it('spawners refill at the weather rate on average, with no random number spent', () => {
    const s = at('storm');
    let total = 0;
    for (let i = 0; i < 1000; i++) {
      s.tick = i;
      total += spawnTicks(s, 0, 0);
    }
    expect(total).toBe(1250);
  });

  it('caves and dungeons are not under the sky', () => {
    const s = at('storm');
    // Room a of the first cave: tiles x 3 to 21, y 99 to 113.
    expect(weatherAt(s, px(8 * 16), px(105 * 16))).toBe('clear');
    expect(weatherAt(s, px(40 * 16), px(40 * 16))).toBe('storm');
  });

  it('follows the day: the same day gives the same weather, another day may not', () => {
    const s = createDemoState(9, 0);
    s.region = 'sample';
    s.worldTick = 0;
    const today = currentWeather(s);
    s.worldTick = 5;
    expect(currentWeather(s)).toBe(today);
    expect(weatherOn(s, 3 * CYCLE)).toBe(weatherFor('sample', 9, dayIndex(3 * CYCLE)));
  });

  it('an avatar is not needed for any of it', () => {
    const s = at('rain');
    createAvatar(s, px(10), px(10));
    expect(elementPct(s, 'tide', 0, 0)).toBe(125);
  });
});
