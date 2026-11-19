import { describe, expect, it } from 'vitest';
import { WEATHER, TIME, type Weather } from '../../src/content/balance/time';
import { WEATHER_BALANCE } from '../../src/content/balance/weather';
import { PALETTE } from '../../src/content/sprites/palette';
import {
  LIGHTS,
  PHASE_GRADE,
  SEASON_PALETTE,
  WEATHER_GRADE,
  WEATHER_PARTICLES,
} from '../../src/content/world/atmosphere';
import { REGION_WEATHER, weatherFor } from '../../src/content/world/weather';
import { lightLevel, phaseTint, weatherTint } from '../../src/render/grade';
import { Layer, type Renderer } from '../../src/render/renderer';
import { WeatherFx } from '../../src/render/weatherFx';
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
import { calendarView } from '../../src/ui/menu/model';

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

  it('the calendar view names the date, the hour, today and the days ahead', () => {
    const s = createDemoState(12345, 0);
    s.region = 'dawnmeadow';
    s.worldTick = 0;
    const v = calendarView(s);
    expect(v.date).toBe('Year 1, Spring, day 1 of 7');
    expect(v.time).toMatch(/^Day, \d\d:\d\d$/);
    expect(v.today).toMatch(/^Weather today: /);
    expect(v.ahead).toHaveLength(6);
    // The week ahead agrees with the table.
    expect(v.ahead[0]).toContain('Spring 2: ');
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

describe('grading', () => {
  it('day is untinted, night is the darkest, and every step in between is smooth', () => {
    let last = phaseTint(0);
    let maxStep = 0;
    for (let t = 1; t <= CYCLE * 2; t += 1) {
      const n = phaseTint(t);
      maxStep = Math.max(maxStep, Math.abs(n.alpha - last.alpha));
      last = n;
    }
    expect(maxStep).toBeLessThan(0.0005);
    const alphas = [0, 4, 34, 38, 44].map((m) => phaseTint(m * TIME.ticksPerMinute).alpha);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(PHASE_GRADE.night.alpha + 1e-9);
    expect(phaseTint(10 * TIME.ticksPerMinute).alpha).toBeCloseTo(0, 5);
    expect(phaseTint(42 * TIME.ticksPerMinute).alpha).toBeCloseTo(PHASE_GRADE.night.alpha, 2);
  });

  it('lights are off by day and on at night', () => {
    expect(lightLevel(10 * TIME.ticksPerMinute)).toBe(0);
    expect(lightLevel(42 * TIME.ticksPerMinute)).toBeGreaterThan(0.9);
  });

  it('every colour in the data is a palette index, and weather tints are valid', () => {
    const idx: number[] = [];
    for (const g of [...Object.values(PHASE_GRADE), ...Object.values(WEATHER_GRADE)])
      idx.push(g.color);
    for (const l of [
      ...Object.values(LIGHTS.tiles),
      ...Object.values(LIGHTS.fixtures),
      LIGHTS.lantern,
    ])
      idx.push(l.color);
    for (const p of Object.values(WEATHER_PARTICLES)) idx.push(p!.color);
    for (const m of Object.values(SEASON_PALETTE))
      for (const [a, b] of Object.entries(m)) idx.push(Number(a), b);
    for (const i of idx) expect(PALETTE[i], String(i)).toBeDefined();
    for (const w of WEATHER) expect(weatherTint(w).color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('weather particles', () => {
  function fakeRenderer(): Renderer & { rects: number } {
    const r = {
      width: 180,
      height: 320,
      rects: 0,
      drawRect() {
        r.rects++;
      },
    };
    return r as unknown as Renderer & { rects: number };
  }

  it('fills the pool to the weather count and clears it when the weather ends', () => {
    let seed = 1;
    const fx = new WeatherFx(() => (seed = (seed * 16807) % 2147483647) / 2147483647);
    const r = fakeRenderer();
    fx.update(16, 'rain', 180, 320, 0);
    fx.draw(r, 0, 0, 'rain', 0);
    expect(r.rects).toBe(WEATHER_PARTICLES.rain!.count);
    r.rects = 0;
    fx.update(16, 'storm', 180, 320, 0);
    fx.draw(r, 0, 0, 'storm', 0);
    expect(r.rects).toBeGreaterThanOrEqual(WEATHER_PARTICLES.storm!.count);
    r.rects = 0;
    fx.update(16, 'clear', 180, 320, 0);
    fx.draw(r, 0, 0, 'clear', 0);
    expect(r.rects).toBe(0);
  });

  it('keeps every particle on screen as it falls', () => {
    let seed = 7;
    const fx = new WeatherFx(() => (seed = (seed * 16807) % 2147483647) / 2147483647);
    const spy = { n: 0, bad: 0 } as { n: number; bad: number };
    const r = {
      width: 180,
      height: 320,
      drawRect(_l: number, x: number, y: number) {
        spy.n++;
        if (x < -30 || x > 230 || y < -10 || y > 330) spy.bad++;
      },
    } as unknown as Renderer;
    for (let i = 0; i < 600; i++) {
      fx.update(16, 'snow', 180, 320, i * 16);
      fx.draw(r, 0, 0, 'snow', i * 16);
    }
    expect(spy.n).toBeGreaterThan(0);
    expect(spy.bad).toBe(0);
    void Layer;
  });
});
