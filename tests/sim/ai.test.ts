import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../../src/content/combat/attacks';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { px } from '../../src/sim/kernel/fixed';
import type { SimEvent } from '../../src/sim/kernel/events';
import { destroy } from '../../src/sim/kernel/entities';
import { createDemoState, hashState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { MAX_ATTACKERS } from '../../src/sim/systems/ai';
import { createSpawner } from '../../src/sim/systems/spawner';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 80 || ty > 80 ? 1 : 0),
};

interface Arena {
  s: SimState;
  me: number;
  events: SimEvent[];
  at: number[];
  run: (n: number) => void;
}

/** The avatar stands at tile (30, 30) doing nothing. `events` collects everything, `at` the tick of each. */
function arena(): Arena {
  const s = createDemoState(11, 0);
  s.world = OPEN;
  const f = feetAt(30, 30);
  const me = createAvatar(s, f.x, f.y);
  const a: Arena = {
    s,
    me,
    events: [],
    at: [],
    run: (n) => {
      for (let i = 0; i < n; i++) {
        stepWorld(s, me, { commands: [] });
        for (const e of s.events.list) {
          a.events.push(e);
          a.at.push(s.tick);
        }
      }
    },
  };
  return a;
}

const me0 = { x: 30 * 16 + 8, y: 30 * 16 + 14 };
const of = <T extends SimEvent['type']>(a: Arena, t: T) =>
  a.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const tickOf = (a: Arena, pred: (e: SimEvent) => boolean): number => {
  const i = a.events.findIndex(pred);
  return i < 0 ? -1 : (a.at[i] as number);
};
const pos = (s: SimState, id: number) => ({
  x: (s.entities.comps.pos[id]?.x ?? 0) / 256,
  y: (s.entities.comps.pos[id]?.y ?? 0) / 256,
});
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const msOf = (ticks: number): number => (ticks * 1000) / 30;

describe('Chaser: Mossling', () => {
  it('notices at range and not beyond it', () => {
    const def = CREATURES['creature.mossling']!;
    const far = arena();
    spawnCreature(far.s, def.id, me0.x + def.notice + 30, me0.y);
    far.run(60);
    expect(of(far, 'noticed')).toHaveLength(0);
    const near = arena();
    spawnCreature(near.s, def.id, me0.x + def.notice - 20, me0.y);
    near.run(30);
    expect(of(near, 'noticed')).toHaveLength(1);
  });

  it('closes in, telegraphs for the configured time, and only then hurts', () => {
    const a = arena();
    const def = CREATURES['creature.mossling']!;
    const m = spawnCreature(a.s, def.id, me0.x + 70, me0.y);
    a.run(200);
    const started = tickOf(a, (e) => e.type === 'attackStarted' && e.id === m);
    const hurt = tickOf(a, (e) => e.type === 'damageDealt' && e.dst === a.me);
    expect(started).toBeGreaterThan(0);
    expect(hurt).toBeGreaterThan(started);
    const windup = ATTACKS[def.attacks[0]!.attack]!.windup;
    expect(hurt - started).toBeGreaterThanOrEqual(windup);
    expect(msOf(windup)).toBeGreaterThanOrEqual(350);
  });

  it('leashes when pulled too far, walks home and resets its Health', () => {
    const a = arena();
    const def = CREATURES['creature.mossling']!;
    const m = spawnCreature(a.s, def.id, me0.x + 60, me0.y);
    a.run(20);
    a.s.entities.comps.pools[m]!.hp = 30;
    a.s.entities.comps.pools[m]!.lastCombat = a.s.tick;
    // Drag the target far away so the creature loses it.
    const p = a.s.entities.comps.pos[a.me]!;
    p.x = px(me0.x + def.leash + def.lose + 100);
    let leashed = false;
    for (let i = 0; i < 60 && !leashed; i++) {
      a.run(1);
      leashed = a.s.entities.comps.ai[m]!.state === 'leash';
    }
    expect(leashed).toBe(true);
    expect(a.s.entities.comps.ai[m]!.target).toBeNull();
    for (let i = 0; i < 400 && of(a, 'leashReset').length === 0; i++) a.run(1);
    expect(of(a, 'leashReset')).toHaveLength(1);
    expect(a.s.entities.comps.ai[m]!.state).toBe('idle');
    expect(a.s.entities.comps.pools[m]!.hp).toBe(def.hp);
    expect(dist(pos(a.s, m), { x: me0.x + 60, y: me0.y })).toBeLessThan(6);
  });

  it('leashes when it strays too far from home chasing', () => {
    const a = arena();
    const def = CREATURES['creature.mossling']!;
    const m = spawnCreature(a.s, def.id, me0.x + 60, me0.y);
    a.run(15);
    // The target runs the other way, but stays in notice range of the creature as it follows.
    for (let i = 0; i < 400; i++) {
      a.s.entities.comps.pos[a.me]!.x += 200;
      a.run(1);
      if (a.s.entities.comps.ai[m]!.state === 'leash') break;
    }
    expect(a.s.entities.comps.ai[m]!.state).toBe('leash');
  });

  it('runs away at low Health, once', () => {
    const a = arena();
    const def = CREATURES['creature.mossling']!;
    const m = spawnCreature(a.s, def.id, me0.x + 50, me0.y);
    a.run(15);
    a.s.entities.comps.pools[m]!.hp = 5;
    a.run(2);
    expect(a.s.entities.comps.ai[m]!.state).toBe('flee');
    const d0 = dist(pos(a.s, m), pos(a.s, a.me));
    a.run(40);
    expect(dist(pos(a.s, m), pos(a.s, a.me))).toBeGreaterThan(d0);
  });
});

describe('Shooter: Spitbloom', () => {
  it('stays rooted, telegraphs, then the seed hits', () => {
    const a = arena();
    const def = CREATURES['creature.spitbloom']!;
    const m = spawnCreature(a.s, def.id, me0.x + 90, me0.y);
    const start = pos(a.s, m);
    a.run(160);
    expect(pos(a.s, m)).toEqual(start);
    const started = tickOf(a, (e) => e.type === 'attackStarted' && e.id === m);
    const launched = tickOf(a, (e) => e.type === 'projectileLaunched' && e.owner === m);
    const hit = tickOf(a, (e) => e.type === 'damageDealt' && e.dst === a.me);
    expect(started).toBeGreaterThan(0);
    const windup = ATTACKS[def.attacks[0]!.attack]!.windup;
    expect(launched - started).toBeGreaterThanOrEqual(windup);
    expect(hit).toBeGreaterThan(launched);
  });

  it('does not shoot what it cannot see', () => {
    const a = arena();
    const def = CREATURES['creature.spitbloom']!;
    spawnCreature(a.s, def.id, me0.x + def.notice + 40, me0.y);
    a.run(120);
    expect(of(a, 'attackStarted')).toHaveLength(0);
  });
});

describe('Charger: Bramble Boar', () => {
  it('telegraphs the charge, rushes in a straight line, and a sidestep avoids it', () => {
    const def = CREATURES['creature.bramble_boar']!;
    const charge = ATTACKS['attack.boar_charge']!;
    for (const sidestep of [false, true]) {
      const a = arena();
      const m = spawnCreature(a.s, def.id, me0.x + 85, me0.y);
      let started = -1;
      for (let i = 0; i < 300 && started < 0; i++) {
        a.run(1);
        const e = a.events.find((x) => x.type === 'attackStarted' && x.id === m);
        if (e && e.type === 'attackStarted' && e.attack === 'attack.boar_charge')
          started = a.s.tick;
        else if (e) a.events.length = 0;
      }
      if (started < 0) throw new Error('the boar never charged');
      const from = pos(a.s, m);
      if (sidestep) a.s.entities.comps.pos[a.me]!.y += px(40);
      const hpBefore = a.s.entities.comps.pools[a.me]!.hp;
      a.run(charge.windup + charge.active + 4);
      const moved = dist(from, pos(a.s, m));
      expect(moved).toBeGreaterThan(40);
      const hp = a.s.entities.comps.pools[a.me]!.hp;
      if (sidestep) expect(hp).toBe(hpBefore);
      else expect(hp).toBeLessThan(hpBefore);
    }
  });

  it('every charge is telegraphed at least the minimum time', () => {
    for (const id of ['attack.boar_charge', 'attack.boss_charge', 'attack.boar_gore']) {
      expect(msOf(ATTACKS[id]!.windup), id).toBeGreaterThanOrEqual(350);
    }
  });
});

describe('Miniboss: Old Bramblehide', () => {
  it('adds the slam in phase two, and the slam is an area with a wind-up', () => {
    const a = arena();
    const def = CREATURES['creature.old_bramblehide']!;
    const b = spawnCreature(a.s, def.id, me0.x + 60, me0.y);
    a.run(30);
    const slamOk = (): boolean =>
      a.events.some(
        (e) => e.type === 'attackStarted' && e.id === b && e.attack === 'attack.boss_slam',
      );
    a.run(300);
    expect(slamOk()).toBe(false);
    a.s.entities.comps.pools[b]!.hp = Math.floor(def.hp * 0.45);
    a.s.entities.comps.pools[b]!.lastCombat = a.s.tick;
    a.run(400);
    expect(of(a, 'phaseChanged')).toHaveLength(1);
    expect(a.s.entities.comps.ai[b]!.phase).toBe(1);
    expect(slamOk()).toBe(true);
    const slam = ATTACKS['attack.boss_slam']!;
    expect(slam.shape.kind).toBe('circle');
    expect(msOf(slam.windup)).toBeGreaterThanOrEqual(350);
  });

  it('is faster in phase two', () => {
    const def = CREATURES['creature.old_bramblehide']!;
    expect(def.phases?.[0]?.speedPct).toBeGreaterThan(100);
  });
});

describe('engagement cap and avoidance', () => {
  it('no more than six attack at once, the rest circle', () => {
    const a = arena();
    const def = CREATURES['creature.mossling']!;
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      ids.push(spawnCreature(a.s, def.id, me0.x + Math.cos(ang) * 60, me0.y + Math.sin(ang) * 60));
    }
    // The avatar cannot die in this test.
    let worst = 0;
    let circling = 0;
    for (let i = 0; i < 300; i++) {
      a.s.entities.comps.pools[a.me]!.hp = 100;
      a.run(1);
      const n = ids.filter((id) => a.s.entities.comps.fighter[id]?.state === 'attack').length;
      worst = Math.max(worst, n);
      if (i > 120)
        circling = Math.max(
          circling,
          ids.filter((id) => {
            const ai = a.s.entities.comps.ai[id];
            const f = a.s.entities.comps.fighter[id];
            return (
              ai?.state === 'approach' &&
              f?.state === 'idle' &&
              dist(pos(a.s, id), pos(a.s, a.me)) > 30
            );
          }).length,
        );
    }
    expect(worst).toBeLessThanOrEqual(MAX_ATTACKERS);
    expect(worst).toBeGreaterThan(1);
    expect(circling).toBeGreaterThan(0);
  });

  it('creatures that start on the same spot spread out instead of stacking', () => {
    const a = arena();
    const def = CREATURES['creature.mossling']!;
    const ids = [0, 1, 2].map(() => spawnCreature(a.s, def.id, me0.x + 100, me0.y + 100));
    for (const id of ids) {
      a.s.entities.comps.ai[id]!.state = 'approach';
      a.s.entities.comps.ai[id]!.target = a.me;
    }
    a.run(40);
    let min = Infinity;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        min = Math.min(min, dist(pos(a.s, ids[i]!), pos(a.s, ids[j]!)));
    expect(min).toBeGreaterThan(6);
  });
});

describe('spawners', () => {
  it('fill to the cap, never exceed it, and replace the dead after the respawn time', () => {
    const a = arena();
    const def = SPAWNERS['spawner.mossling']!;
    const sp = createSpawner(a.s, def.kind, me0.x + 400, me0.y + 400);
    a.run(5);
    const members = (): number[] => a.s.entities.comps.spawner[sp]!.members;
    expect(members()).toHaveLength(1);
    a.run(def.respawn + 5);
    expect(members()).toHaveLength(def.cap);
    a.run(def.respawn * 2);
    expect(members()).toHaveLength(def.cap);
    for (const m of members()) {
      const home = a.s.entities.comps.ai[m]!.home;
      expect(dist({ x: home.x / 256, y: home.y / 256 }, pos(a.s, sp))).toBeLessThanOrEqual(
        def.radius * 1.5 + 2,
      );
    }
    destroy(a.s.entities, members()[0]!);
    a.run(def.respawn - 20);
    expect(members()).toHaveLength(def.cap - 1);
    a.run(40);
    expect(members()).toHaveLength(def.cap);
  });
});

describe('determinism', () => {
  it('a fight with brains gives the same hash twice', () => {
    const run = (): string => {
      const a = arena();
      spawnCreature(a.s, 'creature.mossling', me0.x + 50, me0.y);
      spawnCreature(a.s, 'creature.bramble_boar', me0.x - 70, me0.y + 10);
      createSpawner(a.s, 'spawner.spitbloom', me0.x + 20, me0.y - 80);
      a.run(400);
      return hashState(a.s);
    };
    expect(run()).toBe(run());
  });
});
