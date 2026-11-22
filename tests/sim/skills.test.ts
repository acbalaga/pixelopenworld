import { SKILLS } from '../../src/content/skills';
import { describe, expect, it } from 'vitest';
import { COMBAT as C } from '../../src/content/balance/combat';
import { SKILLS_BALANCE as B } from '../../src/content/balance/skills';
import { TIME } from '../../src/content/balance/time';
import { PENDING_SKILLS, registerSkill, unregisterSkill, trialKey } from '../../src/content/skills';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnEnemy } from '../../src/sim/combat/enemy';
import type { SimEvent } from '../../src/sim/kernel/events';
import {
  addXp,
  challengePct,
  masteryName,
  offerTrial,
  passTrial,
  pendingTrial,
  pointsOf,
  xpToNext,
} from '../../src/sim/skills';
import { createDemoState, hashState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { skillsSystem } from '../../src/sim/systems/skills';
import { trialsSystem } from '../../src/sim/systems/trials';
import { dayPhase } from '../../src/sim/time';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};

function world(): { s: SimState; me: number } {
  const s = createDemoState(7, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  return { s, me: createAvatar(s, f.x, f.y) };
}

/** Sends events to the skills system as if the other systems had produced them this tick. */
function feed(s: SimState, ...evs: SimEvent[]): void {
  s.events.list.length = 0;
  s.events.list.push(...evs);
  // The order the world runs them in: Trials first, so a pass releases banked XP this tick.
  trialsSystem(s);
  skillsSystem(s);
}

const sk = (s: SimState, me: number) => s.entities.comps.skills[me]!;
const gather = (me: number, item = 'item.herb', tier = 1): SimEvent => ({
  type: 'gathered',
  id: me,
  tag: 'foraging',
  item,
  tier,
  qty: 1,
});
const ofType = <T extends SimEvent['type']>(s: SimState, t: T) =>
  s.events.list.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);

/** Everything a skill has earned: XP spent on its points plus what is waiting. */
function earned(s: SimState, me: number, skill: string): number {
  let n = sk(s, me).xp[skill] ?? 0;
  for (let p = 0; p < pointsOf(s, me, skill); p++) n += xpToNext(p);
  return n;
}

/** Gives a skill points directly, as a save would. */
function setPoints(s: SimState, me: number, skill: string, points: number): void {
  sk(s, me).points[skill] = points;
}

/** The base XP of a skill's first source, so tuning it does not break the tests. */
const baseOf = (skill: string): number => (SKILLS[skill]?.sources[0] as { base: number }).base;
const lumpOf = (skill: string): number =>
  (SKILLS[skill]?.sources[0] as { firstTime: number }).firstTime;

describe('XP curve and challenge', () => {
  it('xp to next point grows smoothly with points', () => {
    let prev = xpToNext(0);
    for (let p = 1; p < 100; p++) {
      const x = xpToNext(p);
      expect(x).toBeGreaterThan(prev);
      expect(x - prev).toBeLessThan(80);
      prev = x;
    }
  });
  it('pays 100% at par, falls to the floor far below, and more above, capped', () => {
    const par = B.challenge.parRank[3] as number;
    expect(challengePct(3, par)).toBe(100);
    expect(challengePct(3, par + 5)).toBeLessThan(100);
    expect(challengePct(3, par + 5)).toBeGreaterThan(B.challenge.floorPct);
    expect(challengePct(3, par + B.challenge.farBelowPoints)).toBe(B.challenge.floorPct);
    expect(challengePct(3, par + 90)).toBe(B.challenge.floorPct);
    expect(challengePct(3, par - 4)).toBe(100 + 4 * B.challenge.abovePctPerPoint);
    expect(challengePct(3, 0)).toBe(B.challenge.ceilPct);
  });
  it('a tier 1 target is at the floor by rank 15', () => {
    expect(challengePct(1, 15)).toBe(B.challenge.floorPct);
    expect(challengePct(1, 0)).toBe(100);
  });
  it('names the mastery rank for points', () => {
    expect(masteryName(0)).toBe('Novice');
    expect(masteryName(14)).toBe('Novice');
    expect(masteryName(15)).toBe('Apprentice');
    expect(masteryName(100)).toBe('Grandmaster');
  });
});

describe('XP mapping from sim events', () => {
  it('pays Blades for sword hits, through the real combat loop', () => {
    const { s, me } = world();
    const p = s.entities.comps.pos[me]!;
    spawnEnemy(s, 'creature.mossling', p.x / 256 + 16, p.y / 256);
    stepWorld(s, me, { commands: [{ type: 'move', dir: 2 }] });
    stepWorld(s, me, { commands: [{ type: 'move', dir: null }] });
    const seen: SimEvent[] = [];
    for (let i = 0; i < 60; i++) {
      stepWorld(s, me, { commands: [] });
      seen.push(...s.events.list);
    }
    expect(seen.some((e) => e.type === 'damageDealt')).toBe(true);
    const xp = seen.filter((e) => e.type === 'skillXp');
    expect(xp.length).toBeGreaterThan(0);
    expect(xp.every((e) => e.type === 'skillXp' && e.skill === 'skill.blades')).toBe(true);
    expect(earned(s, me, 'skill.blades')).toBeGreaterThan(0);
  });
  it('pays Ember for a bolt, Evasion for a dodge, Foraging, Cooking and Athletics', () => {
    const { s, me } = world();
    const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
    feed(s, {
      type: 'damageDealt',
      src: me,
      dst: foe,
      amount: 5,
      crit: false,
      bonus: false,
      heavy: false,
      tag: 'ember',
    });
    feed(s, { type: 'dodged', src: foe, dst: me });
    feed(s, gather(me));
    feed(s, {
      type: 'crafted',
      id: me,
      tag: 'cooking',
      recipe: 'recipe.stew',
      tier: 1,
      item: 'item.hearty_stew',
      qty: 1,
      quality: 0,
      source: 'manual',
    });
    expect(earned(s, me, 'skill.ember')).toBe(10);
    expect(earned(s, me, 'skill.evasion')).toBe(12);
    expect(earned(s, me, 'skill.foraging')).toBe(
      baseOf('skill.foraging') + lumpOf('skill.foraging'),
    );
    expect(earned(s, me, 'skill.cooking')).toBe(baseOf('skill.cooking') + lumpOf('skill.cooking'));
    expect(earned(s, me, 'skill.blades')).toBe(0);
  });
  it('ignores events from other fighters and tags nobody maps', () => {
    const { s, me } = world();
    const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
    feed(s, {
      type: 'damageDealt',
      src: foe,
      dst: me,
      amount: 5,
      crit: false,
      bonus: false,
      heavy: false,
      tag: 'creature',
    });
    feed(s, {
      type: 'damageDealt',
      src: me,
      dst: foe,
      amount: 5,
      crit: false,
      bonus: false,
      heavy: false,
      tag: 'nothing',
    });
    feed(s, { type: 'dodged', src: me, dst: foe });
    expect(sk(s, me).xp).toEqual({});
  });
  it('pays Athletics for distance sprinted, and not for walking or teleporting', () => {
    const { s, me } = world();
    const p = s.entities.comps.pos[me]!;
    const a = s.entities.comps.avatar[me]!;
    feed(s);
    a.sprinting = false;
    p.x += 256 * 4;
    feed(s);
    expect(earned(s, me, 'skill.athletics')).toBe(0);
    a.sprinting = true;
    for (let i = 0; i < 16; i++) {
      p.x += 256 * 4;
      feed(s);
    }
    // 64 px run at 32 px a step.
    expect(earned(s, me, 'skill.athletics')).toBe(2 * 3);
    p.x += 256 * 400;
    feed(s);
    expect(earned(s, me, 'skill.athletics')).toBe(2 * 3);
  });
  it('keeps the weapon rank in step with the weapon skill', () => {
    const { s, me } = world();
    setPoints(s, me, 'skill.blades', 12);
    feed(s);
    expect(s.entities.comps.combatant[me]!.skillRank).toBe(12);
  });
});

describe('first-time bonus', () => {
  it('fires once per item gathered, then pays the plain rate', () => {
    const { s, me } = world();
    const base = baseOf('skill.foraging');
    feed(s, gather(me, 'item.herb'));
    const first = earned(s, me, 'skill.foraging');
    expect(first).toBe(base + lumpOf('skill.foraging'));
    // The same item again pays the plain rate: no lump, and at most the base (the rate falls as
    // the skill rises past a tier 1 target).
    feed(s, gather(me, 'item.herb'));
    const second = earned(s, me, 'skill.foraging') - first;
    expect(second).toBeGreaterThan(0);
    expect(second).toBeLessThanOrEqual(base);
    // A new item carries its own lump.
    const before = earned(s, me, 'skill.foraging');
    feed(s, gather(me, 'item.berry'));
    expect(earned(s, me, 'skill.foraging') - before).toBeGreaterThan(lumpOf('skill.foraging'));
  });
  it('fires on the first kill of a creature, not on hits', () => {
    const { s, me } = world();
    const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
    const hit: SimEvent = {
      type: 'damageDealt',
      src: me,
      dst: foe,
      amount: 5,
      crit: false,
      bonus: false,
      heavy: false,
      tag: 'blades',
    };
    feed(s, hit);
    expect(earned(s, me, 'skill.blades')).toBe(10);
    s.entities.comps.fighter[foe]!.state = 'dead';
    feed(s, hit);
    expect(earned(s, me, 'skill.blades')).toBe(10 + 10 + 100);
    feed(s, hit);
    expect(earned(s, me, 'skill.blades')).toBe(130);
  });
});

describe('banking at a Trial threshold', () => {
  it('holds XP at 14 points until the Trial flag is set, then releases it', () => {
    const { s, me } = world();
    setPoints(s, me, 'skill.foraging', 14);
    expect(pendingTrial(sk(s, me), 'skill.foraging')).toBe(15);
    s.events.list.length = 0;
    addXp(s, me, 'skill.foraging', xpToNext(14) + 50);
    expect(pointsOf(s, me, 'skill.foraging')).toBe(14);
    expect(sk(s, me).xp['skill.foraging']).toBe(xpToNext(14) + 50);
    expect(ofType(s, 'skillBanked')).toHaveLength(1);
    addXp(s, me, 'skill.foraging', 10);
    expect(ofType(s, 'skillBanked')).toHaveLength(1);
    expect(pointsOf(s, me, 'skill.foraging')).toBe(14);

    expect(passTrial(s, me, 'trial.foraging.15')).toBe(true);
    expect(pointsOf(s, me, 'skill.foraging')).toBe(15);
    expect(sk(s, me).xp['skill.foraging']).toBe(60);
    expect(ofType(s, 'skillRankUp').at(-1)).toMatchObject({ points: 15, mastery: 'Apprentice' });
    expect(passTrial(s, me, 'trial.foraging.15')).toBe(false);
  });
  it('banks at every threshold, not only the ones with a Trial written', () => {
    const { s, me } = world();
    setPoints(s, me, 'skill.blades', 14);
    addXp(s, me, 'skill.blades', 100_000);
    expect(pointsOf(s, me, 'skill.blades')).toBe(14);
    sk(s, me).passed.push(trialKey('skill.blades', 15));
    addXp(s, me, 'skill.blades', 1);
    expect(pointsOf(s, me, 'skill.blades')).toBe(29);
  });
  it('stops at 100', () => {
    const { s, me } = world();
    setPoints(s, me, 'skill.blades', 100);
    addXp(s, me, 'skill.blades', 1000);
    expect(pointsOf(s, me, 'skill.blades')).toBe(100);
  });
});

describe('the Foraging Trial', () => {
  it('knows the time of day from the tick', () => {
    expect(dayPhase(0)).toBe('day');
    const m = TIME.ticksPerMinute;
    expect(dayPhase(30 * m)).toBe('dusk');
    expect(dayPhase(34 * m)).toBe('night');
    expect(dayPhase(44 * m)).toBe('dawn');
    expect(dayPhase(48 * m)).toBe('day');
  });
  it('passes only when offered, with the right herb, at dawn or dusk', () => {
    const { s, me } = world();
    const m = TIME.ticksPerMinute;
    const herb: SimEvent = {
      type: 'gathered',
      id: me,
      tag: 'foraging',
      item: 'item.sunwort',
      tier: 1,
      qty: 1,
    };
    const flag = () => sk(s, me).passed.includes(trialKey('skill.foraging', 15));

    s.worldTick = 44 * m;
    feed(s, herb);
    expect(flag()).toBe(false);

    expect(offerTrial(s, me, 'trial.foraging.15')).toBe(true);
    expect(offerTrial(s, me, 'trial.foraging.15')).toBe(false);

    s.worldTick = 10 * m;
    feed(s, herb);
    expect(flag()).toBe(false);

    s.worldTick = 44 * m;
    feed(s, { ...herb, item: 'item.other' } as SimEvent);
    expect(flag()).toBe(false);

    feed(s, herb);
    expect(flag()).toBe(true);
    expect(ofType(s, 'trialPassed')).toHaveLength(1);
  });
  it('passes at dusk too', () => {
    const { s, me } = world();
    offerTrial(s, me, 'trial.foraging.15');
    s.worldTick = 31 * TIME.ticksPerMinute;
    feed(s, { type: 'gathered', id: me, tag: 'foraging', item: 'item.sunwort', tier: 1, qty: 1 });
    expect(sk(s, me).passed).toContain(trialKey('skill.foraging', 15));
  });
});

describe('attributes', () => {
  it('recompute from skill points when a rank changes, by family and named skill', () => {
    const { s, me } = world();
    const p = s.entities.comps.pools[me]!;
    expect([p.hpMax, p.staMax, p.focMax]).toEqual([C.pools.hpMax, C.pools.staMax, C.pools.focMax]);
    addXp(s, me, 'skill.blades', xpToNext(0));
    expect(pointsOf(s, me, 'skill.blades')).toBe(1);
    expect(p.hpMax).toBe(C.pools.hpMax + 1);
    expect(p.staMax).toBe(C.pools.staMax + 5);
    expect(p.focMax).toBe(C.pools.focMax);
    addXp(s, me, 'skill.ember', xpToNext(0));
    expect(p.focMax).toBe(C.pools.focMax + 5);
    expect(p.hpMax).toBe(C.pools.hpMax + 1);
    addXp(s, me, 'skill.cooking', xpToNext(0));
    expect(p.focMax).toBe(C.pools.focMax + 10);
    addXp(s, me, 'skill.athletics', xpToNext(0));
    expect(p.hpMax).toBe(C.pools.hpMax + 2);
    expect(p.staMax).toBe(C.pools.staMax + 10);
  });
  it('a gain fills the pool by the same amount and never overfills', () => {
    const { s, me } = world();
    const p = s.entities.comps.pools[me]!;
    p.hp = 40;
    addXp(s, me, 'skill.blades', xpToNext(0));
    expect(p.hp).toBe(41);
    expect(p.hp).toBeLessThanOrEqual(p.hpMax);
  });
});

describe('data-only skills', () => {
  it('a skill registered as data earns XP, ranks up and feeds its family pool', () => {
    registerSkill({
      id: 'skill.fake',
      name: 'Fake',
      family: 'social',
      sources: [{ on: 'gather', tag: 'fake', base: xpToNext(0), scaled: false }],
    });
    try {
      const { s, me } = world();
      feed(s, { type: 'gathered', id: me, tag: 'fake', item: 'item.x', tier: 1, qty: 1 });
      expect(pointsOf(s, me, 'skill.fake')).toBe(1);
      expect(s.entities.comps.pools[me]!.focMax).toBe(C.pools.focMax + 5);
      expect(ofType(s, 'skillRankUp').at(-1)).toMatchObject({ skill: 'skill.fake', points: 1 });
    } finally {
      unregisterSkill('skill.fake');
    }
  });
});

describe('determinism', () => {
  it('the same events give the same state', () => {
    const run = (): string => {
      const { s, me } = world();
      const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
      for (let i = 0; i < 30; i++) {
        feed(s, gather(me, `item.${i % 4}`), {
          type: 'damageDealt',
          src: me,
          dst: foe,
          amount: 1,
          crit: false,
          bonus: false,
          heavy: false,
          tag: 'blades',
        });
      }
      return hashState(s);
    };
    expect(run()).toBe(run());
  });
});

describe('content', () => {
  it('every Trial names a real skill at a real threshold, and every skill source is sane', async () => {
    const { SKILLS, TRIALS } = await import('../../src/content/skills');
    for (const t of Object.values(TRIALS)) {
      expect(SKILLS[t.skill], t.id).toBeDefined();
      expect(B.thresholds as readonly number[], t.id).toContain(t.threshold);
      expect(t.id).toBe(`trial.${t.skill.replace('skill.', '')}.${t.threshold}`);
    }
    for (const d of Object.values(SKILLS)) {
      // A skill with no source is pending, and a pending skill has none (never wire XP to one).
      expect(d.sources.length > 0, d.id).toBe(!PENDING_SKILLS.includes(d.id));
      for (const src of d.sources) {
        // A source pays something: a base, or a first-time lump (Deciphering has only the lump).
        expect(src.base + (src.firstTime ?? 0), d.id).toBeGreaterThan(0);
        expect(d.name).not.toMatch(/—/);
      }
    }
  });
});
