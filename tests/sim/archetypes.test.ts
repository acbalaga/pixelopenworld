import { afterAll, describe, expect, it } from 'vitest';
import { TEMPERAMENT as TP } from '../../src/content/balance/temperament';
import { ARCHETYPE as AR } from '../../src/content/balance/archetypes';
import { ATTACKS } from '../../src/content/combat/attacks';
import { CREATURES } from '../../src/content/creatures';
import type { CreatureDef } from '../../src/content/creatures/types';
import { SFX } from '../../src/content/audio/sfx';
import { SPRITES } from '../../src/content/sprites';
import { validateCreatures, type ContentRefs } from '../../tools/bake-assets/validateCreatures';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { px } from '../../src/sim/kernel/fixed';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { without } from '../support/temperament';

/** Open ground, with an optional wall column at tile x = 34 (a 2 tile gap-free wall from y 20 to 40). */
function grid(wall: boolean): { solidAt: (tx: number, ty: number) => number } {
  return {
    solidAt: (tx, ty) =>
      tx < 0 || ty < 0 || tx > 80 || ty > 80
        ? 1
        : wall && tx === 34 && ty >= 20 && ty <= 40
          ? 1
          : 0,
  };
}
const ME = { x: 30 * 16 + 8, y: 30 * 16 + 14 };

/** Clones of the Mossling made hostile, so a scenario tests the archetype and nothing else. */
const BASE = CREATURES['creature.mossling'] as CreatureDef;
const made: string[] = [];
function make(name: string, patch: Partial<CreatureDef>): string {
  const id = `creature.a_${name}`;
  (CREATURES as Record<string, CreatureDef>)[id] = {
    ...without(BASE, 'night', 'fleeHpPct', 'approach', 'territory'),
    id,
    name,
    temperament: 'hostile',
    wander: false,
    ...patch,
  };
  made.push(id);
  return id;
}
afterAll(() => {
  for (const id of made) delete (CREATURES as Record<string, CreatureDef>)[id];
});

const SKIRM = make('skirm', { archetype: 'skirmisher' });
const GUARD = make('guard', { archetype: 'guard', tether: 70, leash: 140 });
const RAT = make('rat', {
  archetype: 'swarm',
  hp: 30,
  pack: { id: 'rats', radius: 120 },
  notice: 60,
});
const OTHER_RAT = make('rat2', {
  archetype: 'swarm',
  hp: 30,
  pack: { id: 'other', radius: 120 },
  notice: 60,
});
const FLYER = make('flyer', { archetype: 'flyer' });
const GROUND = make('ground', { archetype: 'chaser' });
const MOLE = make('mole', {
  archetype: 'burrower',
  attacks: [{ attack: 'attack.creature_swipe', range: 26, cooldown: 36 }],
});

interface Arena {
  s: SimState;
  me: number;
  events: SimEvent[];
  run: (n: number) => void;
}
function arena(wall = false): Arena {
  const s = createDemoState(11, 0);
  s.world = grid(wall);
  const me = createAvatar(s, feetAt(30, 30).x, feetAt(30, 30).y);
  s.entities.comps.avatar[me]!.facing = 2;
  const a: Arena = {
    s,
    me,
    events: [],
    run: (n) => {
      for (let i = 0; i < n; i++) {
        stepWorld(s, me, { commands: [] });
        a.events.push(...s.events.list);
      }
    },
  };
  return a;
}
const of = <T extends SimEvent['type']>(a: Arena, t: T) =>
  a.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const ai = (a: Arena, id: number) => a.s.entities.comps.ai[id]!;
const dist = (a: Arena, id: number): number => {
  const p = a.s.entities.comps.pos[id]!;
  const m = a.s.entities.comps.pos[a.me]!;
  return Math.hypot(p.x - m.x, p.y - m.y) / 256;
};
const attacks = (a: Arena, id: number): number =>
  of(a, 'attackStarted').filter((e) => e.id === id).length;

describe('skirmisher', () => {
  it('strikes, backs off, and comes in again', () => {
    const a = arena();
    const m = spawnCreature(a.s, SKIRM, ME.x + 50, ME.y);
    const states: string[] = [];
    let closest = Infinity;
    let farthestAfterStrike = 0;
    for (let i = 0; i < 260; i++) {
      a.run(1);
      states.push(ai(a, m).state);
      closest = Math.min(closest, dist(a, m));
      if (attacks(a, m) > 0) farthestAfterStrike = Math.max(farthestAfterStrike, dist(a, m));
    }
    expect(attacks(a, m)).toBeGreaterThanOrEqual(2);
    expect(states).toContain('retreat');
    // It backs off by a clear margin after a strike, then returns to approach.
    expect(farthestAfterStrike).toBeGreaterThan(closest + 12);
    expect(states.lastIndexOf('approach')).toBeGreaterThan(states.indexOf('retreat'));
  });

  it('a chaser never backs off', () => {
    const a = arena();
    const m = spawnCreature(a.s, GROUND, ME.x + 50, ME.y);
    a.run(260);
    expect(attacks(a, m)).toBeGreaterThanOrEqual(1);
    expect(a.events.some((e) => e.type === 'noticed')).toBe(true);
    let sawRetreat = false;
    for (let i = 0; i < 100; i++) {
      a.run(1);
      if (ai(a, m).state === 'retreat') sawRetreat = true;
    }
    expect(sawRetreat).toBe(false);
  });
});

describe('guard', () => {
  it('chases a target inside its tether', () => {
    const a = arena();
    const m = spawnCreature(a.s, GUARD, ME.x + 50, ME.y);
    a.run(120);
    expect(attacks(a, m)).toBeGreaterThanOrEqual(1);
  });

  it('never starts a chase on a target standing beyond its tether', () => {
    const a = arena();
    // 85 px from home is inside notice (96) and beyond the 70 px tether.
    const m = spawnCreature(a.s, GUARD, ME.x + 85, ME.y);
    a.run(120);
    expect(of(a, 'noticed')).toHaveLength(0);
    expect(ai(a, m).state).toBe('idle');
  });

  it('lets go of a target that draws it past the tether, and walks home', () => {
    const a = arena();
    const m = spawnCreature(a.s, GUARD, ME.x + 50, ME.y);
    a.run(40);
    expect(ai(a, m).target).toBe(a.me);
    // The avatar backs away along the line, past the tether.
    a.s.entities.comps.pos[a.me]!.x = px(ME.x - 60);
    a.run(30);
    expect(['leash', 'idle']).toContain(ai(a, m).state);
    expect(ai(a, m).target).toBeNull();
    a.run(200);
    const p = a.s.entities.comps.pos[m]!;
    expect(Math.abs(p.x / 256 - (ME.x + 50))).toBeLessThan(6);
  });
});

describe('guard recovery (M4-05)', () => {
  it('does not heal on the way home while it is still being hit, and mends once left alone', () => {
    const a = arena();
    const m = spawnCreature(a.s, GUARD, ME.x + 50, ME.y);
    a.run(40);
    const pools = a.s.entities.comps.pools[m]!;
    pools.hp = Math.floor(pools.hpMax / 2);
    // The avatar backs off past the tether, and the guard is hit from there as it turns for home.
    a.s.entities.comps.pos[a.me]!.x = px(ME.x - 60);
    a.run(20);
    expect(ai(a, m).target).toBeNull();
    const chip = (): void => {
      a.s.entities.comps.stagger[m]!.lastHit = a.s.tick;
    };
    for (let i = 0; i < 120; i++) {
      chip();
      a.run(1);
    }
    // Home by now, and still hurt: the chip kept it from recovering.
    expect(Math.abs(a.s.entities.comps.pos[m]!.x / 256 - (ME.x + 50))).toBeLessThan(6);
    expect(pools.hp).toBe(Math.floor(pools.hpMax / 2));
    // Left alone for the delay, it mends.
    a.run(TP.guardHealAfterTicks + 5);
    expect(pools.hp).toBe(pools.hpMax);
  });

  it('a guard left alone still heals to full on reaching home', () => {
    const a = arena();
    const m = spawnCreature(a.s, GUARD, ME.x + 50, ME.y);
    a.run(40);
    const pools = a.s.entities.comps.pools[m]!;
    pools.hp = 1;
    a.s.entities.comps.pos[a.me]!.x = px(ME.x - 60);
    a.run(300);
    expect(pools.hp).toBe(pools.hpMax);
  });

  it('other kinds still heal to full on a reset, hit or not', () => {
    const a = arena();
    const m = spawnCreature(a.s, GROUND, ME.x + 50, ME.y);
    a.run(10);
    const pools = a.s.entities.comps.pools[m]!;
    pools.hp = 1;
    a.s.entities.comps.stagger[m]!.lastHit = a.s.tick;
    a.s.entities.comps.ai[m]!.state = 'leash';
    // The avatar is well out of notice, so nothing pulls it back into a fight.
    a.s.entities.comps.pos[a.me]!.x = px(ME.x - 400);
    a.run(400);
    expect(pools.hp).toBe(pools.hpMax);
  });
});

describe('swarm', () => {
  it('one that notices alerts every packmate in the pack radius, and no other pack', () => {
    const a = arena();
    // The first stands near; the others are well beyond their own notice range.
    const near = spawnCreature(a.s, RAT, ME.x + 50, ME.y);
    const mate1 = spawnCreature(a.s, RAT, ME.x + 110, ME.y + 20);
    const mate2 = spawnCreature(a.s, RAT, ME.x + 100, ME.y - 30);
    const far = spawnCreature(a.s, RAT, ME.x + 400, ME.y);
    const other = spawnCreature(a.s, OTHER_RAT, ME.x + 100, ME.y);
    a.run(2);
    for (const id of [near, mate1, mate2]) {
      expect(ai(a, id).target, `rat ${id}`).toBe(a.me);
      expect(['notice', 'approach']).toContain(ai(a, id).state);
    }
    expect(ai(a, far).target).toBeNull();
    expect(ai(a, other).target).toBeNull();
    a.run(150);
    expect(attacks(a, mate1) + attacks(a, mate2)).toBeGreaterThanOrEqual(1);
  });

  it('does not wake a packmate that is dead', () => {
    const a = arena();
    const near = spawnCreature(a.s, RAT, ME.x + 50, ME.y);
    const dead = spawnCreature(a.s, RAT, ME.x + 100, ME.y);
    a.s.entities.comps.fighter[dead]!.state = 'dead';
    a.run(2);
    expect(ai(a, near).target).toBe(a.me);
    expect(ai(a, dead).target).toBeNull();
  });
});

describe('flyer', () => {
  it('crosses a wall that stops a ground creature', () => {
    const a = arena(true);
    const fly = spawnCreature(a.s, FLYER, 38 * 16, 30 * 16 + 14);
    const ground = spawnCreature(a.s, GROUND, 38 * 16, 34 * 16 + 14);
    // The avatar is west of the wall (tile x 34), the creatures east of it, inside notice.
    a.s.entities.comps.pos[a.me]!.x = px(32 * 16 + 8);
    a.run(200);
    const flyX = a.s.entities.comps.pos[fly]!.x / 256;
    const groundX = a.s.entities.comps.pos[ground]!.x / 256;
    // The flyer hangs over the wall tile (34 * 16 to 35 * 16) to reach its target. The walker
    // is stopped at the wall's east face.
    expect(flyX).toBeLessThan(35 * 16);
    expect(groundX).toBeGreaterThanOrEqual(35 * 16 - 1);
    expect(attacks(a, fly)).toBeGreaterThanOrEqual(1);
    expect(attacks(a, ground)).toBe(0);
  });

  it('a flyer body passes tiles, and nothing else does', () => {
    const a = arena();
    const fly = spawnCreature(a.s, FLYER, ME.x + 100, ME.y);
    const ground = spawnCreature(a.s, GROUND, ME.x + 100, ME.y + 40);
    expect(a.s.entities.comps.body[fly]!.pass).toBe(true);
    expect(a.s.entities.comps.body[ground]!.pass).toBeUndefined();
  });
});

describe('burrower', () => {
  it('goes under, cannot be hurt there, rises beside its target, strikes, and sinks again', () => {
    const a = arena();
    const m = spawnCreature(a.s, MOLE, ME.x + 90, ME.y);
    const body = () => a.s.entities.comps.body[m]!;
    const fighter = () => a.s.entities.comps.fighter[m]!;
    let underTicks = 0;
    let unhurtUnder = true;
    let passedUnder = true;
    for (let i = 0; i < 400; i++) {
      a.run(1);
      if (ai(a, m).state === 'burrow') {
        underTicks++;
        if (fighter().invuln <= 0) unhurtUnder = false;
        if (!body().pass || body().solid) passedUnder = false;
      }
    }
    const types = a.events.map((e) => e.type).filter((t) => t === 'burrowed' || t === 'surfaced');
    expect(types.slice(0, 2)).toEqual(['burrowed', 'surfaced']);
    expect(types.filter((t) => t === 'burrowed').length).toBeGreaterThanOrEqual(1);
    expect(underTicks).toBeGreaterThan(0);
    expect(unhurtUnder).toBe(true);
    expect(passedUnder).toBe(true);
    expect(attacks(a, m)).toBeGreaterThanOrEqual(1);
    // Risen it is a plain solid body on the ground again.
    a.run(1);
    if (ai(a, m).state === 'surface') {
      expect(body().solid).toBe(true);
      expect(body().pass).toBeUndefined();
    }
  });

  it('tunnels under a wall that would stop it on the surface, and never rises inside it', () => {
    const a = arena(true);
    const m = spawnCreature(a.s, MOLE, 38 * 16, 30 * 16 + 14);
    a.s.entities.comps.pos[a.me]!.x = px(32 * 16 + 8);
    let west = Infinity;
    let risenInWall = false;
    for (let i = 0; i < 400; i++) {
      a.run(1);
      // The avatar fights back and may kill it: stop watching then.
      if (!a.s.entities.alive[m]) break;
      const x = a.s.entities.comps.pos[m]!.x / 256;
      west = Math.min(west, x);
      // Risen, its 12 px body may not overlap the wall column (x 544 to 560).
      if (ai(a, m).state === 'surface' && x > 34 * 16 - 6 && x < 35 * 16 + 6) risenInWall = true;
    }
    expect(west).toBeLessThan(34 * 16);
    expect(risenInWall).toBe(false);
    expect(attacks(a, m)).toBeGreaterThanOrEqual(1);
  });

  it('comes back up, solid and hurtable, when it is pulled to its leash while under', () => {
    const a = arena();
    const m = spawnCreature(a.s, MOLE, ME.x + 90, ME.y);
    a.run(15);
    expect(ai(a, m).state).toBe('burrow');
    // The target vanishes far away: the mole surfaces on its way home.
    a.s.entities.comps.pos[a.me]!.x = px(ME.x - 700);
    a.run(10);
    expect(['leash', 'idle']).toContain(ai(a, m).state);
    expect(a.s.entities.comps.body[m]!.solid).toBe(true);
    expect(a.s.entities.comps.body[m]!.pass).toBeUndefined();
    expect(a.s.entities.comps.fighter[m]!.invuln).toBe(0);
  });

  it('rises close enough for its strike to reach', () => {
    const swipe = ATTACKS['attack.creature_swipe']!;
    expect(AR.burrower.surfaceDist).toBeLessThanOrEqual(
      (CREATURES[MOLE] as CreatureDef).attacks[0]!.range,
    );
    expect(swipe.windup).toBeGreaterThan(0);
  });
});

describe('archetype data rules', () => {
  const refs: ContentRefs = {
    attacks: ATTACKS,
    sprites: new Set(SPRITES.map((s) => s.id)),
    sfx: new Set(SFX.map((s) => s.id)),
  };
  const check = (c: CreatureDef): string[] => validateCreatures({ [c.id]: c }, {}, refs);
  const sprite = { sprite: 'creature.mossling' };

  it('a guard needs a tether no longer than its leash, and only a guard may have one', () => {
    const g = { ...(CREATURES[GUARD] as CreatureDef), id: 'creature.v_guard', ...sprite };
    expect(check(g)).toEqual([]);
    expect(check(without(g, 'tether')).join('\n')).toMatch(/a guard needs a tether/);
    expect(check({ ...g, tether: 500 }).join('\n')).toMatch(/longer than leash/);
    const c = { ...(CREATURES[GROUND] as CreatureDef), id: 'creature.v_c', tether: 50, ...sprite };
    expect(check(c).join('\n')).toMatch(/only a guard has a tether/);
  });

  it('a swarm needs a pack', () => {
    const r = { ...(CREATURES[RAT] as CreatureDef), id: 'creature.v_rat', ...sprite };
    expect(check(r)).toEqual([]);
    expect(check(without(r, 'pack')).join('\n')).toMatch(/a swarm needs a pack/);
  });
});
