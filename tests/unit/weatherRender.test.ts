import { describe, expect, it } from 'vitest';
import { WEATHER, TIME } from '../../src/content/balance/time';
import { PALETTE } from '../../src/content/sprites/palette';
import {
  LIGHTS,
  PHASE_GRADE,
  SEASON_PALETTE,
  WEATHER_GRADE,
  WEATHER_PARTICLES,
} from '../../src/content/world/atmosphere';
import { lightLevel, phaseTint, weatherTint } from '../../src/render/grade';
import type { Renderer } from '../../src/render/renderer';
import { WeatherFx } from '../../src/render/weatherFx';
import { createDemoState } from '../../src/sim/state';
import { calendarView } from '../../src/ui/menu/model';

const CYCLE = TIME.phases.reduce((n, p) => n + p.minutes, 0) * TIME.ticksPerMinute;

describe('the calendar view', () => {
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
      drawMarks(_l: number, _xs: unknown, _ys: unknown, n: number) {
        r.rects += n;
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
      drawRect() {},
      drawMarks(_l: number, xs: Float32Array, ys: Float32Array, n: number) {
        for (let i = 0; i < n; i++) {
          spy.n++;
          const x = xs[i] as number;
          const y = ys[i] as number;
          if (x < -30 || x > 230 || y < -10 || y > 330) spy.bad++;
        }
      },
    } as unknown as Renderer;
    for (let i = 0; i < 600; i++) {
      fx.update(16, 'snow', 180, 320, i * 16);
      fx.draw(r, 0, 0, 'snow', i * 16);
    }
    expect(spy.n).toBeGreaterThan(0);
    expect(spy.bad).toBe(0);
  });
});
