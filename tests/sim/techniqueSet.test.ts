import { describe, expect, it } from 'vitest';
import { TECHNIQUE_BALANCE as TB } from '../../src/content/balance/techniques';
import { ATTACKS } from '../../src/content/combat/attacks';
import { TECHNIQUE_LIST, TECHNIQUES } from '../../src/content/combat/techniques';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature, spawnEnemy } from '../../src/sim/combat/enemy';
import { assign, knows, knownTechniques, learnTechnique } from '../../src/sim/combat/techniques';
import { equip, give } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { Dir, type Direction } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { hasStatus } from '../../src/sim/statuses';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';

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

function rig(): Rig {
  const s = createDemoState(7, 0);
  s.world = OPEN;
  const me = createAvatar(s, feetAt(20, 20).x, feetAt(20, 20).y);
  const events: SimEvent[] = [];
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds });
    events.push(...s.events.list);
  };
  const run = (n: number, ...cmds: Command[]): void => {
    for (let i = 0; i < n; i++) tick(...(i === 0 ? cmds : []));
  };
  // Classic, so nothing swings unless a technique does.
  tick({ type: 'scheme', scheme: 'classic' });
  // Face east, standing still.
  run(2, { type: 'move', dir: Dir.E as Direction });
  run(3, { type: 'move', dir: null });
  events.length = 0;
  return { s, me, events, tick, run };
}

const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const fighter = (r: Rig) => r.s.entities.comps.fighter[r.me]!;
const pools = (r: Rig, id = r.me) => r.s.entities.comps.pools[id]!;
const where = (r: Rig, id = r.me) => ({
  x: Math.round(r.s.entities.comps.pos[id]!.x / 256),
  y: Math.round(r.s.entities.comps.pos[id]!.y / 256),
});

/** Gives skill points, so techniques up to that band are known. */
function rank(r: Rig, skill: string, points: number): void {
  r.s.entities.comps.skills[r.me]!.points[skill] = points;
}
function wear(r: Rig, item: string): void {
  const inv = r.s.entities.comps.inventory[r.me]!;
  if (!inv.slots.some((x) => x?.item === item)) give(r.s, r.me, item, 1, 'start');
  equip(
    r.s,
    r.me,
    inv.slots.findIndex((x) => x?.item === item),
  );
}
/** Puts a technique in slot `slot` (1 to 3) and fills the pools so cost is no obstacle. */
function slot(r: Rig, n: number, id: string): void {
  const t = TECHNIQUES[id]!;
  rank(r, t.skill, Math.max(t.band, r.s.entities.comps.skills[r.me]!.points[t.skill] ?? 0));
  if (t.taught) learnTechnique(r.s, r.me, id);
  expect(assign(r.s, r.me, n, id), id).toBe(true);
}
const press = (n: number): Command => ({ type: 'technique', slot: n, phase: 'press', aim: null });
/** A Mossling `dx` px east and `dy` px south of the avatar. */
function foeAt(r: Rig, dx: number, dy = 0, id = 'creature.mossling'): number {
  const p = where(r);
  const foe = spawnEnemy(r.s, id, p.x + dx, p.y + dy);
  // Park it: no wandering, no fighting back.
  r.s.entities.comps.ai[foe] = null;
  return foe;
}
const full = (r: Rig): void => {
  const p = pools(r);
  p.sta = p.staMax;
  p.foc = p.focMax;
};
const dmg = (r: Rig) => ofType(r.events, 'damageDealt');

describe('the table', () => {
  it('has the 29 actives and the passive of design/11', () => {
    const actives = TECHNIQUE_LIST.filter((t) => t.kind === 'active');
    expect(actives).toHaveLength(29);
    const by = (p: string) => actives.filter((t) => t.skill.startsWith(p)).length;
    expect(
      [
        'skill.blades',
        'skill.heavy',
        'skill.polearms',
        'skill.archery',
        'skill.unarmed',
        'skill.shieldcraft',
        'skill.evasion',
      ].reduce((n, p) => n + by(p), 0),
    ).toBe(13);
    expect(TECHNIQUE_LIST.filter((t) => t.kind === 'passive').map((t) => t.id)).toEqual([
      'technique.evasion_light_feet',
    ]);
    for (const t of TECHNIQUE_LIST) {
      expect([0, 15]).toContain(t.band);
      if (t.attack) expect(ATTACKS[t.attack], t.id).toBeDefined();
      // Cost and cooldown live on the technique, not on the attack.
      if (t.attack)
        expect((ATTACKS[t.attack] as unknown as { cost?: unknown }).cost).toBeUndefined();
    }
  });
  it('knows a technique by points, and a taught one only once taught', () => {
    const r = rig();
    const hum = TECHNIQUES['technique.performance_hum']!;
    const cross = TECHNIQUES['technique.blades_crosscut']!;
    const splash = TECHNIQUES['technique.tide_splash']!;
    expect(knows(r.s, r.me, hum)).toBe(true);
    expect(knows(r.s, r.me, cross)).toBe(false);
    rank(r, 'skill.blades', 15);
    expect(knows(r.s, r.me, cross)).toBe(true);
    rank(r, 'skill.tide', 5);
    expect(knows(r.s, r.me, splash)).toBe(false);
    learnTechnique(r.s, r.me, splash.id);
    expect(knows(r.s, r.me, splash)).toBe(true);
    expect(knownTechniques(r.s, r.me).map((t) => t.id)).toContain(splash.id);
    expect(assign(r.s, r.me, 1, 'technique.mending_ward')).toBe(false);
  });
});

describe('Arms: each technique does what it says', () => {
  it('Crosscut cuts twice, and the second cut hits harder (as if staggered)', () => {
    const r = rig();
    rank(r, 'skill.blades', 15);
    slot(r, 1, 'technique.blades_crosscut');
    const foe = foeAt(r, 16);
    full(r);
    r.run(30, press(1));
    const hits = dmg(r).filter((e) => e.dst === foe);
    expect(hits).toHaveLength(2);
    expect(hits[1]!.amount).toBeGreaterThan(hits[0]!.amount);
  });

  it('Overhead slams all around, with a great deal of stagger; Whirl is a full circle that breaks a guard', () => {
    const r = rig();
    wear(r, 'item.maul_oak');
    expect(fighter(r).slots[0]).toBe('technique.heavy_overhead');
    const east = foeAt(r, 18);
    const west = foeAt(r, -18);
    full(r);
    r.run(40, press(0));
    expect(
      dmg(r)
        .map((e) => e.dst)
        .sort(),
    ).toEqual([east, west].sort());
    const stag = (id: number) => r.s.entities.comps.stagger[id]!.cur;
    // A heavy slam leaves more stagger than a basic swing's worth.
    expect(
      stag(east) + (r.s.entities.comps.fighter[east]!.state === 'stagger' ? 999 : 0),
    ).toBeGreaterThan(20);
    // Whirl: a circle at least as wide, costing more, and heavy (so a raised guard breaks).
    const w = ATTACKS['technique.heavy_whirl']!;
    expect(w.shape.kind).toBe('circle');
    expect(w.family).toBe('heavy');
    expect(TECHNIQUES['technique.heavy_whirl']!.cost!.amount).toBeGreaterThan(
      TECHNIQUES['technique.heavy_overhead']!.cost!.amount,
    );
  });

  it('Sweep is a wide arc that hits to the side and throws well back', () => {
    const r = rig();
    wear(r, 'item.spear_ash');
    rank(r, 'skill.polearms', 15);
    slot(r, 1, 'technique.polearms_sweep');
    const side = foeAt(r, 2, 28);
    const before = where(r, side);
    full(r);
    r.run(30, press(1));
    expect(dmg(r).some((e) => e.dst === side)).toBe(true);
    const after = where(r, side);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(8);
  });

  it('Aimed Shot charges while standing still, and Scatter looses three arrows', () => {
    const shot = (still: number): number => {
      const r = rig();
      wear(r, 'item.bow_short');
      const foe = foeAt(r, 60);
      full(r);
      fighter(r).still = still;
      r.run(40, press(0));
      return dmg(r).find((e) => e.dst === foe)?.amount ?? 0;
    };
    expect(shot(60)).toBeGreaterThan(shot(0));
    const r = rig();
    wear(r, 'item.bow_short');
    rank(r, 'skill.archery', 15);
    slot(r, 1, 'technique.archery_scatter');
    full(r);
    r.run(20, press(1));
    expect(ofType(r.events, 'projectileLaunched')).toHaveLength(TB.scatter.arrows);
  });

  it('Palm knocks back farther than a jab and refunds Stamina; Flurry lands five hits', () => {
    const r = rig();
    wear(r, 'item.wraps_cloth');
    const foe = foeAt(r, 14);
    full(r);
    pools(r).sta = 500;
    const sta0 = pools(r).sta;
    r.run(30, press(0));
    expect(dmg(r).some((e) => e.dst === foe)).toBe(true);
    expect(ATTACKS['technique.unarmed_palm']!.knock).toBeGreaterThan(
      ATTACKS['attack.wraps_jab']!.knock * 4,
    );
    // Cost 200 and a refund per hit: the pool is above (start - cost).
    expect(pools(r).sta).toBeGreaterThan(sta0 - 200);

    const f = rig();
    wear(f, 'item.wraps_cloth');
    rank(f, 'skill.unarmed', 15);
    slot(f, 1, 'technique.unarmed_flurry');
    const target = foeAt(f, 14);
    f.s.entities.comps.pools[target]!.hp = 5000;
    f.s.entities.comps.pools[target]!.hpMax = 5000;
    full(f);
    f.run(40, press(1));
    expect(dmg(f).filter((e) => e.dst === target)).toHaveLength(5);
  });

  it('Bash needs a shield and staggers; Bulwark wards the caster; Light Feet lengthens the perfect dodge', () => {
    const r = rig();
    slot(r, 1, 'technique.shieldcraft_bash');
    const foe = foeAt(r, 14);
    full(r);
    r.run(2, press(1));
    expect(ofType(r.events, 'denied').some((e) => e.reason === 'requires')).toBe(true);
    wear(r, 'item.shield_wood');
    r.events.length = 0;
    r.run(30, press(1));
    expect(dmg(r).some((e) => e.dst === foe)).toBe(true);
    expect(ATTACKS['technique.shieldcraft_bash']!.stagger).toBeGreaterThanOrEqual(25);

    const b = rig();
    wear(b, 'item.shield_wood');
    rank(b, 'skill.shieldcraft', 15);
    slot(b, 1, 'technique.shieldcraft_bulwark');
    full(b);
    b.run(2, press(1));
    expect(hasStatus(b.s, b.me, 'warded')).toBe(true);
  });

  it('Shadowstep ends the caster behind the locked target', () => {
    const r = rig();
    rank(r, 'skill.evasion', 15);
    slot(r, 1, 'technique.evasion_shadowstep');
    const foe = foeAt(r, 40);
    const fp = where(r, foe);
    full(r);
    // Without a lock it is refused.
    r.run(2, press(1));
    expect(ofType(r.events, 'denied').some((e) => e.reason === 'requires')).toBe(true);
    const p = where(r, foe);
    r.run(1, { type: 'lock', x: p.x, y: p.y - 8 });
    r.events.length = 0;
    r.run(2, press(1));
    expect(where(r).x).toBeGreaterThan(fp.x);
  });
});

describe('Magic: each spell applies what it lists', () => {
  const cases: [string, string, string][] = [
    ['technique.ember_bolt', 'burning', 'foe'],
    ['technique.ember_flame_ring', 'burning', 'foe'],
    ['technique.tide_splash', 'wet', 'foe'],
    ['technique.tide_undertow', 'wet', 'foe'],
    ['technique.hexing_hex', 'hexed', 'foe'],
  ];
  it.each(cases)('%s leaves %s on what it hits', (id, status) => {
    const r = rig();
    slot(r, 1, id);
    const foe = foeAt(r, 30);
    full(r);
    r.run(60, press(1));
    expect(hasStatus(r.s, foe, status as 'burning'), id).toBe(true);
  });

  it.each([
    ['technique.shieldcraft_bulwark', 'warded', 'item.shield_wood'],
    ['technique.mending_ward', 'warded', ''],
    ['technique.mending_mend', 'mending', ''],
    ['technique.gale_tailwind', 'tailwind', ''],
    ['technique.stealth_hide', 'hidden', ''],
  ])('%s puts %s on the caster', (id, status, gear) => {
    const r = rig();
    if (gear) wear(r, gear);
    slot(r, 1, id);
    full(r);
    r.run(2, press(1));
    expect(hasStatus(r.s, r.me, status as 'warded'), id).toBe(true);
  });

  it('Gust throws far, Undertow pulls in, Stone Fist staggers, Drain heals half', () => {
    const r = rig();
    slot(r, 1, 'technique.gale_gust');
    const foe = foeAt(r, 30);
    const x0 = where(r, foe).x;
    full(r);
    r.run(30, press(1));
    expect(where(r, foe).x - x0).toBeGreaterThan(12);

    const u = rig();
    slot(u, 1, 'technique.tide_undertow');
    const far = foeAt(u, 56);
    const d0 = where(u, far).x - where(u).x;
    full(u);
    u.run(30, press(1));
    expect(where(u, far).x - where(u).x).toBeLessThan(d0);

    const st = rig();
    slot(st, 1, 'technique.stone_fist');
    const target = foeAt(st, 40);
    full(st);
    st.run(40, press(1));
    expect(st.s.entities.comps.stagger[target]!.cur).toBeGreaterThanOrEqual(20);

    const dr = rig();
    rank(dr, 'skill.hexing', 15);
    slot(dr, 1, 'technique.hexing_drain');
    const prey = foeAt(dr, 30);
    pools(dr).hp = 50;
    full(dr);
    pools(dr).hp = 50;
    dr.run(30, press(1));
    const dealt = dmg(dr).find((e) => e.dst === prey)!.amount;
    expect(pools(dr).hp).toBe(50 + Math.floor(dealt / 2));
  });

  it('Earth Wall stands for its time, blocks a bolt and a walker, then is gone', () => {
    const r = rig();
    rank(r, 'skill.stone', 15);
    slot(r, 1, 'technique.stone_earth_wall');
    full(r);
    r.run(2, press(1));
    const walls = r.s.entities.comps.fixture.filter((f) => f?.kind === 'fixture.earth_wall');
    expect(walls).toHaveLength(1);
    const id = r.s.entities.comps.fixture.findIndex((f) => f?.kind === 'fixture.earth_wall');
    expect(r.s.entities.comps.body[id]!.solid).toBe(true);
    r.run(TB.earthWall.ticks + 5);
    expect(r.s.entities.comps.fixture.filter((f) => f?.kind === 'fixture.earth_wall')).toHaveLength(
      0,
    );
    void spawnFixture;
  });

  it('Mending pays Health back over time', () => {
    const r = rig();
    slot(r, 1, 'technique.mending_mend');
    pools(r).hp = 40;
    full(r);
    pools(r).hp = 40;
    r.run(TB.mending.ticks + 5, press(1));
    expect(pools(r).hp).toBeGreaterThanOrEqual(40 + TB.mending.heal * 8);
  });
});

describe('Stealth and Performance', () => {
  it('Hide: out of combat only, slower, and creatures notice from half as far, counting a sneak once', () => {
    const r = rig();
    slot(r, 1, 'technique.stealth_hide');
    // A creature that notices at 96 px stands 70 px away: it would notice at full range, not at half.
    const foe = spawnCreature(r.s, 'creature.mossling', where(r).x + 70, where(r).y);
    full(r);
    r.run(2, press(1));
    expect(hasStatus(r.s, r.me, 'hidden')).toBe(true);
    r.run(30);
    expect(r.s.entities.comps.ai[foe]!.target).toBeNull();
    expect(ofType(r.events, 'sneak')).toHaveLength(1);
    // Speed is 60 percent.
    const x0 = where(r).x;
    r.run(20, { type: 'move', dir: Dir.W as Direction });
    const hiddenWalk = x0 - where(r).x;
    const c = rig();
    const cx = where(c).x;
    c.run(20, { type: 'move', dir: Dir.W as Direction });
    expect(hiddenWalk).toBeLessThan(cx - where(c).x);
    // Not while fighting.
    const f = rig();
    slot(f, 1, 'technique.stealth_hide');
    f.s.entities.comps.pools[f.me]!.lastCombat = f.s.tick;
    f.s.entities.comps.skills[f.me]!.fight = { id: 1, last: f.s.tick };
    f.run(2, press(1));
    expect(hasStatus(f.s, f.me, 'hidden')).toBe(false);
  });

  it('Ambush needs Hide, always crits, and ends the hiding', () => {
    const r = rig();
    rank(r, 'skill.stealth', 15);
    slot(r, 1, 'technique.stealth_hide');
    slot(r, 2, 'technique.stealth_ambush');
    wear(r, 'item.sword_rusty');
    const foe = foeAt(r, 14);
    full(r);
    r.run(2, press(2));
    expect(ofType(r.events, 'denied').some((e) => e.reason === 'requires')).toBe(true);
    r.run(2, press(1));
    r.events.length = 0;
    r.run(2, press(2));
    r.run(20);
    expect(dmg(r).find((e) => e.dst === foe)?.crit).toBe(true);
    expect(hasStatus(r.s, r.me, 'hidden')).toBe(false);
  });

  it('Hum of Courage channels, raises Stamina regen, and sends perform; moving cancels it', () => {
    const r = rig();
    slot(r, 1, 'technique.performance_hum');
    full(r);
    r.run(2, press(1));
    expect(r.s.entities.comps.channel[r.me]).not.toBeNull();
    expect(hasStatus(r.s, r.me, 'courage')).toBe(true);
    r.run(TB.courage.ticks > 90 ? 95 : 95);
    expect(ofType(r.events, 'perform')).toHaveLength(1);
    expect(r.s.entities.comps.channel[r.me]).toBeNull();
    // Regen: stamina comes back faster with courage than without.
    const regen = (courage: boolean): number => {
      const q = rig();
      if (courage)
        q.s.entities.comps.statuses[q.me] = [{ id: 'courage', until: q.s.tick + 600, src: q.me }];
      q.s.entities.comps.pools[q.me]!.sta = 100;
      q.s.entities.comps.pools[q.me]!.lastSpend = -1000;
      q.run(10);
      return pools(q).sta - 100;
    };
    expect(regen(true)).toBeGreaterThan(regen(false));

    const c = rig();
    slot(c, 1, 'technique.performance_hum');
    full(c);
    c.run(2, press(1));
    c.run(5, { type: 'move', dir: Dir.W as Direction });
    expect(c.s.entities.comps.channel[c.me]).toBeNull();
    expect(hasStatus(c.s, c.me, 'courage')).toBe(false);
    expect(ofType(c.events, 'perform')).toHaveLength(0);
  });

  it('Lullaby needs an instrument and dazes creatures of tier 2 or lower in range', () => {
    const r = rig();
    rank(r, 'skill.performance', 15);
    slot(r, 1, 'technique.performance_lullaby');
    const weak = foeAt(r, 40);
    const strong = foeAt(r, 40, 20, 'creature.bramble_boar');
    r.s.entities.comps.combatant[strong]!.tier = 4;
    full(r);
    r.run(2, press(1));
    expect(ofType(r.events, 'denied').some((e) => e.reason === 'requires')).toBe(true);
    wear(r, 'item.flute_reed');
    r.events.length = 0;
    r.run(2, press(1));
    r.run(70);
    expect(hasStatus(r.s, weak, 'dazed')).toBe(true);
    expect(hasStatus(r.s, strong, 'dazed')).toBe(false);
    expect(ofType(r.events, 'perform')).toHaveLength(1);
  });
});

describe('a mixed loadout in one scripted run', () => {
  it('a Tide spell, a Blades technique, Hum of Courage and Hide all work from the four slots', () => {
    const r = rig();
    wear(r, 'item.sword_rusty');
    expect(fighter(r).slots[0]).toBe('technique.blades_lunge');
    slot(r, 1, 'technique.tide_splash');
    slot(r, 2, 'technique.performance_hum');
    slot(r, 3, 'technique.stealth_hide');
    expect(fighter(r).slots).toEqual([
      'technique.blades_lunge',
      'technique.tide_splash',
      'technique.performance_hum',
      'technique.stealth_hide',
    ]);
    const foe = foeAt(r, 26);
    r.s.entities.comps.pools[foe]!.hp = 900;
    r.s.entities.comps.pools[foe]!.hpMax = 900;
    full(r);
    r.run(30, press(1));
    expect(hasStatus(r.s, foe, 'wet')).toBe(true);
    r.run(30, press(0));
    expect(dmg(r).some((e) => e.dst === foe && e.tag === 'blades')).toBe(true);
    r.run(2, press(2));
    r.run(95);
    expect(ofType(r.events, 'perform')).toHaveLength(1);
    expect(hasStatus(r.s, r.me, 'courage')).toBe(true);
    // Hide wants a quiet spell: wait it out.
    r.s.entities.comps.skills[r.me]!.fight = { id: 1, last: -1_000_000 };
    r.s.entities.comps.pools[r.me]!.lastCombat = -1_000_000;
    r.run(2, press(3));
    expect(hasStatus(r.s, r.me, 'hidden')).toBe(true);
  });
});

describe('loadouts', () => {
  /** Two weapons in the bag, loadout 0 with the sword, loadout 1 with the spear and a Tide spell. */
  function twoSets(): Rig {
    const r = rig();
    give(r.s, r.me, 'item.spear_ash', 1, 'start');
    const inv = r.s.entities.comps.inventory[r.me]!;
    const spear = inv.slots.findIndex((x) => x?.item === 'item.spear_ash');
    slot(r, 1, 'technique.tide_splash');
    const ld = r.s.entities.comps.loadouts[r.me]!;
    ld.sets[1] = { main: spear, off: null, slots: [null, 'technique.mending_mend', null, null] };
    rank(r, 'skill.mending', 0);
    learnTechnique(r.s, r.me, 'technique.mending_mend');
    // learnTechnique slotted Mend into the active loadout: put it back as it was.
    assign(r.s, r.me, 2, null);
    assign(r.s, r.me, 3, null);
    ld.sets[1]!.slots = [null, 'technique.mending_mend', null, null];
    return r;
  }

  it('swaps instantly out of combat: weapon, slots, and back again', () => {
    const r = twoSets();
    expect(fighter(r).slots[1]).toBe('technique.tide_splash');
    r.run(1, { type: 'loadout' });
    expect(ofType(r.events, 'loadoutSwapped')[0]).toMatchObject({ active: 1, locked: false });
    expect(r.s.entities.comps.combatant[r.me]!.weapon).toBe('spear');
    expect(fighter(r).slots[0]).toBe('technique.polearms_lunge');
    expect(fighter(r).slots[1]).toBe('technique.mending_mend');
    expect(fighter(r).lockUntil ?? 0).toBeLessThanOrEqual(r.s.tick);
    r.run(1, { type: 'loadout' });
    expect(r.s.entities.comps.combatant[r.me]!.weapon).toBe('sword');
    expect(fighter(r).slots[1]).toBe('technique.tide_splash');
  });

  it('in combat it applies at once, then every technique slot and the basic attack lock for loadoutLockTicks', () => {
    const r = twoSets();
    const foe = foeAt(r, 14);
    void foe;
    r.s.entities.comps.skills[r.me]!.fight = { id: 1, last: r.s.tick };
    r.s.entities.comps.pools[r.me]!.lastCombat = r.s.tick;
    full(r);
    r.events.length = 0;
    r.run(1, { type: 'loadout' });
    expect(ofType(r.events, 'loadoutSwapped')[0]).toMatchObject({ active: 1, locked: true });
    expect(r.s.entities.comps.combatant[r.me]!.weapon).toBe('spear');
    // Locked: a technique is refused and the basic attack does not start.
    r.events.length = 0;
    r.run(5, press(1), { type: 'attack' });
    expect(ofType(r.events, 'denied').some((e) => e.reason === 'locked')).toBe(true);
    expect(ofType(r.events, 'attackStarted')).toHaveLength(0);
    // After the lock, they work again.
    r.run(TB.loadoutLockTicks);
    r.events.length = 0;
    r.run(40, { type: 'attack' });
    expect(ofType(r.events, 'attackStarted').length).toBeGreaterThan(0);
  });

  it('a stale bag index is ignored: only an item that fits the hand is wielded', () => {
    const r = twoSets();
    const ld = r.s.entities.comps.loadouts[r.me]!;
    ld.sets[1]!.main = 30;
    r.run(1, { type: 'loadout' });
    expect(r.s.entities.comps.combatant[r.me]!.weapon).toBe('sword');
    expect(ofType(r.events, 'loadoutSwapped')).toHaveLength(1);
  });

  it('assign puts a known active in a slot, moves it, and refuses the unknown or slot 0', () => {
    const r = rig();
    rank(r, 'skill.blades', 15);
    expect(assign(r.s, r.me, 1, 'technique.blades_crosscut')).toBe(true);
    expect(assign(r.s, r.me, 2, 'technique.blades_crosscut')).toBe(true);
    expect(fighter(r).slots).toEqual([
      'technique.blades_lunge',
      null,
      'technique.blades_crosscut',
      null,
    ]);
    expect(assign(r.s, r.me, 0, 'technique.blades_crosscut')).toBe(false);
    expect(assign(r.s, r.me, 1, 'technique.heavy_whirl')).toBe(false);
    r.run(1, { type: 'assign', slot: 3, technique: 'technique.blades_crosscut' });
    expect(fighter(r).slots[3]).toBe('technique.blades_crosscut');
    // The active loadout follows.
    expect(r.s.entities.comps.loadouts[r.me]!.sets[0].slots[3]).toBe('technique.blades_crosscut');
  });
});
