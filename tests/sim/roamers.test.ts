import { describe, expect, it } from 'vitest';
import { ROAMERS } from '../../src/content/creatures/roamers';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { kill } from '../../src/sim/combat/fighter';
import { getComp } from '../../src/sim/kernel/entities';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { createSpawner } from '../../src/sim/systems/spawner';
import { routeAt } from '../../src/sim/systems/roamers';
import { DAY_MINUTES, dayIndex, minuteOfDay } from '../../src/sim/time';
import { TIME } from '../../src/content/balance/time';

const H = ROAMERS['creature.hollowhorn']!;
const OPEN = { solidAt: (): number => 0 };

describe('the daily route (M4-05)', () => {
  it('stands at each stop from its arrival to its departure', () => {
    for (const s of H.stops) {
      expect(routeAt(H, s.arrive)).toEqual({ x: s.x, y: s.y });
      expect(routeAt(H, (s.arrive + s.leave) / 2)).toEqual({ x: s.x, y: s.y });
    }
  });

  it('walks in a straight line between stops, at a steady pace', () => {
    const a = H.stops[0]!;
    const b = H.stops[1]!;
    const mid = routeAt(H, (a.leave + b.arrive) / 2);
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2);
    expect(mid.y).toBeCloseTo((a.y + b.y) / 2);
    const q = routeAt(H, a.leave + (b.arrive - a.leave) / 4);
    expect(q.x).toBeCloseTo(a.x + (b.x - a.x) / 4);
  });

  it('carries on past midnight of the day clock, and is the same every day', () => {
    const last = H.stops[H.stops.length - 1]!;
    const first = H.stops[0]!;
    // From the last stop's leave (46) to the first arrival (2 of the next day, 50).
    const midnight = routeAt(H, DAY_MINUTES);
    expect(midnight.x).toBeGreaterThan(Math.min(last.x, first.x));
    expect(midnight.x).toBeLessThan(Math.max(last.x, first.x));
    for (let m = 0; m < DAY_MINUTES; m += 1.5) {
      expect(routeAt(H, m + DAY_MINUTES)).toEqual(routeAt(H, m));
      expect(routeAt(H, m - DAY_MINUTES)).toEqual(routeAt(H, m));
    }
  });

  it('keeps in the schedule with no jumps: it never moves faster than a walk', () => {
    let prev = routeAt(H, 0);
    for (let m = 0.1; m < DAY_MINUTES + 0.1; m += 0.1) {
      const p = routeAt(H, m);
      // Under 6 tiles a minute, the longest leg the data holds.
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(0.7);
      prev = p;
    }
  });
});

/** The world tick at `minute` of day `day` (0 is the first). */
const tickAt = (minute: number, day = 0): number =>
  Math.round((day * DAY_MINUTES + minute - TIME.startMinute) * TIME.ticksPerMinute);

function rig(minute: number): {
  s: SimState;
  me: number;
  sp: number;
  run: (n: number, at?: number) => void;
  now: () => number;
} {
  const s = createDemoState(4, 0);
  s.world = OPEN;
  s.region = 'dawnmeadow';
  // The avatar waits far away: the boss only has to follow its schedule.
  const f = feetAt(120, 120);
  const me = createAvatar(s, f.x, f.y);
  const sp = createSpawner(s, 'spawner.hollowhorn', 19 * 16 + 8, 54 * 16 + 14);
  let wt = tickAt(minute);
  const run = (n: number, at?: number): void => {
    if (at !== undefined) wt = at;
    for (let i = 0; i < n; i++) stepWorld(s, me, { commands: [], worldTick: wt++ });
  };
  return { s, me, sp, run, now: () => wt };
}

const hornOf = (s: SimState, sp: number): number => getComp(s.entities, sp, 'spawner')!.members[0]!;
const tilesOf = (s: SimState, id: number): { x: number; y: number } => {
  const p = getComp(s.entities, id, 'pos')!;
  return { x: p.x / 256 / 16, y: p.y / 256 / 16 };
};

describe('Hollowhorn on its route', () => {
  it('appears where the schedule puts it, whichever hour the spawner wakes', () => {
    const seen = new Set<string>();
    for (const minute of [3, 11, 30, 38, 45]) {
      const { s, sp, run, now } = rig(minute);
      run(1);
      const at = tilesOf(s, hornOf(s, sp));
      const want = routeAt(H, minuteOfDay(now() - 1));
      seen.add(`${Math.round(want.x)},${Math.round(want.y)}`);
      expect(Math.hypot(at.x - want.x, at.y - want.y), `minute ${minute}`).toBeLessThan(1.5);
    }
    // Five different hours, five different places.
    expect(seen.size).toBe(5);
  });

  it('follows the route as the day goes by, and does not drift from it', () => {
    const { s, sp, run, now } = rig(3);
    run(1);
    const id = hornOf(s, sp);
    let farthest = 0;
    let moved = 0;
    const start = tilesOf(s, id);
    // Eight minutes of the day, through the walk from the first stop to the second.
    for (let i = 0; i < 8 * TIME.ticksPerMinute; i++) {
      run(1);
      const at = tilesOf(s, id);
      const want = routeAt(H, minuteOfDay(now() - 1));
      farthest = Math.max(farthest, Math.hypot(at.x - want.x, at.y - want.y));
      moved = Math.max(moved, Math.hypot(at.x - start.x, at.y - start.y));
    }
    expect(getComp(s.entities, id, 'fighter')?.state).not.toBe('dead');
    // It walked, trailing its spot by a few tiles (a wanderer drifts home from a third of its
    // leash), and never lost it.
    expect(moved).toBeGreaterThan(5);
    expect(farthest).toBeLessThan(10);
  });

  it('is not led off the route by a fight: its home stays put while it has a target', () => {
    const { s, me, sp, run } = rig(3);
    run(1);
    const id = hornOf(s, sp);
    const ai = getComp(s.entities, id, 'ai')!;
    ai.target = me;
    ai.state = 'approach';
    const home = { ...ai.home };
    run(1, tickAt(9));
    expect(ai.home).toEqual(home);
  });

  it('once killed, stays gone for the rest of the day and returns the next', () => {
    const { s, sp, run } = rig(10);
    run(1);
    kill(s, hornOf(s, sp));
    run(4);
    const sc = getComp(s.entities, sp, 'spawner')!;
    expect(sc.members).toHaveLength(0);
    expect(sc.clearedDay).toBe(dayIndex(tickAt(10)));
    run(4, tickAt(13));
    expect(sc.members).toHaveLength(0);
    run(4, tickAt(10, 1));
    expect(sc.members).toHaveLength(1);
  });
});
