import { describe, expect, it } from 'vitest';
import { SKILLS_BALANCE as SB } from '../../src/content/balance/skills';
import { STATUS_BALANCE as RB } from '../../src/content/balance/status';
import { WORLD_TUNABLES } from '../../src/content/balance/world';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnEnemy } from '../../src/sim/combat/enemy';
import { isDark } from '../../src/sim/combat/temperament';
import { emit } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { bankOfflineRest } from '../../src/sim/rest';
import { createDemoState, type SimState } from '../../src/sim/state';
import { hasStatus } from '../../src/sim/mods';
import { sleep } from '../../src/sim/systems/fixtures';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { skillsSystem } from '../../src/sim/systems/skills';
import { dayIndex } from '../../src/sim/time';

const BLADES = 'skill.blades';

/** The XP a skill has earned in all, from its points and the bank. */
function earned(s: SimState, me: number): number {
  const k = s.entities.comps.skills[me]!;
  return k.xp[BLADES] ?? 0;
}

function dummyArena(points = 0) {
  const s = createDemoState(3, 0);
  const me = createAvatar(s, feetAt(10, 10).x, feetAt(10, 10).y);
  const dummy = spawnEnemy(s, 'creature.training_dummy', 11 * 16, 10 * 16);
  s.entities.comps.skills[me]!.points[BLADES] = points;
  const hit = (n: number): void => {
    for (let i = 0; i < n; i++) {
      s.events.list.length = 0;
      emit(s.events, {
        type: 'damageDealt',
        src: me,
        dst: dummy,
        amount: 5,
        tag: 'blades',
      } as never);
      skillsSystem(s);
    }
  };
  return { s, me, dummy, hit };
}

describe('training dummy XP limiter', () => {
  it('pays only up to the daily budget, however many hits, and counts what it paid', () => {
    const { s, me, hit } = dummyArena();
    hit(1);
    const one = earned(s, me);
    expect(one).toBeGreaterThan(0);
    hit(500);
    const k = s.entities.comps.skills[me]!;
    expect(k.dummy!.xp[BLADES]).toBeLessThanOrEqual(SB.dummyDailyXp);
    expect(k.dummy!.xp[BLADES]).toBe(SB.dummyDailyXp);
    const after = earned(s, me) + (k.points[BLADES] ?? 0) * 1000;
    hit(500);
    expect(earned(s, me) + (k.points[BLADES] ?? 0) * 1000).toBe(after);
  });

  it('the budget comes back on the next in-game day', () => {
    const { s, me, hit } = dummyArena();
    hit(500);
    const k = s.entities.comps.skills[me]!;
    expect(k.dummy!.xp[BLADES]).toBe(SB.dummyDailyXp);
    const today = dayIndex(s.worldTick);
    while (dayIndex(s.worldTick) === today) s.worldTick += 5000;
    hit(500);
    expect(k.dummy!.day).toBe(dayIndex(s.worldTick));
    expect(k.dummy!.xp[BLADES]).toBe(SB.dummyDailyXp);
  });

  it('pays nothing from the ceiling up', () => {
    const { s, me, hit } = dummyArena(SB.dummyXpUntil);
    const before = earned(s, me);
    hit(300);
    expect(earned(s, me)).toBe(before);
    expect(s.entities.comps.skills[me]!.points[BLADES]).toBe(SB.dummyXpUntil);
  });

  it('a real creature is not limited', () => {
    const s = createDemoState(3, 0);
    const me = createAvatar(s, feetAt(10, 10).x, feetAt(10, 10).y);
    const mob = spawnEnemy(s, 'creature.mossling', 11 * 16, 10 * 16);
    s.entities.comps.skills[me]!.points[BLADES] = SB.dummyXpUntil;
    const before = earned(s, me);
    for (let i = 0; i < 20; i++) {
      s.events.list.length = 0;
      emit(s.events, { type: 'damageDealt', src: me, dst: mob, amount: 5, tag: 'blades' } as never);
      skillsSystem(s);
    }
    expect(earned(s, me)).toBeGreaterThan(before);
  });
});

describe('rest', () => {
  function bed() {
    const s = createDemoState(4, 0);
    const me = createAvatar(s, feetAt(10, 10).x, feetAt(10, 10).y);
    spawnFixture(s, 'fixture.bed', 10, 10);
    return { s, me };
  }
  const left = (s: SimState, me: number): number =>
    (s.entities.comps.statuses[me] ?? []).find((x) => x.id === 'rested')?.until ?? 0;

  it('sleeping in the dark keeps Rested longer than sleeping by day', () => {
    const night = bed();
    let t = 0;
    while (!isDark(t)) t += 100;
    night.s.worldTick = t;
    expect(sleep(night.s, night.me)).toBe(true);
    const day = bed();
    let d = 0;
    while (isDark(d)) d += 100;
    day.s.worldTick = d;
    expect(sleep(day.s, day.me)).toBe(true);
    expect(left(night.s, night.me) - night.s.tick).toBe(RB.restedNightTicks);
    expect(left(day.s, day.me) - day.s.tick).toBe(RB.restedTicks);
    expect(RB.restedNightTicks).toBeGreaterThan(RB.restedTicks);
  });

  it('logging out in a bed banks Rested for the time away, capped, and clears the mark', () => {
    const { s, me } = bed();
    sleep(s, me);
    s.entities.comps.statuses[me] = [];
    const a = s.entities.comps.avatar[me]!;
    expect(a.bedAt).toBeDefined();
    const away = RB.restedOfflineMinAway * 4;
    const got = bankOfflineRest(s, me, away);
    expect(got).toBe(Math.floor((away * RB.restedOfflinePct) / 100));
    expect(hasStatus(s, me, 'rested')).toBe(true);
    expect(a.bedAt).toBeUndefined();
    // A very long absence stops at the cap.
    sleep(s, me);
    s.entities.comps.statuses[me] = [];
    expect(bankOfflineRest(s, me, 10_000_000)).toBe(RB.restedOfflineCap);
  });

  it('banks nothing for a short stay, for a save away from the bed, or with no bed mark', () => {
    const short = bed();
    sleep(short.s, short.me);
    short.s.entities.comps.statuses[short.me] = [];
    expect(bankOfflineRest(short.s, short.me, RB.restedOfflineMinAway - 1)).toBe(0);
    expect(hasStatus(short.s, short.me, 'rested')).toBe(false);

    const moved = bed();
    sleep(moved.s, moved.me);
    moved.s.entities.comps.statuses[moved.me] = [];
    moved.s.entities.comps.pos[moved.me]!.x += px(WORLD_TUNABLES.bedReachPx + 20);
    expect(bankOfflineRest(moved.s, moved.me, 100_000)).toBe(0);

    const none = bed();
    expect(bankOfflineRest(none.s, none.me, 100_000)).toBe(0);
  });

  it('does not shorten a Rested the avatar already has, and never moves the clock', () => {
    const { s, me } = bed();
    sleep(s, me);
    const before = left(s, me);
    s.worldTick = 12345;
    bankOfflineRest(s, me, RB.restedOfflineMinAway);
    expect(left(s, me)).toBe(before);
    expect(s.worldTick).toBe(12345);
  });
});
