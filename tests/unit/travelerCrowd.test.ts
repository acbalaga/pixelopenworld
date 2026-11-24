import { describe, expect, it } from 'vitest';
import { SCHEDULE_SHAPES, FIXED_SESSIONS } from '../../src/content/balance/travelers';
import { validateSave } from '../../src/save/integrity';
import {
  deserializeState,
  createDemoState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import {
  chooseNext,
  crowdOf,
  newCrowd,
  onlineCount,
  routeMinutes,
  travelersSystem,
} from '../../src/sim/travelers/crowd';
import { identitiesOf, initialLife, initialLives } from '../../src/sim/travelers/generate';
import { PLACE_LIST, skillIdx } from '../../src/sim/travelers/lists';
import {
  buildCeiling,
  catchUp,
  expectedPoints,
  referencePoints,
} from '../../src/sim/travelers/progress';
import {
  dayIndexOf,
  isOnlineAt,
  MIN_PER_DAY,
  sessionAt,
  sessionsFor,
  weekdayOf,
} from '../../src/sim/travelers/schedule';
import type { TravelerIdentity } from '../../src/sim/travelers/types';
import { honestPlain, tamper } from '../support/saves';

/** Monday of a week well after the epoch, as a day index. */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);

describe('schedules', () => {
  it('gives the same sessions for the same Traveler, seed and day, and none are skipped by a reload', () => {
    const t = identitiesOf(5)[40]!;
    for (let d = 0; d < 20; d++)
      expect(sessionsFor(5, t, MON + d)).toEqual(sessionsFor(5, t, MON + d));
    const a = JSON.stringify(Array.from({ length: 14 }, (_, d) => sessionsFor(5, t, MON + d)));
    const b = JSON.stringify(Array.from({ length: 14 }, (_, d) => sessionsFor(6, t, MON + d)));
    expect(a).not.toBe(b);
  });

  it('keeps the weekday arithmetic right', () => {
    expect(weekdayOf(0)).toBe(4); // 1970-01-01 was a Thursday
    expect(weekdayOf(MON)).toBe(1);
    expect(dayIndexOf(MON * MIN_PER_DAY + 1439)).toBe(MON);
    expect(dayIndexOf(-1)).toBe(-1);
  });

  it('carries a session that runs past midnight into the next day', () => {
    const owl = identitiesOf(5).find((t) => t.schedule === 'nightowl')!;
    let found = false;
    for (let d = 0; d < 30 && !found; d++)
      for (const s of sessionsFor(5, owl, MON + d))
        if (s.end > MIN_PER_DAY) {
          const next = (MON + d + 1) * MIN_PER_DAY + (s.end - MIN_PER_DAY - 5);
          expect(isOnlineAt(5, owl, next)).toBe(true);
          expect(sessionAt(5, owl, next)).not.toBeNull();
          found = true;
          break;
        }
    expect(found).toBe(true);
  });

  it('supports a pinned session with exact times and a fixed first line (unused in M5)', () => {
    const t: TravelerIdentity = { ...identitiesOf(5)[0]!, slot: 0 };
    expect(Object.keys(FIXED_SESSIONS)).toHaveLength(0);
    const table = FIXED_SESSIONS as Record<
      number,
      { weekday: number; start: number; len: number; line: string }[]
    >;
    table[0] = [{ weekday: 3, start: 1200, len: 30, line: 'test.line' }];
    try {
      const wed = sessionsFor(5, t, MON + 2).find((s) => s.line === 'test.line');
      expect(wed).toEqual({ start: 1200, end: 1230, line: 'test.line' });
      expect(sessionsFor(5, t, MON + 3).some((s) => s.line)).toBe(false);
      expect(sessionAt(5, t, (MON + 2) * MIN_PER_DAY + 1210)?.line).toBeDefined();
    } finally {
      delete table[0];
    }
  });
});

describe('online count over a simulated real week', () => {
  const week = (seed: number, tz: number): { day: number; min: number; n: number }[] => {
    const ids = identitiesOf(seed);
    const out: { day: number; min: number; n: number }[] = [];
    for (let d = 0; d < 7; d++)
      for (let m = 0; m < MIN_PER_DAY; m += 10) {
        // Local time is trusted time plus the offset, so a different offset is only a shift.
        const local = (MON + d) * MIN_PER_DAY + m + tz;
        let n = 0;
        for (const t of ids) if (isOnlineAt(seed, t, local)) n++;
        out.push({ day: weekdayOf(MON + d), min: m, n });
      }
    return out;
  };

  it('stays between 18 and 48, peaks 20:00 to 23:00 on weekdays and troughs 03:00 to 07:00', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const w = week(seed, 0);
      const ns = w.map((s) => s.n);
      expect(Math.min(...ns), `seed ${seed} min`).toBeGreaterThanOrEqual(18);
      expect(Math.max(...ns), `seed ${seed} max`).toBeLessThanOrEqual(48);
      const hourly = (weekday: boolean): number[] =>
        Array.from({ length: 24 }, (_, hr) => {
          const xs = w.filter(
            (s) =>
              (s.day >= 1 && s.day <= 5) === weekday && s.min >= hr * 60 && s.min < hr * 60 + 60,
          );
          return xs.reduce((a, s) => a + s.n, 0) / xs.length;
        });
      for (const weekday of [true, false]) {
        const h = hourly(weekday);
        const lo = h.indexOf(Math.min(...h));
        expect(lo, `seed ${seed} trough hour`).toBeGreaterThanOrEqual(3);
        expect(lo).toBeLessThan(7);
      }
      const wd = hourly(true);
      const hi = wd.indexOf(Math.max(...wd));
      expect(hi, `seed ${seed} peak hour`).toBeGreaterThanOrEqual(20);
      expect(hi).toBeLessThan(23);
    }
  });
});

const startMs = (MON + 2) * 86_400_000 + 19 * 3_600_000;

/** Runs the crowd for `minutes` in-game minutes from `from`, one system call per minute. */
function run(s: SimState, from: number, minutes: number, events?: string[]): void {
  s.clock ??= { nowMs: from, epochMs: from - 5 * 86_400_000, tzOffsetMin: 0 };
  for (let m = 0; m < minutes; m++) {
    s.tick += 60;
    s.worldTick += 60;
    s.clock = { ...s.clock, nowMs: from + m * 60_000 };
    s.events.list.length = 0;
    travelersSystem(s);
    if (events) for (const e of s.events.list) events.push(e.type);
  }
}

describe('the crowd system', () => {
  it('sleeps with no clock, and wakes with one', () => {
    const s = createDemoState(9, 0);
    for (let i = 0; i < 200; i++) {
      s.tick++;
      s.worldTick++;
      travelersSystem(s);
    }
    expect(s.crowd).toBeUndefined();
    run(s, startMs, 5);
    expect(onlineCount(crowdOf(s))).toBeGreaterThan(10);
  });

  it('gives the same online set after a reload at the same trusted time and offset', () => {
    const s = createDemoState(9, 0);
    run(s, startMs, 30);
    const before = [...crowdOf(s).online];
    const reloaded = deserializeState(serializeState(s));
    reloaded.worldTick = s.worldTick;
    reloaded.tick = s.tick;
    run(reloaded, startMs + 29 * 60_000, 1);
    expect([...crowdOf(reloaded).online]).toEqual(before);
  });

  it('keeps the same run byte-identical (same seed, same inputs)', () => {
    const a = createDemoState(21, 0);
    const b = createDemoState(21, 0);
    run(a, startMs, 90);
    run(b, startMs, 90);
    expect(serializeState(a)).toBe(serializeState(b));
  });

  it('logs people in and out and moves them, and everyone stays on a real place', () => {
    const s = createDemoState(9, 0);
    const seen: string[] = [];
    run(s, startMs, 6 * 60, seen);
    for (const type of ['travelerLoggedIn', 'travelerLoggedOut', 'travelerArrived', 'travelerSold'])
      expect(seen, type).toContain(type);
    for (const l of s.travelers) expect(PLACE_LIST[l.place]).toBeDefined();
    for (const l of s.travelers) expect(l.coin).toBeGreaterThanOrEqual(0);
  });

  it('skips a promoted Traveler', () => {
    const s = createDemoState(9, 0);
    run(s, startMs, 20);
    const c = crowdOf(s);
    const slot = c.online.findIndex((v) => v === 1);
    const place = s.travelers[slot]!.place;
    const doing = JSON.stringify(c.doing[slot]);
    c.promoted[slot] = 1;
    run(s, startMs + 20 * 60_000, 15);
    expect(c.online[slot]).toBe(1);
    expect(JSON.stringify(c.doing[slot])).toBe(doing);
    expect(s.travelers[slot]!.place).toBe(place);
  });

  it('turns a route into minutes from the places table', () => {
    const square = PLACE_LIST.indexOf('hearthford.square');
    const quarry = PLACE_LIST.indexOf('stonecrop.quarry');
    expect(routeMinutes(square, square)).toBe(0);
    expect(routeMinutes(square, quarry)).toBeGreaterThanOrEqual(1);
    expect(routeMinutes(square, quarry)).toBe(routeMinutes(quarry, square));
  });
});

describe('a crafter low on stock', () => {
  it('gathers or buys before it crafts', () => {
    const ids = identitiesOf(9);
    const t = ids[18]!; // Petra.k, a Crafter on Tinkering and Smithing
    expect(t.archetype).toBe('Crafter');
    const s = createDemoState(9, 0);
    s.worldTick = 4 * 1800;
    const crowd = newCrowd(9);
    s.travelers[18]!.coin = 5000;
    // Push the build up so the tier gate allows smithing recipes beyond tier 1.
    const kinds: Record<string, number> = {};
    for (let i = 0; i < 400; i++) {
      const d = chooseNext(s, crowd, t);
      kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
    }
    // Empty-handed: never a craft. The plan is gather or trade (buy) for the missing input.
    expect(kinds.craft ?? 0).toBe(0);
    expect((kinds.gather ?? 0) + (kinds.trade ?? 0)).toBeGreaterThan(0);
    // With a full bin it crafts.
    for (const item of [
      'item.copper_ore',
      'item.coal',
      'item.iron_ore',
      'item.oak_log',
      'item.ash_log',
    ])
      crowd.stock[18]![item] = 40;
    for (const item of ['item.copper_ingot', 'item.iron_ingot']) crowd.stock[18]![item] = 40;
    let crafted = 0;
    for (let i = 0; i < 400; i++) if (chooseNext(s, crowd, t).kind === 'craft') crafted++;
    expect(crafted).toBeGreaterThan(0);
  });
});

describe('progress', () => {
  const newbie = (): TravelerIdentity => ({
    ...identitiesOf(1).find((t) => t.archetype === 'Newbie' && t.slot >= 24)!,
    pace: 0.7,
    plateau: 85,
  });

  it('puts a Newbie behind the reference player at 5 hours and ahead of them in the focus skill at 80', () => {
    const t = newbie();
    const days = (h: number): number => h / 2; // two play hours per real day
    expect(expectedPoints(t, 0, 5, days(5))).toBeLessThan(referencePoints(5));
    expect(expectedPoints(t, 0, 80, days(80))).toBeGreaterThan(referencePoints(80));
  });

  it('keeps every focus skill at or under its plateau, and never moves backward in time', () => {
    for (const t of identitiesOf(3)) {
      let last = -1;
      for (const h of [0, 1, 5, 20, 80, 200]) {
        t.focus.forEach((_, k) =>
          expect(expectedPoints(t, k, h, h)).toBeLessThanOrEqual(t.plateau),
        );
        const v = expectedPoints(t, 0, h, h / 2);
        if (t.archetype !== 'Veteran' && t.archetype !== 'Casual')
          expect(v).toBeGreaterThanOrEqual(last);
        last = v;
      }
    }
  });

  it('starts lives at the starting value of the formula', () => {
    for (const t of identitiesOf(3)) {
      const life = initialLife(t);
      t.focus.forEach((f, k) => {
        const have = life.build.find(([s]) => s === skillIdx(f))?.[1] ?? 0;
        expect(have).toBe(expectedPoints(t, k, 0, 0));
      });
    }
  });

  it('catches every Traveler up to expected(t) over a 30 day gap, and reports at most 6 events', () => {
    const lives = initialLives(4);
    const away = catchUp(4, lives, 40, 30);
    expect(away.length).toBeLessThanOrEqual(6);
    expect(away.length).toBeGreaterThan(0);
    for (const t of identitiesOf(4))
      t.focus.forEach((f, k) => {
        const have = lives[t.slot]!.build.find(([s]) => s === skillIdx(f))?.[1] ?? 0;
        expect(have).toBe(expectedPoints(t, k, 40, 30));
      });
    // A second pass changes nothing.
    expect(catchUp(4, lives, 40, 30)).toEqual([]);
  });

  it('runs the login catch-up once, on the first clocked tick', () => {
    const s = createDemoState(4, 0);
    s.tick = 40 * 3600 * 30;
    const events: string[] = [];
    run(s, startMs, 3, events);
    expect(events.filter((e) => e === 'travelersAway')).toHaveLength(1);
  });
});

describe('the build integrity rule', () => {
  it('passes an honest crowd and flags a Traveler built past the formula', () => {
    expect(validateSave(honestPlain()).reasons.map((r) => r.code)).not.toContain('TRAVELER_BUILD');
    const cheat = tamper(honestPlain(), (s) => {
      s.travelers[30]!.build.push([skillIdx('skill.blades'), 99]);
      s.travelers[30]!.build.sort((a, b) => a[0] - b[0]);
    });
    expect(validateSave(cheat).reasons.map((r) => r.code)).toContain('TRAVELER_BUILD');
    // A focus skill pushed past its ceiling is flagged too.
    const t = identitiesOf(6)[40]!;
    const over = tamper(honestPlain(), (s) => {
      const i = skillIdx(t.focus[0]!);
      const life = s.travelers[40]!;
      const e = life.build.find(([k]) => k === i);
      if (e) e[1] = 100;
      else life.build.push([i, 100]);
      life.build.sort((a, b) => a[0] - b[0]);
    });
    expect(validateSave(over).reasons.map((r) => r.code)).toContain('TRAVELER_BUILD');
  });

  it('keeps the ceiling above the formula by the band', () => {
    expect(buildCeiling(10)).toBe(10 + 3);
    expect(Object.keys(SCHEDULE_SHAPES)).toHaveLength(10);
  });
});
