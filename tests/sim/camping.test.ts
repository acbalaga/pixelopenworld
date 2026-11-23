import { describe, expect, it } from 'vitest';
import { SKILLS_BALANCE } from '../../src/content/balance/skills';
import { TIME } from '../../src/content/balance/time';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { emit } from '../../src/sim/kernel/events';
import { Dir } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { skillsSystem } from '../../src/sim/systems/skills';
import { trialsSystem } from '../../src/sim/systems/trials';
import { offerTrial, pointsOf, trialPassed, xpToNext } from '../../src/sim/skills';

const SV = SKILLS_BALANCE.survival;
const MIN = TIME.ticksPerMinute;
const DAY = 48 * MIN;
const survivalXp = (s: SimState): number => s.ledger.xpEarned['skill.survival'] ?? 0;

interface Rig {
  s: SimState;
  me: number;
  /** Runs `n` ticks with no command, at world tick `s.tick + offset`. */
  idle(n: number): void;
  offset: number;
}

function rig(at: [number, number] = [20, 20], camp: [number, number] | null = [21, 20]): Rig {
  const s = createDemoState(31, 0);
  s.world = { solidAt: () => 0 };
  const f = feetAt(at[0], at[1]);
  const me = createAvatar(s, f.x, f.y);
  if (camp) spawnFixture(s, 'fixture.rest_point', camp[0], camp[1]);
  const r: Rig = {
    s,
    me,
    offset: 0,
    idle(n) {
      for (let i = 0; i < n; i++)
        stepWorld(s, me, { commands: [], worldTick: s.tick + 1 + r.offset });
    },
  };
  return r;
}

describe('camping (Survival, POW-M4-23C)', () => {
  it('pays each full minute by day, and nothing before it', () => {
    const r = rig();
    r.idle(MIN - 5);
    expect(survivalXp(r.s)).toBe(0);
    r.idle(10);
    expect(survivalXp(r.s)).toBe(SV.campXpPerMinute);
    r.idle(MIN);
    expect(survivalXp(r.s)).toBe(2 * SV.campXpPerMinute);
  });

  it('pays nothing away from a camp', () => {
    const r = rig([20, 20], [40, 40]);
    r.idle(2 * MIN);
    expect(survivalXp(r.s)).toBe(0);
  });

  it('pays nothing indoors', () => {
    // The slice cave, room a: not outdoors.
    const r = rig([10, 105], [11, 105]);
    r.idle(2 * MIN);
    expect(survivalXp(r.s)).toBe(0);
  });

  it('pays nothing inside a settlement, and pays just outside it', () => {
    const inside = rig([170, 175], [171, 175]);
    inside.s.region = 'dawnmeadow';
    inside.idle(2 * MIN);
    expect(survivalXp(inside.s)).toBe(0);
    const outside = rig([140, 235], [141, 235]);
    outside.s.region = 'dawnmeadow';
    outside.idle(MIN + 5);
    expect(survivalXp(outside.s)).toBe(SV.campXpPerMinute);
  });

  it('pays nothing while dead', () => {
    const r = rig();
    // Held dead: the game would respawn the avatar after a while.
    for (let i = 0; i < 2 * MIN; i++) {
      r.s.entities.comps.fighter[r.me]!.state = 'dead';
      r.idle(1);
    }
    expect(survivalXp(r.s)).toBe(0);
  });

  it('drops the partial minute on a move', () => {
    const r = rig();
    r.idle(MIN - 300);
    stepWorld(r.s, r.me, { commands: [{ type: 'move', dir: Dir.W }], worldTick: r.s.tick + 1 });
    stepWorld(r.s, r.me, { commands: [{ type: 'move', dir: null }], worldTick: r.s.tick + 1 });
    r.idle(MIN - 300);
    expect(survivalXp(r.s)).toBe(0);
    r.idle(400);
    expect(survivalXp(r.s)).toBe(SV.campXpPerMinute);
  });

  it('drops the partial minute on a hit', () => {
    const r = rig();
    r.idle(MIN - 300);
    emit(r.s.events, {
      type: 'damageDealt',
      src: 99,
      dst: r.me,
      amount: 2,
      crit: false,
      bonus: false,
      heavy: false,
      tag: 'blades',
    });
    skillsSystem(r.s);
    r.idle(400);
    expect(survivalXp(r.s)).toBe(0);
  });

  it('stops paying at the daily cap, says so once, and pays again the next day', () => {
    const r = rig();
    const seen: string[] = [];
    const watch = (): void => {
      for (const e of r.s.events.list) seen.push(e.type);
    };
    for (let m = 0; m < SV.campMinutesPerDay + 4; m++) {
      for (let i = 0; i < MIN; i++) {
        r.idle(1);
        watch();
      }
    }
    expect(survivalXp(r.s)).toBe(SV.campMinutesPerDay * SV.campXpPerMinute);
    expect(seen.filter((t) => t === 'campSpent')).toHaveLength(1);
    expect(seen.filter((t) => t === 'campSettled')).toHaveLength(1);
    r.offset += DAY;
    r.idle(MIN + 5);
    expect(survivalXp(r.s)).toBe((SV.campMinutesPerDay + 1) * SV.campXpPerMinute);
  });

  it('keeps the minutes of each camp apart', () => {
    const r = rig([20, 20], [21, 20]);
    spawnFixture(r.s, 'fixture.rest_point', 60, 60);
    r.idle(SV.campMinutesPerDay * MIN + 10);
    const first = survivalXp(r.s);
    expect(first).toBe(SV.campMinutesPerDay * SV.campXpPerMinute);
    const f = feetAt(60, 61);
    const p = r.s.entities.comps.pos[r.me]!;
    p.x = f.x;
    p.y = f.y;
    r.idle(MIN + 10);
    expect(survivalXp(r.s)).toBe(first + SV.campXpPerMinute);
  });
});

describe('sleeping outdoors pays a lump once an in-game hour', () => {
  it('pays, then not in the same hour, then pays in the next', () => {
    const r = rig(undefined, null);
    const sleep = (): void => {
      emit(r.s.events, { type: 'sleptOutdoors', who: r.me, wake: null });
      skillsSystem(r.s);
    };
    r.s.worldTick = 10;
    sleep();
    expect(survivalXp(r.s)).toBe(SV.sleepOutdoorsXp);
    r.s.worldTick = TIME.hourTicks - 10;
    sleep();
    expect(survivalXp(r.s)).toBe(SV.sleepOutdoorsXp);
    r.s.worldTick = TIME.hourTicks + 10;
    sleep();
    expect(survivalXp(r.s)).toBe(2 * SV.sleepOutdoorsXp);
  });
});

describe('the Survival Trial at rank 14', () => {
  it('is passed by sleeping outdoors twice, and the full bar pays out to rank 15', () => {
    const r = rig(undefined, null);
    const sk = r.s.entities.comps.skills[r.me]!;
    sk.points['skill.survival'] = 14;
    sk.xp['skill.survival'] = xpToNext(14);
    expect(offerTrial(r.s, r.me, 'trial.survival.15')).toBe(true);
    for (let i = 0; i < 2; i++) {
      expect(trialPassed(sk, 'skill.survival', 15)).toBe(false);
      r.s.tick++;
      r.s.events.list.length = 0;
      emit(r.s.events, { type: 'sleptOutdoors', who: r.me, wake: null });
      trialsSystem(r.s);
    }
    expect(trialPassed(sk, 'skill.survival', 15)).toBe(true);
    expect(pointsOf(r.s, r.me, 'skill.survival')).toBeGreaterThanOrEqual(15);
  });
});
