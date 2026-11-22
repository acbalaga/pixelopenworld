import { describe, expect, it } from 'vitest';
import { COMBAT as C } from '../../src/content/balance/combat';
import { ATTACKS } from '../../src/content/combat/attacks';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature, spawnEnemy } from '../../src/sim/combat/enemy';
import { dealDamage, startAttack, type HitInfo } from '../../src/sim/combat/fighter';
import { chargePct } from '../../src/sim/combat/properties';
import { equip, give } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { Dir, type Direction } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { hostileCreatures } from '../support/temperament';

hostileCreatures('creature.mossling');

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...cmds: Command[]) => void;
  run: (n: number, ...cmds: Command[]) => void;
}

/** An arena with the avatar at tile (20, 20), a log of every event, and a chosen scheme. */
function rig(scheme: 'flow' | 'classic' = 'flow'): Rig {
  const s = createDemoState(7, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
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

const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const fighter = (r: Rig, id = r.me) => r.s.entities.comps.fighter[id]!;
const pools = (r: Rig, id = r.me) => r.s.entities.comps.pools[id]!;
const pos = (r: Rig, id = r.me) => ({
  x: Math.round(r.s.entities.comps.pos[id]!.x / 256),
  y: Math.round(r.s.entities.comps.pos[id]!.y / 256),
});

/** Equips a bag item, giving it first if the bag lacks it. */
function wear(r: Rig, item: string): void {
  const inv = r.s.entities.comps.inventory[r.me]!;
  if (!inv.slots.some((x) => x?.item === item)) give(r.s, r.me, item, 1, 'start');
  equip(
    r.s,
    r.me,
    inv.slots.findIndex((x) => x?.item === item),
  );
}

/** Turns the avatar to face `dir` and stops. */
function face(r: Rig, dir: Direction = Dir.E): void {
  r.run(2, { type: 'move', dir });
  r.run(3, { type: 'move', dir: null });
  r.events.length = 0;
}

/** A hit as a swing of `tag` would carry it. */
function hitOf(
  r: Rig,
  tag: string,
  from: { x: number; y: number },
  over: Partial<HitInfo> = {},
): HitInfo {
  return {
    src: r.me,
    from,
    power: 10,
    rank: 0,
    mult: 100,
    stagger: 8,
    knock: 6,
    element: 100,
    heavy: false,
    tag,
    ...over,
  };
}

/**
 * Damage one hit does, with a crit thrown away: a fresh target takes the hit until one lands
 * without a crit, so the property under test is the only thing that varies.
 */
function damageOf(
  r: Rig,
  tag: string,
  prep: (foe: number) => { x: number; y: number },
  over: Partial<HitInfo> = {},
): number {
  for (let i = 0; i < 40; i++) {
    const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
    const from = prep(foe);
    const before = r.events.length;
    r.s.events.list.length = 0;
    dealDamage(r.s, foe, hitOf(r, tag, from, over));
    r.events.push(...r.s.events.list);
    const e = ofType(r.events.slice(before), 'damageDealt')[0];
    if (e && !e.crit) return e.amount;
  }
  throw new Error('no plain hit in 40 tries');
}

describe('Blades: from behind and on the staggered', () => {
  // A brainless enemy faces south. North of it is behind it, south is in front.
  const behind = { x: 400, y: 286 };
  const front = { x: 400, y: 314 };
  it('a hit from behind does more than a hit from the front', () => {
    const r = rig();
    const f = damageOf(r, 'blades', () => front, { power: 20 });
    const b = damageOf(r, 'blades', () => behind, { power: 20 });
    expect(f).toBe(Math.round((20 * C.damage.defenseBase) / (C.damage.defenseBase + 5)));
    expect(b).toBeGreaterThan(f);
    expect(Math.abs(b - (f * C.weapons.blades.behindPct) / 100)).toBeLessThanOrEqual(1);
  });
  it('a hit from the side is not from behind', () => {
    const r = rig();
    const f = damageOf(r, 'blades', () => front, { power: 20 });
    const side = damageOf(r, 'blades', () => ({ x: 414, y: 300 }), { power: 20 });
    expect(side).toBe(f);
  });
  it('a staggered target takes the Blades bonus on top of the general one', () => {
    const r = rig();
    const plain = damageOf(r, 'polearms', () => front, { power: 40 });
    const staggered = damageOf(r, 'polearms', () => front, { power: 40, stagger: 0 });
    expect(staggered).toBe(plain);
    // Same target state, two tags: stagger the foe first.
    const dmg = (tag: string): number => {
      for (let i = 0; i < 40; i++) {
        const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
        fighter(r, foe).state = 'stagger';
        r.s.events.list.length = 0;
        dealDamage(r.s, foe, hitOf(r, tag, front, { power: 40 }));
        const e = ofType(r.s.events.list, 'damageDealt')[0]!;
        if (!e.crit) return e.amount;
      }
      throw new Error('no plain hit');
    };
    const other = dmg('polearms');
    const blades = dmg('blades');
    expect(other).toBeGreaterThan(plain);
    expect(Math.abs(blades - (other * C.weapons.blades.staggeredPct) / 100)).toBeLessThanOrEqual(1);
  });
});

describe('Heavy Arms: stagger and guard breaks', () => {
  it('a heavy hit fills the stagger bar faster than another family', () => {
    const r = rig();
    const bar = (tag: string): number => {
      const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
      dealDamage(r.s, foe, hitOf(r, tag, { x: 400, y: 314 }, { stagger: 10 }));
      return r.s.entities.comps.stagger[foe]!.cur;
    };
    expect(bar('heavy')).toBe(Math.floor((10 * C.weapons.heavy.staggerPct) / 100));
    expect(bar('blades')).toBe(10);
  });
  it('a heavy hit on a raised guard breaks it, and another family does not', () => {
    const r = rig();
    const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
    const g = fighter(r, foe);
    g.guard = true;
    g.guardT = 99;
    r.s.events.list.length = 0;
    // The foe faces south, so a hit from the south is a hit on its front.
    dealDamage(r.s, foe, hitOf(r, 'blades', { x: 400, y: 314 }));
    expect(g.guard).toBe(true);
    expect(ofType(r.s.events.list, 'guardBroken')).toHaveLength(0);
    r.s.events.list.length = 0;
    dealDamage(r.s, foe, hitOf(r, 'heavy', { x: 400, y: 314 }));
    expect(g.guard).toBe(false);
    expect(ofType(r.s.events.list, 'guardBroken')).toHaveLength(1);
  });
  it('the maul swings through the real combat loop and pays Heavy Arms', () => {
    const r = rig('classic');
    wear(r, 'item.maul_oak');
    face(r);
    const p = pos(r);
    const foe = spawnEnemy(r.s, 'creature.mossling', p.x + 16, p.y);
    r.run(1, { type: 'attack' });
    r.run(30);
    const hits = ofType(r.events, 'damageDealt').filter((e) => e.dst === foe);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.tag).toBe('heavy');
    expect(r.s.entities.comps.skills[r.me]!.xp['skill.heavy_arms']).toBeGreaterThan(0);
  });
});

describe('Polearms: two tiles deep, and out of reach after', () => {
  it('a thrust hits a foe at one tile and another at two, in line', () => {
    const r = rig('classic');
    wear(r, 'item.spear_ash');
    face(r);
    const p = pos(r);
    const near = spawnEnemy(r.s, 'creature.mossling', p.x + 14, p.y);
    const far = spawnEnemy(r.s, 'creature.mossling', p.x + 32, p.y);
    r.run(1, { type: 'attack' });
    r.run(20);
    const hit = new Set(ofType(r.events, 'damageDealt').map((e) => e.dst));
    expect(hit.has(near)).toBe(true);
    expect(hit.has(far)).toBe(true);
  });
  it('the hit pushes the target beyond a common swipe from where it stood', () => {
    const r = rig('classic');
    wear(r, 'item.spear_ash');
    face(r);
    const p = pos(r);
    const foe = spawnEnemy(r.s, 'creature.mossling', p.x + 10, p.y);
    r.run(1, { type: 'attack' });
    r.run(24);
    const dx = pos(r, foe).x - p.x;
    expect(dx).toBeGreaterThanOrEqual(C.weapons.polearms.keepOutPx);
    // Past the swipe's reach plus the body: it cannot hit back without closing again.
    expect(dx).toBeGreaterThan(20 + 6);
  });
});

describe('Archery: charge by standing still', () => {
  it('the charge rises with ticks stood still, to a cap', () => {
    expect(chargePct(0)).toBe(C.weapons.archery.minPct);
    expect(chargePct(10)).toBeGreaterThan(chargePct(0));
    expect(chargePct(C.weapons.archery.chargeTicks)).toBe(C.weapons.archery.maxPct);
    expect(chargePct(10_000)).toBe(C.weapons.archery.maxPct);
  });
  it('an arrow loosed after standing still carries more than one loosed on the move', () => {
    const shot = (still: number): number => {
      const r = rig('classic');
      wear(r, 'item.bow_short');
      face(r);
      fighter(r).still = still;
      // Hold the charge where the test put it: the avatar has not moved since.
      startAttack(r.s, r.me, 'attack.bow_shot', null);
      for (let i = 0; i < 12; i++) {
        r.tick();
        const arrow = r.s.entities.comps.projectile.find((x) => x);
        if (arrow) return arrow.mult;
        fighter(r).still = still;
      }
      throw new Error('no arrow');
    };
    expect(shot(C.weapons.archery.chargeTicks)).toBeGreaterThan(shot(0));
    expect(shot(C.weapons.archery.chargeTicks)).toBe(
      Math.floor((ATTACKS['attack.bow_shot']!.mult * C.weapons.archery.maxPct) / 100),
    );
  });
  it('moving resets the charge, and standing counts it', () => {
    const r = rig();
    r.run(3, { type: 'move', dir: Dir.E });
    expect(fighter(r).still).toBe(0);
    r.run(1, { type: 'move', dir: null });
    r.run(30);
    expect(fighter(r).still).toBeGreaterThan(10);
  });
  it('an arrow is a projectile that hits at range and pays Archery', () => {
    const r = rig('classic');
    wear(r, 'item.bow_short');
    face(r);
    const p = pos(r);
    const foe = spawnEnemy(r.s, 'creature.mossling', p.x + 80, p.y);
    r.run(1, { type: 'attack' });
    r.run(40);
    const hit = ofType(r.events, 'damageDealt').find((e) => e.dst === foe);
    expect(hit?.tag).toBe('archery');
    expect(r.s.entities.comps.skills[r.me]!.xp['skill.archery']).toBeGreaterThan(0);
  });
});

describe('Unarmed: hits refund Stamina', () => {
  it('each hit gives Stamina back, up to the bar', () => {
    const r = rig('classic');
    wear(r, 'item.wraps_cloth');
    face(r);
    const p = pos(r);
    spawnEnemy(r.s, 'creature.mossling', p.x + 12, p.y);
    pools(r).sta = 500;
    r.s.events.list.length = 0;
    // Stamina regenerates after a delay, so read it on the tick of the hit.
    let before = -1;
    r.run(1, { type: 'attack' });
    for (let i = 0; i < 20; i++) {
      before = pools(r).sta;
      r.tick();
      if (ofType(r.s.events.list, 'damageDealt').length > 0) break;
    }
    expect(pools(r).sta - before).toBeGreaterThanOrEqual(C.weapons.unarmed.refund);
    pools(r).sta = pools(r).staMax;
    dealDamage(
      r.s,
      spawnEnemy(r.s, 'creature.mossling', 400, 300),
      hitOf(r, 'unarmed', { x: 400, y: 314 }),
    );
    expect(pools(r).sta).toBe(pools(r).staMax);
  });
});

describe('Shieldcraft', () => {
  /** Avatar with a wooden shield, facing south (the default), guard up for `wait` ticks. */
  function shielded(wait: number): Rig {
    const r = rig();
    wear(r, 'item.shield_wood');
    r.run(1, { type: 'guard', on: true });
    r.run(wait);
    r.events.length = 0;
    return r;
  }
  const from = (r: Rig, dx: number, dy: number) => ({ x: pos(r).x + dx, y: pos(r).y - 4 + dy });

  it('a guard needs a shield', () => {
    const r = rig();
    r.run(1, { type: 'guard', on: true });
    expect(fighter(r).guard).toBe(false);
    wear(r, 'item.shield_wood');
    r.run(1, { type: 'guard', on: true });
    expect(fighter(r).guard).toBe(true);
    r.run(1, { type: 'unequip', slot: 'off' });
    expect(fighter(r).guard).toBe(false);
  });

  it('a block cuts damage from the front and costs Stamina, and not from behind', () => {
    const r = shielded(C.guard.parryWindow + 3);
    const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
    const sta = pools(r).sta;
    const hp = pools(r).hp;
    const hit = (dy: number) => {
      r.s.events.list.length = 0;
      dealDamage(r.s, r.me, { ...hitOf(r, 'creature', from(r, 0, dy), { src: foe }), power: 40 });
      return r.s.events.list;
    };
    // The avatar faces south: a hit from the south is a hit on its front.
    const front = hit(20);
    const blocked = ofType(front, 'blocked');
    expect(blocked).toHaveLength(1);
    const taken = hp - pools(r).hp;
    expect(pools(r).sta).toBe(sta - C.guard.cost);
    // Behind: full damage, no block, no Stamina.
    const hp2 = pools(r).hp;
    fighter(r).state = 'idle';
    const sta2 = pools(r).sta;
    const rear = hit(-20);
    expect(ofType(rear, 'blocked')).toHaveLength(0);
    const taken2 = hp2 - pools(r).hp;
    expect(pools(r).sta).toBe(sta2);
    expect(taken2).toBeGreaterThan(taken * 2);
    // The block scales the hit before it rounds, so allow one point of rounding.
    expect(Math.abs(taken - (taken2 * C.guard.takenPct) / 100)).toBeLessThanOrEqual(1);
  });

  it('a block begun just before the impact parries: no damage, and the attacker is staggered', () => {
    const r = rig();
    wear(r, 'item.shield_wood');
    const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
    r.run(1, { type: 'guard', on: true });
    r.run(C.guard.parryWindow - 2);
    r.events.length = 0;
    const hp = pools(r).hp;
    r.s.events.list.length = 0;
    dealDamage(r.s, r.me, hitOf(r, 'creature', from(r, 0, 20), { src: foe }));
    expect(pools(r).hp).toBe(hp);
    expect(ofType(r.s.events.list, 'parried')).toEqual([{ type: 'parried', who: r.me, src: foe }]);
    expect(ofType(r.s.events.list, 'damageDealt')).toHaveLength(0);
    // Parry stagger is enough to break a common enemy's bar.
    expect(ofType(r.s.events.list, 'staggerBreak')).toEqual([{ type: 'staggerBreak', id: foe }]);
    expect(fighter(r, foe).state).toBe('stagger');
  });

  it('a block raised too late to parry is only a block', () => {
    const r = shielded(C.guard.parryWindow + 1);
    const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
    r.s.events.list.length = 0;
    dealDamage(r.s, r.me, hitOf(r, 'creature', from(r, 0, 20), { src: foe }));
    expect(ofType(r.s.events.list, 'parried')).toHaveLength(0);
    expect(ofType(r.s.events.list, 'blocked')).toHaveLength(1);
  });

  it('with no Stamina left a hit breaks the guard and does full damage', () => {
    const r = shielded(C.guard.parryWindow + 3);
    const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
    pools(r).sta = C.guard.cost - 1;
    r.s.events.list.length = 0;
    dealDamage(r.s, r.me, hitOf(r, 'creature', from(r, 0, 20), { src: foe, power: 40 }));
    expect(ofType(r.s.events.list, 'guardBroken')).toHaveLength(1);
    expect(fighter(r).guard).toBe(false);
    expect(ofType(r.s.events.list, 'blocked')).toHaveLength(0);
  });

  it('walking while guarding is slower', () => {
    const run = (guard: boolean): number => {
      const r = rig();
      wear(r, 'item.shield_wood');
      if (guard) r.run(1, { type: 'guard', on: true });
      r.run(1, { type: 'move', dir: Dir.E });
      const x0 = pos(r).x;
      r.run(40);
      return pos(r).x - x0;
    };
    const slow = run(true);
    const fast = run(false);
    expect(slow).toBeLessThan(fast);
    expect(Math.abs(slow / fast - C.guard.walkPct / 100)).toBeLessThan(0.1);
  });

  it('a creature that attacks a guarding avatar is blocked, and Shieldcraft is paid', () => {
    const r = rig();
    wear(r, 'item.shield_wood');
    face(r);
    r.run(1, { type: 'guard', on: true });
    const p = pos(r);
    spawnCreature(r.s, 'creature.mossling', p.x + 30, p.y);
    r.run(150);
    expect(ofType(r.events, 'blocked').length + ofType(r.events, 'parried').length).toBeGreaterThan(
      0,
    );
    expect(r.s.entities.comps.skills[r.me]!.xp['skill.shieldcraft']).toBeGreaterThan(0);
  });

  it('the Trials objective sees a parry', () => {
    const r = shielded(1);
    const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
    r.s.events.list.length = 0;
    dealDamage(r.s, r.me, hitOf(r, 'creature', from(r, 0, 20), { src: foe }));
    expect(ofType(r.s.events.list, 'parried')[0]!.who).toBe(r.me);
  });
});

describe('time to kill', () => {
  /** Ticks from the first swing until a tier 1 Mossling dies, for a weapon at skill 0, basic attacks only. */
  function ttk(item: string, dist: number): number {
    const r = rig('flow');
    if (item) wear(r, item);
    face(r);
    const p = pos(r);
    const foe = spawnEnemy(r.s, 'creature.mossling', p.x + dist, p.y);
    const spot = { ...r.s.entities.comps.pos[foe]! };
    for (let t = 1; t <= 900; t++) {
      // A post to hit: knockback would otherwise carry the target out of a short reach.
      const at = r.s.entities.comps.pos[foe];
      if (at) {
        at.x = spot.x;
        at.y = spot.y;
      }
      r.tick();
      if (!r.s.entities.alive[foe] || fighter(r, foe)?.state === 'dead') return t;
    }
    return Infinity;
  }
  const weapons: [string, string, number][] = [
    ['blades', 'item.sword_rusty', 14],
    ['heavy', 'item.maul_oak', 14],
    ['polearms', 'item.spear_ash', 14],
    ['archery', 'item.bow_short', 60],
    ['unarmed', 'item.wraps_cloth', 12],
  ];
  it('every family kills a tier 1 Mossling in about the same time', () => {
    const times = weapons.map(([, item, d]) => ttk(item, d));
    const lo = Math.min(...times);
    const hi = Math.max(...times);
    // Written for the PR.
    process.stdout.write(`TTK ticks ${weapons.map(([n], i) => `${n}=${times[i]}`).join(' ')}\n`);
    expect(hi / lo).toBeLessThanOrEqual(1.15);
    // Design/04: a common enemy takes 4 to 8 seconds at par.
    expect(lo).toBeGreaterThanOrEqual(4 * 30);
    expect(hi).toBeLessThanOrEqual(8 * 30);
  });
});

describe('time to kill with techniques', () => {
  /** As `ttk`, but the weapon's own technique (slot 1) is pressed whenever it is ready. */
  function ttkWithTechnique(item: string, dist: number): number {
    const r = rig('flow');
    wear(r, item);
    face(r);
    const p = pos(r);
    const foe = spawnEnemy(r.s, 'creature.mossling', p.x + dist, p.y);
    const spot = { ...r.s.entities.comps.pos[foe]! };
    for (let t = 1; t <= 900; t++) {
      const at = r.s.entities.comps.pos[foe];
      if (at) {
        at.x = spot.x;
        at.y = spot.y;
      }
      r.tick({ type: 'technique', slot: 0, phase: 'press', aim: null });
      if (!r.s.entities.alive[foe] || fighter(r, foe)?.state === 'dead') return t;
    }
    return Infinity;
  }
  const weapons: [string, string, number][] = [
    ['blades', 'item.sword_rusty', 14],
    ['heavy', 'item.maul_oak', 14],
    ['polearms', 'item.spear_ash', 14],
    ['archery', 'item.bow_short', 60],
    ['unarmed', 'item.wraps_cloth', 12],
  ];
  it('every family still kills a tier 1 Mossling in about the same time with its technique in use', () => {
    const times = weapons.map(([, item, d]) => ttkWithTechnique(item, d));
    process.stdout.write(
      `TTK with technique ${weapons.map(([n], i) => `${n}=${times[i]}`).join(' ')}\n`,
    );
    // About the same: within a fifth (M3-12 raised Mossling health, which spreads the ticks).
    expect(Math.max(...times) / Math.min(...times)).toBeLessThanOrEqual(1.2);
    // Techniques may bring a kill a little under the 4 second basic floor, never past 8.
    expect(Math.min(...times)).toBeGreaterThanOrEqual(3 * 30);
    expect(Math.max(...times)).toBeLessThanOrEqual(8 * 30);
  });
});
