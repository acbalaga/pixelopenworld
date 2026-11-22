import { describe, expect, it } from 'vitest';
import { SKILLS_BALANCE as B } from '../../src/content/balance/skills';
import { TIME } from '../../src/content/balance/time';
import { COMBAT as C } from '../../src/content/balance/combat';
import {
  TRIALS,
  registerTrial,
  trialCount,
  unregisterTrial,
  type TrialDef,
} from '../../src/content/skills';
import { AUTHORED_TRIALS } from '../../src/content/skills/dawnmeadowTrials';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnEnemy } from '../../src/sim/combat/enemy';
import { fightId, inFight } from '../../src/sim/fight';
import { addItem, give } from '../../src/sim/items';
import type { SimEvent } from '../../src/sim/kernel/events';
import {
  addXp,
  offerTrial,
  pendingTrial,
  pointsOf,
  trialPassed,
  xpToNext,
} from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { advanceTrials, deliverTrials, trialsSystem } from '../../src/sim/systems/trials';

const OPEN = { solidAt: (): number => 0 };

function world(): { s: SimState; me: number } {
  const s = createDemoState(9, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  return { s, me: createAvatar(s, f.x, f.y) };
}

/** One tick: the given events are what the other systems sent, and the Trials system reads them. */
function feed(s: SimState, ...evs: SimEvent[]): void {
  s.tick++;
  s.events.list.length = 0;
  s.events.list.push(...evs);
  trialsSystem(s);
}
const sk = (s: SimState, me: number) => s.entities.comps.skills[me]!;

/** A kill: a creature of `kind`, dead, and the avatar's hit on it. */
function kill(s: SimState, me: number, kind: string, tag: string): SimEvent {
  const foe = spawnEnemy(s, kind, 400, 300);
  s.entities.comps.fighter[foe]!.state = 'dead';
  return hit(s, me, foe, tag);
}
function hit(_s: SimState, me: number, foe: number, tag: string): SimEvent {
  return {
    type: 'damageDealt',
    src: me,
    dst: foe,
    amount: 3,
    crit: false,
    bonus: false,
    heavy: false,
    tag,
  };
}
const hurt = (me: number): SimEvent => ({
  type: 'damageDealt',
  src: 99,
  dst: me,
  amount: 2,
  crit: false,
  bonus: false,
  heavy: false,
  tag: 'creature',
});

const DAWN =
  (TIME.phases.reduce((n, p) => n + p.minutes, 0) - TIME.startMinute) * TIME.ticksPerMinute;
const NOON = 10 * TIME.ticksPerMinute;

describe('banking and release at every threshold', () => {
  it.each(B.thresholds)('XP banks at point %i and a passed Trial releases it', (th) => {
    const skill = 'skill.fake_t';
    const test: TrialDef = {
      id: `trial.fake_t.${th}`,
      skill,
      threshold: th as TrialDef['threshold'],
      giver: { npc: 'npc.guard' },
      intro: 'x',
      hint: 'x',
      objective: { kind: 'gather', count: 1 },
      estMinutes: 1,
    };
    const defs = B.thresholds.map((t) => ({
      ...test,
      id: `trial.fake_t.${t}`,
      threshold: t as TrialDef['threshold'],
    }));
    for (const d of defs) registerTrial(d);
    try {
      const { s, me } = world();
      // A skill with no source of its own: a save can hold points, and addXp is the door.
      void skill;
      const sks = sk(s, me);
      sks.points['skill.blades'] = th - 1;
      const real = defs.find((d) => d.threshold === th)!;
      real.skill = 'skill.blades';
      addXp(s, me, 'skill.blades', xpToNext(th - 1) + 7);
      expect(pointsOf(s, me, 'skill.blades')).toBe(th - 1);
      expect(pendingTrial(sks, 'skill.blades')).toBe(th);
      expect(sks.xp['skill.blades']).toBeGreaterThanOrEqual(xpToNext(th - 1));
      expect(offerTrial(s, me, real.id)).toBe(true);
      feed(s, { type: 'gathered', id: me, tag: 'x', item: 'item.x', tier: 1, qty: 1 });
      expect(trialPassed(sks, 'skill.blades', th)).toBe(true);
      expect(pointsOf(s, me, 'skill.blades')).toBe(th);
      expect(sks.trial[real.id]).toBeUndefined();
    } finally {
      for (const d of defs) unregisterTrial(d.id);
    }
  });
});

describe('objective kinds', () => {
  const add = (def: Partial<TrialDef> & Pick<TrialDef, 'objective'>): TrialDef => {
    const d: TrialDef = {
      id: 'trial.blades.30',
      skill: 'skill.blades',
      threshold: 30,
      giver: { npc: 'npc.guard' },
      intro: 'x',
      hint: 'x',
      estMinutes: 1,
      ...def,
    };
    registerTrial(d);
    return d;
  };
  const run = (def: TrialDef, f: (s: SimState, me: number) => void): void => {
    try {
      const { s, me } = world();
      offerTrial(s, me, def.id);
      f(s, me);
    } finally {
      unregisterTrial(def.id);
    }
  };
  const passed = (s: SimState, me: number): boolean => trialPassed(sk(s, me), 'skill.blades', 30);

  it('defeat counts kills of the named creature only', () => {
    run(
      add({ objective: { kind: 'defeat', creature: 'creature.mossling', count: 2 } }),
      (s, me) => {
        feed(s, kill(s, me, 'creature.bramble_boar', 'blades'));
        expect(sk(s, me).trial['trial.blades.30']!.n).toBe(0);
        feed(s, kill(s, me, 'creature.mossling', 'blades'));
        feed(s, kill(s, me, 'creature.mossling', 'blades'));
        expect(passed(s, me)).toBe(true);
      },
    );
  });
  it('defeat inARow resets when the avatar takes damage', () => {
    run(add({ objective: { kind: 'defeat', count: 3, inARow: true } }), (s, me) => {
      feed(
        s,
        kill(s, me, 'creature.mossling', 'blades'),
        kill(s, me, 'creature.mossling', 'blades'),
      );
      expect(sk(s, me).trial['trial.blades.30']!.n).toBe(2);
      feed(s, hurt(me));
      expect(sk(s, me).trial['trial.blades.30']!.n).toBe(0);
      feed(s, kill(s, me, 'creature.mossling', 'blades'));
      expect(passed(s, me)).toBe(false);
    });
  });
  it('defeat untouched resets on damage taken, and passes with a clean run', () => {
    run(add({ objective: { kind: 'defeat', count: 2, untouched: true } }), (s, me) => {
      feed(s, kill(s, me, 'creature.mossling', 'blades'));
      feed(s, hurt(me));
      feed(s, kill(s, me, 'creature.mossling', 'blades'));
      expect(passed(s, me)).toBe(false);
      feed(s, kill(s, me, 'creature.mossling', 'blades'));
      expect(passed(s, me)).toBe(true);
    });
  });
  it('defeat only: a kill that was hit with anything else does not count', () => {
    run(add({ objective: { kind: 'defeat', count: 1, only: { weapon: 'polearms' } } }), (s, me) => {
      const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
      feed(s, hit(s, me, foe, 'blades'));
      s.entities.comps.fighter[foe]!.state = 'dead';
      feed(s, hit(s, me, foe, 'polearms'));
      expect(passed(s, me)).toBe(false);
      feed(s, kill(s, me, 'creature.mossling', 'polearms'));
      expect(passed(s, me)).toBe(true);
    });
  });
  it('defeat withinTicks starts over when the window runs out', () => {
    run(add({ objective: { kind: 'defeat', count: 2, withinTicks: 100 } }), (s, me) => {
      feed(s, kill(s, me, 'creature.mossling', 'blades'));
      s.tick += 200;
      feed(s, kill(s, me, 'creature.mossling', 'blades'));
      expect(passed(s, me)).toBe(false);
      feed(s, kill(s, me, 'creature.mossling', 'blades'));
      expect(passed(s, me)).toBe(true);
    });
  });
  it('gather counts the item, and only in the phases asked', () => {
    run(
      add({ objective: { kind: 'gather', item: 'item.sunwort', count: 2, phases: ['dawn'] } }),
      (s, me) => {
        const g: SimEvent = {
          type: 'gathered',
          id: me,
          tag: 'foraging',
          item: 'item.sunwort',
          tier: 1,
          qty: 1,
        };
        s.worldTick = NOON;
        feed(s, g);
        s.worldTick = DAWN;
        s.tick++;
        s.events.list.length = 0;
        s.events.list.push(g);
        // feed() sets nothing on worldTick, so it keeps the dawn value.
        trialsSystem(s);
        expect(sk(s, me).trial['trial.blades.30']!.n).toBe(1);
        s.events.list.length = 0;
        s.events.list.push(g);
        trialsSystem(s);
        expect(passed(s, me)).toBe(true);
      },
    );
  });
  it('gather counts the items one gather gives, and an overshoot completes once', () => {
    run(add({ objective: { kind: 'gather', item: 'item.sunwort', count: 4 } }), (s, me) => {
      const g = (qty: number): SimEvent => ({
        type: 'gathered',
        id: me,
        tag: 'foraging',
        item: 'item.sunwort',
        tier: 1,
        qty,
      });
      feed(s, g(3));
      expect(sk(s, me).trial['trial.blades.30']!.n).toBe(3);
      expect(passed(s, me)).toBe(false);
      feed(s, g(5));
      expect(passed(s, me)).toBe(true);
    });
  });
  it('perform perfectDodge inOneFight starts over in a new fight', () => {
    run(
      add({ objective: { kind: 'perform', action: 'perfectDodge', count: 2, inOneFight: true } }),
      (s, me) => {
        const dodge: SimEvent = { type: 'perfectDodge', id: me, src: 99 };
        const pools = s.entities.comps.pools[me]!;
        pools.lastCombat = s.tick + 1;
        feed(s, dodge);
        expect(inFight(s, me)).toBe(true);
        const first = fightId(s, me);
        s.tick += C.pools.hpRegenDelay + 5;
        pools.lastCombat = s.tick + 1;
        feed(s, dodge);
        expect(fightId(s, me)).toBe(first + 1);
        expect(sk(s, me).trial['trial.blades.30']!.n).toBe(1);
        pools.lastCombat = s.tick + 1;
        feed(s, dodge);
        expect(passed(s, me)).toBe(true);
      },
    );
  });
  it('perform technique counts the named technique', () => {
    run(
      add({
        objective: {
          kind: 'perform',
          action: 'technique',
          technique: 'technique.blades_lunge',
          count: 1,
        },
      }),
      (s, me) => {
        feed(s, { type: 'attackStarted', id: me, attack: 'attack.sword_slash' });
        expect(passed(s, me)).toBe(false);
        feed(s, { type: 'attackStarted', id: me, attack: 'technique.blades_lunge' });
        expect(passed(s, me)).toBe(true);
      },
    );
  });
  it('craft passes on the recipe at the quality asked', () => {
    run(
      add({ objective: { kind: 'craft', recipe: 'recipe.herb_tea', minQuality: 0 } }),
      (s, me) => {
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
        expect(passed(s, me)).toBe(false);
        feed(s, {
          type: 'crafted',
          id: me,
          tag: 'cooking',
          recipe: 'recipe.herb_tea',
          tier: 1,
          item: 'item.herb_tea',
          qty: 1,
          quality: 0,
          source: 'manual',
        });
        expect(passed(s, me)).toBe(true);
      },
    );
  });
  it('deliver takes the items when talking to the person, and only then', () => {
    run(
      add({ objective: { kind: 'deliver', item: 'item.sunwort', qty: 2, to: 'npc.cook' } }),
      (s, me) => {
        give(s, me, 'item.sunwort', 1, 'gather');
        deliverTrials(s, me, 'npc.cook');
        expect(passed(s, me)).toBe(false);
        give(s, me, 'item.sunwort', 1, 'gather');
        deliverTrials(s, me, 'npc.guard');
        expect(passed(s, me)).toBe(false);
        deliverTrials(s, me, 'npc.cook');
        expect(passed(s, me)).toBe(true);
        expect(s.entities.comps.inventory[me]!.slots.some((x) => x?.item === 'item.sunwort')).toBe(
          false,
        );
      },
    );
  });
  it('deliver respects the quality asked for', () => {
    run(
      add({
        objective: { kind: 'deliver', item: 'item.sunwort', qty: 1, minQuality: 2, to: 'npc.cook' },
      }),
      (s, me) => {
        addItem(s.entities.comps.inventory[me]!, 'item.sunwort', 1, { q: 1 });
        deliverTrials(s, me, 'npc.cook');
        expect(passed(s, me)).toBe(false);
        addItem(s.entities.comps.inventory[me]!, 'item.sunwort', 1, { q: 2 });
        deliverTrials(s, me, 'npc.cook');
        expect(passed(s, me)).toBe(true);
      },
    );
  });
  it('reach starts its clock on touching the fixture, and fails when the time is up', () => {
    run(
      add({
        objective: { kind: 'reach', room: 'room.a', from: 'fixture.waystone', withinTicks: 100 },
      }),
      (s, me) => {
        const stone = spawnFixture(s, 'fixture.waystone', 40, 40);
        void stone;
        const here: SimEvent = {
          type: 'roomChanged',
          who: me,
          from: 'room.outdoors',
          to: 'room.a',
        };
        // Arriving without touching the stone first does nothing.
        feed(s, here);
        expect(passed(s, me)).toBe(false);
        const p = s.entities.comps.pos[me]!;
        const f = feetAt(40, 41);
        p.x = f.x;
        p.y = f.y;
        feed(s);
        expect(sk(s, me).trial['trial.blades.30']!.t0).toBeGreaterThan(0);
        s.tick += 150;
        feed(s, here);
        expect(passed(s, me)).toBe(false);
        feed(s);
        s.tick += 50;
        feed(s, here);
        expect(passed(s, me)).toBe(true);
      },
    );
  });
  it('an event from a routine source never advances a Trial', () => {
    run(add({ objective: { kind: 'defeat', count: 1 } }), (s, me) => {
      advanceTrials(s, me, kill(s, me, 'creature.mossling', 'blades'), 'routine');
      expect(sk(s, me).trial['trial.blades.30']!.n).toBe(0);
      expect(passed(s, me)).toBe(false);
      advanceTrials(s, me, kill(s, me, 'creature.mossling', 'blades'), 'manual');
      expect(passed(s, me)).toBe(true);
    });
  });
});

describe('every authored Trial has a scripted run', () => {
  /** Plays the Trial the way a player would, as the events the sim sends. */
  const SCRIPTS: Record<string, (s: SimState, me: number) => void> = {
    'trial.blades.15': (s, me) => {
      for (let i = 0; i < 3; i++) feed(s, kill(s, me, 'creature.mossling', 'blades'));
    },
    'trial.polearms.15': (s, me) => {
      for (let i = 0; i < 2; i++) feed(s, kill(s, me, 'creature.bramble_boar', 'polearms'));
    },
    'trial.evasion.15': (s, me) => {
      const pools = s.entities.comps.pools[me]!;
      for (let i = 0; i < 5; i++) {
        pools.lastCombat = s.tick + 1;
        feed(s, { type: 'perfectDodge', id: me, src: 99 });
      }
    },
    'trial.ember.15': (s, me) => {
      for (let i = 0; i < 3; i++) feed(s, kill(s, me, 'creature.spitbloom', 'ember'));
    },
    'trial.cooking.15': (s, me) => {
      addItem(s.entities.comps.inventory[me]!, 'item.hearty_stew', 1);
      deliverTrials(s, me, 'npc.cook');
      expect(trialPassed(sk(s, me), 'skill.cooking', 15)).toBe(false);
      addItem(s.entities.comps.inventory[me]!, 'item.hearty_stew', 1, { q: 1 });
      deliverTrials(s, me, 'npc.cook');
    },
    'trial.foraging.15': (s, me) => {
      s.worldTick = DAWN;
      s.tick++;
      s.events.list.length = 0;
      s.events.list.push({
        type: 'gathered',
        id: me,
        tag: 'foraging',
        item: 'item.sunwort',
        tier: 1,
        qty: 1,
      });
      trialsSystem(s);
    },
  };
  // Dawnmeadow's own rank 15 Trials (M4-12) have their scripted runs in dawnmeadowTrials.test.ts.
  const authored = new Set(
    AUTHORED_TRIALS.map((t) => `trial.${t.skill.replace(/^skill\./, '')}.15`),
  );
  const m3 = Object.keys(TRIALS).filter((id) => !authored.has(id));
  it.each(m3)('%s', (id) => {
    const script = SCRIPTS[id];
    expect(script, `${id} has no scripted run`).toBeDefined();
    const { s, me } = world();
    expect(offerTrial(s, me, id)).toBe(true);
    script!(s, me);
    const t = TRIALS[id]!;
    expect(trialPassed(sk(s, me), t.skill, t.threshold)).toBe(true);
  });
  it('the six rank 15 Trials of the first map are authored with strings and a giver', () => {
    expect(m3).toHaveLength(6);
    for (const t of m3.map((id) => TRIALS[id]!)) {
      expect(t.threshold).toBe(15);
      expect(trialCount(t.objective)).toBeGreaterThan(0);
    }
  });
});
