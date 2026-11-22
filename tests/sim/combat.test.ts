import { describe, expect, it } from 'vitest';
import { COMBAT as C } from '../../src/content/balance/combat';
import { ATTACKS, WEAPONS } from '../../src/content/combat/attacks';
import { CREATURES } from '../../src/content/creatures';
import { computeDamage, skillFactor } from '../../src/sim/combat/damage';
import { spawnEnemy } from '../../src/sim/combat/enemy';
import { startAttack } from '../../src/sim/combat/fighter';
import { inShape } from '../../src/sim/combat/geometry';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import type { Command } from '../../src/sim/kernel/commands';
import { Dir, px, type Direction } from '../../src/sim/kernel/fixed';
import type { SimEvent } from '../../src/sim/kernel/events';
import { know } from '../support/know';
import { withRustySword } from '../support/oldKit';
import { createDemoState, hashState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};

interface Arena {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...cmds: Command[]) => void;
  run: (n: number, ...cmds: Command[]) => void;
}

/** An arena with the avatar at tile (20, 20) and a log of every event. */
function arena(scheme: 'flow' | 'classic' = 'flow'): Arena {
  const s = createDemoState(7, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  // The combat balance is written against the base sword, not the starting dagger.
  withRustySword(s, me);
  know(s, me, 'technique.blades_lunge');
  const events: SimEvent[] = [];
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds });
    events.push(...s.events.list);
  };
  tick({ type: 'scheme', scheme });
  const run = (n: number, ...cmds: Command[]): void => {
    for (let i = 0; i < n; i++) tick(...(i === 0 ? cmds : []));
  };
  return { s, me, events, tick, run };
}

const where = (s: SimState, id: number) => ({
  x: (s.entities.comps.pos[id]?.x ?? 0) / 256,
  y: (s.entities.comps.pos[id]?.y ?? 0) / 256,
});
const pools = (s: SimState, id: number) => s.entities.comps.pools[id]!;
const fighter = (s: SimState, id: number) => s.entities.comps.fighter[id]!;
const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);

/** Turns the avatar to face `dir` (a cardinal) and stops. */
function face(a: Arena, dir: Direction = Dir.E): void {
  a.run(2, { type: 'move', dir });
  a.run(1, { type: 'move', dir: null });
  a.events.length = 0;
}

/** An enemy standing `dx` px east of the avatar on the same row. */
function enemyEast(a: Arena, dx: number, id = 'creature.mossling'): number {
  const p = where(a.s, a.me);
  return spawnEnemy(a.s, id, p.x + dx, p.y);
}

describe('damage formula', () => {
  it('follows design/04: power x multiplier x skill x element x base/(base+defense)', () => {
    const o = { crit: false, staggered: false };
    expect(computeDamage(10, 100, 0, 0, 100, o)).toBe(10);
    // base / (base + defense): defense equal to the base halves a hit (base is 50, G4 playtest).
    expect(computeDamage(10, 100, 0, 50, 100, o)).toBe(5);
    // A full tier 2 set (defense 28) takes a bit over a third off.
    expect(computeDamage(14, 100, 0, 28, 100, o)).toBe(9);
    expect(computeDamage(10, 150, 0, 0, 100, o)).toBe(15);
    expect(computeDamage(10, 100, 100, 0, 100, o)).toBe(20);
    expect(computeDamage(10, 100, 0, 0, 150, o)).toBe(15);
  });
  it('skill factor runs from 1.0 at rank 0 to 2.0 at rank 100', () => {
    expect(skillFactor(0)).toBe(1000);
    expect(skillFactor(100)).toBe(2000);
    expect(skillFactor(500)).toBe(2000);
  });
  it('crit and stagger bonus multiply, and damage is never below 1', () => {
    expect(computeDamage(10, 100, 0, 0, 100, { crit: true, staggered: false })).toBe(15);
    expect(computeDamage(10, 100, 0, 0, 100, { crit: false, staggered: true })).toBe(15);
    expect(computeDamage(10, 100, 0, 0, 100, { crit: true, staggered: true })).toBe(23);
    expect(computeDamage(1, 10, 0, 900, 100, { crit: false, staggered: false })).toBe(1);
  });
});

describe('hit shapes', () => {
  const east = { x: 1, y: 0 };
  it('an arc reaches in front but not behind, and has a limited angle', () => {
    const arc = { kind: 'arc', reach: 24, cos256: 128 } as const;
    expect(inShape(arc, east, { x: 20, y: 0 }, 4)).toBe(true);
    expect(inShape(arc, east, { x: 10, y: 25 }, 4)).toBe(false);
    expect(inShape(arc, east, { x: -20, y: 0 }, 4)).toBe(false);
    expect(inShape(arc, east, { x: 40, y: 0 }, 4)).toBe(false);
  });
  it('a line is narrow and long', () => {
    const line = { kind: 'line', reach: 40, halfWidth: 7 } as const;
    expect(inShape(line, east, { x: 38, y: 5 }, 4)).toBe(true);
    expect(inShape(line, east, { x: 20, y: 14 }, 4)).toBe(false);
    expect(inShape(line, east, { x: 60, y: 0 }, 4)).toBe(false);
  });
});

describe('Flow scheme', () => {
  it('swings automatically on the weapon cadence while a target is in reach, including while moving', () => {
    const a = arena('flow');
    const en = enemyEast(a, 16);
    a.s.entities.comps.pools[en]!.hp = 100000;
    a.s.entities.comps.pools[en]!.hpMax = 100000;
    a.s.entities.comps.stagger[en]!.max = 100000;
    face(a);
    // Keep walking at it: knockback pushes it away, and Flow swings while moving.
    a.run(1, { type: 'move', dir: Dir.E });
    a.run(60);
    const swings = ofType(a.events, 'attackStarted');
    const w = WEAPONS.sword!;
    const def = ATTACKS[w.auto]!;
    const cadence = def.windup + def.active + def.recover + C.flowGap;
    expect(swings.length).toBeGreaterThanOrEqual(2);
    expect(swings.length).toBeLessThanOrEqual(Math.ceil(60 / cadence) + 1);
    expect(ofType(a.events, 'damageDealt').length).toBeGreaterThan(0);
  });

  it('does not swing at something out of reach or behind', () => {
    const a = arena('flow');
    enemyEast(a, 80);
    a.run(1, { type: 'move', dir: Dir.E });
    a.run(1, { type: 'move', dir: null });
    a.events.length = 0;
    a.run(40);
    expect(ofType(a.events, 'attackStarted')).toHaveLength(0);
    const b = arena('flow');
    enemyEast(b, -16);
    b.run(1, { type: 'move', dir: Dir.E });
    b.run(1, { type: 'move', dir: null });
    b.events.length = 0;
    b.run(40);
    expect(ofType(b.events, 'attackStarted')).toHaveLength(0);
  });

  it('ignores the attack button (that is Classic)', () => {
    const a = arena('flow');
    a.run(2, { type: 'attack' });
    expect(ofType(a.events, 'attackStarted')).toHaveLength(0);
  });
});

describe('Classic scheme', () => {
  it('a press starts the first combo step, presses in the chain window continue, the third hits hardest', () => {
    const a = arena('classic');
    const en = enemyEast(a, 18);
    pools(a.s, en).hp = 100000;
    pools(a.s, en).hpMax = 100000;
    a.s.entities.comps.stagger[en]!.max = 100000;
    face(a);
    a.run(1, { type: 'attack' });
    expect(fighter(a.s, a.me).state).toBe('attack');
    const steps: string[] = [];
    for (let i = 0; i < 80 && steps.length < 3; i++) {
      const f = fighter(a.s, a.me);
      const def = f.atk ? ATTACKS[f.atk] : undefined;
      // Competent play: press in the last ticks of recovery.
      const press =
        !!def && f.state === 'attack' && f.t >= def.windup + def.active + def.recover - 2;
      a.tick(...(press ? [{ type: 'attack' } as const] : []));
      for (const e of a.events.splice(0)) if (e.type === 'attackStarted') steps.push(e.attack);
    }
    expect(steps).toEqual(['attack.sword_combo_1', 'attack.sword_combo_2', 'attack.sword_combo_3']);
  });

  it('the combo resets after the player stops pressing', () => {
    const a = arena('classic');
    a.run(1, { type: 'attack' });
    a.run(40);
    expect(fighter(a.s, a.me).combo).toBe(0);
    a.events.length = 0;
    a.run(1, { type: 'attack' });
    expect(ofType(a.events, 'attackStarted')[0]?.attack).toBe('attack.sword_combo_1');
  });
});

describe('dodge', () => {
  /** The enemy starts a swing aimed at the avatar. Returns the tick the active frames begin. */
  function enemySwing(a: Arena, en: number): void {
    const me = where(a.s, a.me);
    startAttack(a.s, en, 'attack.creature_swipe', { x: me.x, y: me.y - 4 });
  }

  it('i-frames prevent damage and emit dodged', () => {
    const a = arena();
    const en = enemyEast(a, 14);
    enemySwing(a, en);
    const def = ATTACKS['attack.creature_swipe']!;
    // Dodge so the impact lands inside the i-frames (east, along the swing's aim).
    a.run(def.windup - 3);
    a.run(1, { type: 'dodge', dir: Dir.N });
    a.run(def.active + 6);
    expect(pools(a.s, a.me).hp).toBe(pools(a.s, a.me).hpMax);
    expect(ofType(a.events, 'dodged').length).toBeGreaterThan(0);
  });

  it('a dodge started within the window before impact is a perfect dodge', () => {
    const a = arena();
    const en = enemyEast(a, 14);
    enemySwing(a, en);
    const def = ATTACKS['attack.creature_swipe']!;
    a.run(def.windup - 2);
    a.run(1, { type: 'dodge', dir: Dir.N });
    a.run(8);
    expect(ofType(a.events, 'perfectDodge').length).toBeGreaterThan(0);
  });

  it('a dodge that starts too early is not perfect, but still avoids the hit if i-frames cover it', () => {
    const a = arena();
    const en = enemyEast(a, 14);
    enemySwing(a, en);
    a.run(1, { type: 'dodge', dir: Dir.N });
    a.run(40);
    expect(ofType(a.events, 'perfectDodge')).toHaveLength(0);
  });

  it('a dodge that starts after the hit lands does not help', () => {
    const a = arena();
    const en = enemyEast(a, 14);
    enemySwing(a, en);
    const def = ATTACKS['attack.creature_swipe']!;
    a.run(def.windup + 1);
    expect(pools(a.s, a.me).hp).toBeLessThan(pools(a.s, a.me).hpMax);
  });

  it('costs stamina and moves the avatar', () => {
    const a = arena();
    const before = where(a.s, a.me);
    a.run(1, { type: 'dodge', dir: Dir.W });
    a.run(C.dodge.ticks);
    expect(pools(a.s, a.me).sta).toBeLessThanOrEqual(
      C.pools.staMax - C.dodge.cost + C.pools.staRegen * C.dodge.ticks,
    );
    expect(before.x - where(a.s, a.me).x).toBeGreaterThan(C.dodge.distance - 6);
  });

  it('stamina at zero prevents the dodge', () => {
    const a = arena();
    pools(a.s, a.me).sta = C.dodge.cost - 1;
    a.events.length = 0;
    a.run(1, { type: 'dodge', dir: Dir.W });
    expect(ofType(a.events, 'denied')[0]?.reason).toBe('stamina');
    expect(fighter(a.s, a.me).state).toBe('idle');
    a.run(10);
    expect(where(a.s, a.me).x).toBeCloseTo(feetAt(20, 20).x / 256, 0);
  });
});

describe('stagger', () => {
  it('breaks at the threshold, makes the enemy helpless, and bonus damage applies', () => {
    const a = arena('classic');
    const en = enemyEast(a, 16);
    pools(a.s, en).hp = 100000;
    pools(a.s, en).hpMax = 100000;
    a.s.entities.comps.stagger[en]!.max = 20;
    face(a);
    a.run(1, { type: 'move', dir: Dir.E });
    // 8 + 8 + 16 from the first combo: break lands on the third step.
    let broke = -1;
    for (let i = 0; i < 90 && broke < 0; i++) {
      const f = fighter(a.s, a.me);
      const def = f.atk ? ATTACKS[f.atk] : undefined;
      const press =
        f.state === 'idle' || (!!def && f.t >= def.windup + def.active + def.recover - 2);
      a.tick(...(press ? [{ type: 'attack' } as const] : []));
      if (ofType(a.events, 'staggerBreak').length > 0) broke = i;
    }
    expect(broke).toBeGreaterThan(0);
    expect(fighter(a.s, en).state).toBe('stagger');
    const hits = ofType(a.events, 'damageDealt');
    expect(hits.filter((h) => h.bonus).length).toBe(0);
    a.events.length = 0;
    a.run(1, { type: 'move', dir: Dir.E });
    for (let i = 0; i < 60; i++) {
      const f = fighter(a.s, a.me);
      const def = f.atk ? ATTACKS[f.atk] : undefined;
      const press =
        f.state === 'idle' || (!!def && f.t >= def.windup + def.active + def.recover - 2);
      a.tick(...(press ? [{ type: 'attack' } as const] : []));
      if (fighter(a.s, en).state !== 'stagger') break;
    }
    expect(ofType(a.events, 'damageDealt').some((h) => h.bonus)).toBe(true);
  });

  it('the stagger bar drains when the enemy is left alone', () => {
    const a = arena();
    const en = enemyEast(a, 100);
    a.s.entities.comps.stagger[en]!.cur = 20;
    a.s.entities.comps.stagger[en]!.lastHit = a.s.tick;
    a.run(C.stagger.decayDelay + 90);
    expect(a.s.entities.comps.stagger[en]!.cur).toBeLessThan(20);
  });
});

describe('hit feedback in the sim', () => {
  it('a hit pauses both sides and knocks the target back', () => {
    const a = arena('classic');
    const en = enemyEast(a, 16);
    const start = where(a.s, en).x;
    face(a);
    a.run(1, { type: 'attack' });
    let paused = false;
    for (let i = 0; i < 20; i++) {
      a.tick();
      if (fighter(a.s, a.me).hitstop > 0 && fighter(a.s, en).hitstop > 0) paused = true;
    }
    expect(paused).toBe(true);
    expect(where(a.s, en).x).toBeGreaterThan(start + 3);
  });
});

describe('death and the Echo', () => {
  function kill(a: Arena): void {
    const en = enemyEast(a, 14);
    a.s.entities.comps.combatant[en]!.power = 1000;
    startAttack(a.s, en, 'attack.creature_swipe', {
      x: where(a.s, a.me).x,
      y: where(a.s, a.me).y - 4,
    });
    a.run(ATTACKS['attack.creature_swipe']!.windup + 4);
  }

  it('moves the avatar to the Waystone and leaves 10% of coin as an Echo at the death spot', () => {
    const a = arena();
    a.s.entities.comps.avatar[a.me]!.coin = 200;
    const spot = where(a.s, a.me);
    a.s.entities.comps.avatar[a.me]!.respawn = { x: px(100), y: px(100) };
    kill(a);
    expect(fighter(a.s, a.me).state).toBe('dead');
    a.run(C.death.respawnDelay + 2);
    expect(fighter(a.s, a.me).state).toBe('idle');
    expect(where(a.s, a.me)).toEqual({ x: 100, y: 100 });
    expect(pools(a.s, a.me).hp).toBe(pools(a.s, a.me).hpMax);
    expect(a.s.entities.comps.avatar[a.me]!.coin).toBe(180);
    const drop = ofType(a.events, 'echoDropped');
    expect(drop).toHaveLength(1);
    expect(drop[0]?.coin).toBe(20);
    const echoId = drop[0]!.id;
    expect(a.s.entities.comps.echo[echoId]?.coin).toBe(20);
    const at = where(a.s, echoId);
    expect(Math.abs(at.x - spot.x)).toBeLessThan(16);
  });

  it('walking onto the Echo recovers the coin', () => {
    const a = arena();
    a.s.entities.comps.avatar[a.me]!.coin = 200;
    const spot = where(a.s, a.me);
    a.s.entities.comps.avatar[a.me]!.respawn = { x: px(spot.x - 60), y: px(spot.y) };
    kill(a);
    a.run(C.death.respawnDelay + 2);
    a.run(60, { type: 'move', dir: Dir.E });
    expect(ofType(a.events, 'echoRecovered')).toHaveLength(1);
    expect(a.s.entities.comps.avatar[a.me]!.coin).toBe(200);
  });

  it('a second death before recovery loses the first Echo', () => {
    const a = arena();
    a.s.entities.comps.avatar[a.me]!.coin = 200;
    a.s.entities.comps.avatar[a.me]!.respawn = { x: px(100), y: px(100) };
    kill(a);
    a.run(C.death.respawnDelay + 2);
    a.s.entities.comps.avatar[a.me]!.respawn = { x: px(160), y: px(160) };
    const spot2 = where(a.s, a.me);
    startAttack(a.s, enemyEast(a, 14), 'attack.creature_swipe', { x: spot2.x, y: spot2.y - 4 });
    for (const id of [...a.s.entities.comps.combatant.keys()]) {
      if (a.s.entities.comps.fighter[id]?.team === 1)
        a.s.entities.comps.combatant[id]!.power = 1000;
    }
    a.run(ATTACKS['attack.creature_swipe']!.windup + 4);
    a.run(C.death.respawnDelay + 2);
    expect(ofType(a.events, 'echoLost')).toHaveLength(1);
    expect(ofType(a.events, 'echoDropped')).toHaveLength(2);
    expect(a.s.entities.comps.avatar[a.me]!.coin).toBe(180 - 18);
  });

  it('no XP or progress is lost and an enemy death removes the body after a linger', () => {
    const a = arena('classic');
    const en = enemyEast(a, 16);
    pools(a.s, en).hp = 1;
    face(a);
    a.run(1, { type: 'attack' });
    a.run(20);
    expect(ofType(a.events, 'died').some((d) => d.team === 1)).toBe(true);
    a.run(C.death.enemyLinger + 2);
    expect(a.s.entities.alive[en]).toBe(false);
  });
});

describe('pool regeneration', () => {
  it('Health does not regenerate in combat, and does after a quiet spell', () => {
    const a = arena();
    pools(a.s, a.me).hp = 50;
    pools(a.s, a.me).lastCombat = a.s.tick;
    a.run(C.pools.hpRegenDelay - 10);
    expect(pools(a.s, a.me).hp).toBe(50);
    a.run(120);
    expect(pools(a.s, a.me).hp).toBeGreaterThan(50);
    expect(pools(a.s, a.me).hp).toBeLessThan(70);
  });
  it('Stamina regenerates fast after a short delay', () => {
    const a = arena();
    pools(a.s, a.me).sta = 0;
    pools(a.s, a.me).lastSpend = a.s.tick;
    a.run(C.pools.staRegenDelay - 2);
    expect(pools(a.s, a.me).sta).toBe(0);
    a.run(30);
    expect(pools(a.s, a.me).sta).toBeGreaterThan(300);
  });
  it('Focus regenerates slowly, and faster standing still', () => {
    const still = arena();
    const moving = arena();
    pools(still.s, still.me).foc = 0;
    pools(moving.s, moving.me).foc = 0;
    still.run(60);
    moving.run(60, { type: 'move', dir: Dir.E });
    expect(pools(still.s, still.me).foc).toBeGreaterThan(pools(moving.s, moving.me).foc);
    expect(pools(still.s, still.me).foc).toBeLessThan(100);
  });
});

describe('lock', () => {
  it('a tap on an enemy locks it, a tap on empty ground clears it, and death or distance drops it', () => {
    const a = arena('classic');
    const en = enemyEast(a, 40);
    const p = where(a.s, en);
    a.run(1, { type: 'lock', x: Math.round(p.x), y: Math.round(p.y - 4) });
    expect(fighter(a.s, a.me).lock).toBe(en);
    expect(ofType(a.events, 'lockChanged').some((e) => e.target === en)).toBe(true);
    a.run(1, { type: 'lock', x: 5, y: 5 });
    expect(fighter(a.s, a.me).lock).toBeNull();
    a.run(1, { type: 'lock', x: Math.round(p.x), y: Math.round(p.y - 4) });
    a.s.entities.comps.pos[en]!.x = px(p.x + 400);
    a.run(2);
    expect(fighter(a.s, a.me).lock).toBeNull();
  });
  it('a locked target is faced', () => {
    const a = arena('classic');
    const p = where(a.s, a.me);
    const en = spawnEnemy(a.s, 'creature.mossling', p.x, p.y - 60);
    const c = where(a.s, en);
    a.run(1, { type: 'lock', x: Math.round(c.x), y: Math.round(c.y - 4) });
    a.run(2);
    expect(a.s.entities.comps.avatar[a.me]!.facing).toBe(Dir.N);
  });
});

describe('weapons and techniques', () => {
  it('the spear reaches farther than the sword and pierces two targets in a line', () => {
    const sword = arena('classic');
    const spear = arena('classic');
    spear.s.entities.comps.combatant[spear.me]!.weapon = 'spear';
    spear.s.entities.comps.combatant[spear.me]!.power = WEAPONS.spear!.power;
    for (const a of [sword, spear]) {
      a.run(1, { type: 'move', dir: Dir.E });
      a.run(1, { type: 'move', dir: null });
    }
    const near1 = enemyEast(spear, 22);
    const far1 = enemyEast(spear, 40);
    const near0 = enemyEast(sword, 22);
    const far0 = enemyEast(sword, 40);
    for (const a of [sword, spear]) {
      a.run(1, { type: 'attack' });
      a.run(14);
    }
    expect(pools(spear.s, near1).hp).toBeLessThan(pools(spear.s, near1).hpMax);
    expect(pools(spear.s, far1).hp).toBeLessThan(pools(spear.s, far1).hpMax);
    expect(pools(sword.s, near0).hp).toBeLessThan(pools(sword.s, near0).hpMax);
    expect(pools(sword.s, far0).hp).toBe(pools(sword.s, far0).hpMax);
  });

  it('the lunge costs Stamina, dashes forward and hits harder than a slash', () => {
    const a = arena();
    const en = enemyEast(a, 40);
    a.run(1, { type: 'move', dir: Dir.E });
    a.run(1, { type: 'move', dir: null });
    const x0 = where(a.s, a.me).x;
    const sta0 = pools(a.s, a.me).sta;
    a.run(1, { type: 'technique', slot: 0, phase: 'press', aim: null });
    expect(pools(a.s, a.me).sta).toBeLessThan(sta0 - 200);
    a.run(15);
    expect(where(a.s, a.me).x - x0).toBeGreaterThan(20);
    const hit = ofType(a.events, 'damageDealt').find((e) => e.dst === en);
    expect(hit).toBeDefined();
    expect(hit!.amount).toBeGreaterThan(
      computeDamage(10, 100, 0, CREATURES['creature.mossling']!.defense, 100, {
        crit: false,
        staggered: false,
      }),
    );
  });

  it('the lunge is denied on cooldown and without Stamina', () => {
    const a = arena();
    a.run(1, { type: 'technique', slot: 0, phase: 'press', aim: null });
    a.run(25);
    a.events.length = 0;
    a.run(1, { type: 'technique', slot: 0, phase: 'press', aim: null });
    expect(ofType(a.events, 'denied')[0]?.reason).toBe('cooldown');
    const b = arena();
    pools(b.s, b.me).sta = 10;
    b.run(1, { type: 'technique', slot: 0, phase: 'press', aim: null });
    expect(ofType(b.events, 'denied')[0]?.reason).toBe('stamina');
  });

  it('Ember bolt costs Focus, is aimed by holding, fires on release, and hits at range', () => {
    const a = arena();
    // A new character does not know Ember. Slot it as if learned.
    fighter(a.s, a.me).slots[1] = 'technique.ember_bolt';
    const en = enemyEast(a, 90);
    const foc0 = pools(a.s, a.me).foc;
    a.run(1, { type: 'technique', slot: 1, phase: 'aim', aim: Dir.E });
    expect(ofType(a.events, 'projectileLaunched')).toHaveLength(0);
    expect(fighter(a.s, a.me).aiming).toBe(1);
    a.run(5);
    a.run(1, { type: 'technique', slot: 1, phase: 'release', aim: Dir.E });
    a.run(40);
    expect(ofType(a.events, 'projectileLaunched')).toHaveLength(1);
    expect(pools(a.s, a.me).foc).toBeLessThan(foc0 - 250);
    expect(pools(a.s, en).hp).toBeLessThan(pools(a.s, en).hpMax);
  });

  it('a bolt stops at a wall', () => {
    const a = arena();
    a.s.world = { solidAt: (tx) => (tx >= 24 ? 1 : 0) };
    const en = enemyEast(a, 90);
    a.run(1, { type: 'technique', slot: 1, phase: 'press', aim: Dir.E });
    a.run(40);
    expect(pools(a.s, en).hp).toBe(pools(a.s, en).hpMax);
  });
});

describe('determinism and commands', () => {
  it('same seed and commands give the same state hash, crits included', () => {
    const run = (): string => {
      const a = arena();
      enemyEast(a, 16);
      a.run(1, { type: 'move', dir: Dir.E });
      a.run(120);
      return hashState(a.s);
    };
    expect(run()).toBe(run());
  });
});

describe('time to kill', () => {
  /** Scripted competent play against the par common enemy. Returns ticks until it dies. */
  function fight(scheme: 'flow' | 'classic'): number {
    const a = arena(scheme);
    const en = enemyEast(a, 40);
    const swipe = ATTACKS['attack.creature_swipe']!;
    let swingAt = -1;
    for (let tick = 1; tick <= 30 * 20; tick++) {
      if (!a.s.entities.alive[en] || fighter(a.s, en).state === 'dead') return tick;
      const me = where(a.s, a.me);
      const ep = where(a.s, en);
      const dx = ep.x - me.x;
      const dy = ep.y - me.y;
      const dist = Math.hypot(dx, dy);
      const ef = fighter(a.s, en);
      const cmds: Command[] = [];
      // The creature swings whenever it is idle and the avatar is close.
      if (ef.state === 'idle' && dist < 26 && swingAt < 0) {
        startAttack(a.s, en, swipe.id, { x: me.x, y: me.y - 4 });
        swingAt = tick;
      }
      if (swingAt >= 0 && tick - swingAt > 40) swingAt = -1;
      const pf = fighter(a.s, a.me);
      // Dodge near impact, when there is Stamina.
      if (ef.state === 'attack' && ef.t === swipe.windup - 4 && pf.state === 'idle')
        cmds.push({ type: 'dodge', dir: dy > 0 ? Dir.N : Dir.S });
      else if (pf.state === 'idle' || pf.state === 'attack') {
        // Close the gap, then fight.
        const dir: Direction | null =
          dist > 20 && pf.state === 'idle'
            ? Math.abs(dx) > 4
              ? dx > 0
                ? Dir.E
                : Dir.W
              : dy > 0
                ? Dir.S
                : Dir.N
            : null;
        cmds.push({ type: 'move', dir });
        if (scheme === 'classic' && dist <= 26) {
          const def = pf.atk ? ATTACKS[pf.atk] : undefined;
          const press =
            pf.state === 'idle' || (!!def && pf.t >= def.windup + def.active + def.recover - 3);
          if (press) cmds.push({ type: 'attack' });
        }
      }
      a.tick(...cmds);
    }
    return 30 * 20;
  }

  it('is inside 4 to 8 seconds against the par common enemy, in both schemes', () => {
    for (const scheme of ['flow', 'classic'] as const) {
      const secs = fight(scheme) / 30;
      expect(secs, scheme).toBeGreaterThanOrEqual(4);
      expect(secs, scheme).toBeLessThanOrEqual(8);
    }
  });

  it('Flow and Classic are within 15% of each other', () => {
    const flow = fight('flow');
    const classic = fight('classic');
    expect(Math.abs(flow - classic) / Math.max(flow, classic)).toBeLessThanOrEqual(0.15);
  });
});

describe('a new character', () => {
  it('knows no technique at all, so nothing sits in a slot', () => {
    const s = createDemoState(7, 0);
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y);
    expect(fighter(s, me).slots).toEqual([null, null, null, null]);
  });
});
