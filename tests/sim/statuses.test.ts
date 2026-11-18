import { describe, expect, it } from 'vitest';
import { STATUS_BALANCE as B } from '../../src/content/balance/status';
import { ATTACKS, type AttackDef } from '../../src/content/combat/attacks';
import { REACTIONS } from '../../src/content/combat/reactions';
import {
  ELEMENT_STATUS,
  STATUSES,
  STATUS_PRIORITY,
  type ElementId,
  type StatusId,
} from '../../src/content/combat/statuses';
import { FIXTURES } from '../../src/content/world/fixtures';
import { TILE_FLAGS, TILESET, tileHasFlag } from '../../src/content/world/tileset';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnEnemy } from '../../src/sim/combat/enemy';
import { dealDamage, startAttack } from '../../src/sim/combat/fighter';
import { elementHitsUnit, elementHitsWorld, sightBlocked } from '../../src/sim/elements';
import { addItem } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { addXp } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import {
  applyStatus,
  clearStatus,
  hasStatus,
  statusSystem,
  visibleStatuses,
} from '../../src/sim/statuses';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { skillsSystem } from '../../src/sim/systems/skills';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};
const IDS = Object.keys(STATUSES) as StatusId[];

interface Rig {
  s: SimState;
  me: number;
  /** A mossling far enough off that it never notices the avatar. */
  foe: number;
  events: SimEvent[];
  tick: (...cmds: Command[]) => void;
  run: (n: number, ...cmds: Command[]) => void;
}

function rig(seed = 7): Rig {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  const foe = spawnEnemy(s, 'creature.mossling', 20 * 16 + 8 + 400, 20 * 16 + 16);
  const events: SimEvent[] = [];
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds });
    events.push(...s.events.list);
  };
  const run = (n: number, ...cmds: Command[]): void => {
    for (let i = 0; i < n; i++) tick(...(i === 0 ? cmds : []));
  };
  run(1);
  events.length = 0;
  return { s, me, foe, events, tick, run };
}

const hp = (r: Rig, id: number) => r.s.entities.comps.pools[id]!.hp;
const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const ids = (r: Rig, id: number) => (r.s.entities.comps.statuses[id] ?? []).map((x) => x.id);

describe('status framework: the same rules for the avatar and for creatures', () => {
  const units = [
    ['the avatar', (r: Rig) => r.me],
    ['a creature', (r: Rig) => r.foe],
  ] as const;
  for (const [label, pick] of units) {
    describe(label, () => {
      it.each(IDS)('%s: applies, refreshes or holds, clears, and expires', (id) => {
        const r = rig();
        const who = pick(r);
        const def = STATUSES[id];
        expect(applyStatus(r.s, who, id, 99)).toBe(true);
        const first = r.s.entities.comps.statuses[who]!.find((x) => x.id === id)!;
        expect(first).toMatchObject({ id, until: r.s.tick + def.ticks, src: 99 });
        expect(ofType(r.s.events.list, 'statusApplied')[0]).toMatchObject({ id: who, status: id });
        r.s.tick += 10;
        const again = applyStatus(r.s, who, id, 98);
        const entry = r.s.entities.comps.statuses[who]!.find((x) => x.id === id)!;
        if (def.stacks === 'refresh') {
          expect(again).toBe(true);
          expect(entry.until).toBe(r.s.tick + def.ticks);
        } else {
          expect(again).toBe(false);
          expect(entry.until).toBe(first.until);
        }
        expect(r.s.entities.comps.statuses[who]!.filter((x) => x.id === id)).toHaveLength(1);
        // Expires on time, and not before.
        r.s.tick = entry.until - 2;
        r.run(1);
        expect(hasStatus(r.s, who, id)).toBe(true);
        r.run(2);
        expect(hasStatus(r.s, who, id)).toBe(false);
        expect(
          ofType(r.events, 'statusEnded').some((e) => e.status === id && e.how === 'expired'),
        ).toBe(true);
        // And can be cleared by hand.
        applyStatus(r.s, who, id);
        expect(clearStatus(r.s, who, id)).toBe(true);
        expect(clearStatus(r.s, who, id)).toBe(false);
        expect(r.s.entities.comps.statuses[who]).toBeNull();
      });

      it('burning and poisoned take Health on their beat', () => {
        const r = rig();
        const who = pick(r);
        applyStatus(r.s, who, 'burning', 99);
        const h0 = hp(r, who);
        r.run(30);
        expect(h0 - hp(r, who)).toBe(2 * B.burning.damage);
        clearStatus(r.s, who, 'burning');
        applyStatus(r.s, who, 'poisoned', 99);
        const h1 = hp(r, who);
        r.run(30);
        expect(h1 - hp(r, who)).toBe(B.poisoned.damage);
      });

      it('hexed lengthens statuses applied later, but not itself', () => {
        const r = rig();
        const who = pick(r);
        applyStatus(r.s, who, 'hexed');
        applyStatus(r.s, who, 'wet');
        const wet = r.s.entities.comps.statuses[who]!.find((x) => x.id === 'wet')!;
        expect(wet.until - r.s.tick).toBe(
          Math.floor((B.wet.ticks * (100 + B.hexedExtendPct)) / 100),
        );
        const hexed = r.s.entities.comps.statuses[who]!.find((x) => x.id === 'hexed')!;
        expect(hexed.until - r.s.tick).toBe(B.hexed.ticks);
      });

      it('warded takes less from the same hit, hexed takes more', () => {
        const hit = (id: StatusId | null): number => {
          const r = rig(11);
          const who = pick(r);
          if (id) applyStatus(r.s, who, id);
          r.events.length = 0;
          const from = { x: 20 * 16, y: 20 * 16 };
          r.s.entities.comps.fighter[who]!.invuln = 0;
          dealDamage(r.s, who, {
            src: label === 'the avatar' ? r.foe : r.me,
            from,
            power: 30,
            rank: 0,
            mult: 100,
            stagger: 0,
            knock: 0,
            element: 100,
            heavy: false,
            tag: 'blades',
          });
          return ofType(r.s.events.list, 'damageDealt')[0]!.amount;
        };
        const plain = hit(null);
        expect(hit('warded')).toBeLessThan(plain);
        expect(hit('hexed')).toBeGreaterThan(plain);
      });

      it('dies with its statuses, except a meal and a night of rest', () => {
        const r = rig();
        const who = pick(r);
        for (const id of ['burning', 'wet', 'fed', 'rested'] as const) applyStatus(r.s, who, id);
        r.s.entities.comps.pools[who]!.hp = 0;
        r.s.entities.comps.fighter[who]!.state = 'dead';
        r.run(1);
        expect(ids(r, who).sort()).toEqual(['fed', 'rested']);
      });
    });
  }

  it('rooted cannot walk or dodge, chilled walks slower, dazed cannot attack', () => {
    const walked = (id: StatusId | null): number => {
      const r = rig();
      if (id) applyStatus(r.s, r.me, id);
      const x0 = r.s.entities.comps.pos[r.me]!.x;
      r.run(30, { type: 'move', dir: 2 });
      return r.s.entities.comps.pos[r.me]!.x - x0;
    };
    const free = walked(null);
    expect(free).toBeGreaterThan(0);
    expect(walked('rooted')).toBe(0);
    const slow = walked('chilled');
    expect(slow).toBeGreaterThan(0);
    expect(slow).toBeLessThan(free);

    const r = rig();
    applyStatus(r.s, r.me, 'rooted');
    r.run(1, { type: 'dodge', dir: 2 });
    expect(ofType(r.events, 'dodgeStarted')).toHaveLength(0);

    const d = rig();
    applyStatus(d.s, d.me, 'dazed');
    expect(startAttack(d.s, d.me, 'attack.sword_slash', null)).toBe(false);
    expect(startAttack(d.s, d.foe, 'attack.creature_swipe', null)).toBe(true);
    applyStatus(d.s, d.foe, 'dazed');
    d.s.entities.comps.fighter[d.foe]!.state = 'idle';
    expect(startAttack(d.s, d.foe, 'attack.creature_swipe', null)).toBe(false);
  });

  it('a broken stagger bar shows as Staggered', () => {
    const r = rig();
    r.s.events.list.push({ type: 'staggerBreak', id: r.foe });
    statusSystem(r.s);
    expect(hasStatus(r.s, r.foe, 'staggered')).toBe(true);
  });

  it('shows at most four, taken in the fixed priority order', () => {
    const r = rig();
    for (const id of [...STATUS_PRIORITY].reverse()) applyStatus(r.s, r.me, id);
    const shown = visibleStatuses(r.s.entities.comps.statuses[r.me]!).map((x) => x.id);
    expect(shown).toEqual(STATUS_PRIORITY.slice(0, B.maxShown));
    expect(shown).toHaveLength(4);
  });

  it('every status has its own icon and its own rule', () => {
    expect(new Set(IDS.filter((i) => i !== 'fed').map((i) => STATUSES[i].iconKey)).size).toBe(14);
    for (const id of IDS) expect(STATUS_PRIORITY).toContain(id);
  });
});

describe('reactions', () => {
  const units = [
    ['the avatar', (r: Rig) => r.me],
    ['a creature', (r: Rig) => r.foe],
  ] as const;
  for (const [label, pick] of units) {
    describe(label, () => {
      it('wet plus ember makes steam: wet goes, a cloud hides and scalds', () => {
        const r = rig();
        const who = pick(r);
        applyStatus(r.s, who, 'wet');
        elementHitsUnit(r.s, who, 'ember', 99, true);
        expect(hasStatus(r.s, who, 'wet')).toBe(false);
        expect(hasStatus(r.s, who, 'burning')).toBe(false);
        expect(ofType(r.s.events.list, 'reaction')[0]).toMatchObject({ reaction: 'steam' });
        const clouds = r.s.entities.comps.cloud.filter((c) => c);
        expect(clouds).toHaveLength(1);
        const here = r.s.entities.comps.pos[who]!;
        const at = { x: here.x / 256, y: here.y / 256 - 12 };
        expect(sightBlocked(r.s, { x: at.x - 60, y: at.y }, { x: at.x + 60, y: at.y })).toBe(true);
        expect(
          sightBlocked(r.s, { x: at.x - 60, y: at.y + 200 }, { x: at.x + 60, y: at.y + 200 }),
        ).toBe(false);
        const h0 = hp(r, who);
        r.run(B.steam.ticks - 1);
        expect(hp(r, who)).toBeLessThan(h0);
        r.run(B.steam.ticks);
        expect(r.s.entities.comps.cloud.filter((c) => c)).toHaveLength(0);
      });

      it('wet plus gale chills', () => {
        const r = rig();
        const who = pick(r);
        applyStatus(r.s, who, 'wet');
        elementHitsUnit(r.s, who, 'gale', 99, true);
        expect(ids(r, who)).toEqual(['chilled']);
      });

      it('chilled plus stone shatters: burst damage, and chilled goes', () => {
        const r = rig();
        const who = pick(r);
        applyStatus(r.s, who, 'chilled');
        const h0 = hp(r, who);
        elementHitsUnit(r.s, who, 'stone', 99, true);
        expect(hasStatus(r.s, who, 'chilled')).toBe(false);
        expect(h0 - hp(r, who)).toBe(B.shatterDamage);
        expect(ofType(r.s.events.list, 'reaction')[0]).toMatchObject({ reaction: 'shatter' });
      });

      it('burning plus gale spreads burning to units in the radius, and no farther', () => {
        const r = rig();
        const who = pick(r);
        const here = r.s.entities.comps.pos[who]!;
        const near = spawnEnemy(r.s, 'creature.mossling', here.x / 256 + 12, here.y / 256);
        const far = spawnEnemy(
          r.s,
          'creature.mossling',
          here.x / 256 + B.spreadRadius + 40,
          here.y / 256,
        );
        applyStatus(r.s, who, 'burning');
        elementHitsUnit(r.s, who, 'gale', 99, true);
        expect(hasStatus(r.s, near, 'burning')).toBe(true);
        expect(hasStatus(r.s, far, 'burning')).toBe(false);
        expect(hasStatus(r.s, who, 'burning')).toBe(true);
      });
    });
  }

  it('the table is the four rows of design/04, as data', () => {
    expect(REACTIONS.map((x) => `${x.a}+${x.b}`)).toEqual([
      'wet+ember',
      'wet+gale',
      'chilled+stone',
      'burning+gale',
    ]);
  });

  it('an element applies its paired status only when the technique says so', () => {
    for (const [element, status] of Object.entries(ELEMENT_STATUS) as [ElementId, StatusId][]) {
      const r = rig();
      elementHitsUnit(r.s, r.foe, element, r.me, false);
      expect(ids(r, r.foe)).toEqual([]);
      elementHitsUnit(r.s, r.foe, element, r.me, true);
      expect(ids(r, r.foe)).toEqual([status]);
    }
    const r = rig();
    for (const e of ['gale', 'stone'] as const) elementHitsUnit(r.s, r.foe, e, r.me, true);
    expect(ids(r, r.foe)).toEqual([]);
  });

  it('a hit from an attack carries its element through to the status, and a second one reacts', () => {
    const attacks = ATTACKS as Record<string, AttackDef>;
    const base = {
      family: 'creature',
      windup: 1,
      active: 2,
      recover: 2,
      mult: 10,
      stagger: 0,
      knock: 0,
      shape: { kind: 'line', reach: 0, halfWidth: 0 },
    } as const;
    attacks['attack.test_tide'] = {
      ...base,
      id: 'attack.test_tide',
      projectile: { speed: 6, ttl: 60, element: 'tide' },
      applies: true,
    };
    attacks['attack.test_ember'] = {
      ...base,
      id: 'attack.test_ember',
      projectile: { speed: 6, ttl: 60, element: 'ember' },
      applies: true,
    };
    try {
      const r = rig();
      const p = r.s.entities.comps.pos[r.me]!;
      const foe = spawnEnemy(r.s, 'creature.mossling', p.x / 256 + 80, p.y / 256);
      const fire = (id: string): void => {
        r.s.entities.comps.fighter[r.me]!.state = 'idle';
        startAttack(r.s, r.me, id, { x: p.x / 256 + 80, y: p.y / 256 - 8 });
        r.run(40);
      };
      fire('attack.test_tide');
      expect(hasStatus(r.s, foe, 'wet')).toBe(true);
      fire('attack.test_ember');
      expect(ofType(r.events, 'reaction').some((e) => e.reaction === 'steam')).toBe(true);
      expect(hasStatus(r.s, foe, 'wet')).toBe(false);
    } finally {
      delete attacks['attack.test_tide'];
      delete attacks['attack.test_ember'];
    }
  });
});

describe('world elements', () => {
  const PIECES: [string, ElementId, ElementId][] = [
    ['fixture.brush_wall', 'ember', 'tide'],
    ['fixture.fire_barrier', 'tide', 'ember'],
    ['fixture.windmill_gate', 'gale', 'stone'],
    ['fixture.stone_gap', 'stone', 'gale'],
    ['fixture.withered_vine', 'mending', 'ember'],
  ];
  const at = (tx: number, ty: number) => ({ x: tx * 16 + 8, y: ty * 16 + 8 });

  it.each(PIECES)('%s answers to %s and to nothing else', (kind, element, other) => {
    const r = rig();
    const id = spawnFixture(r.s, kind, 30, 30);
    const f = r.s.entities.comps.fixture[id]!;
    const body = r.s.entities.comps.body[id]!;
    expect(f.open).toBe(false);
    expect(body.solid).toBe(true);
    expect(elementHitsWorld(r.s, other, at(30, 30))).toBe(0);
    expect(f.open).toBe(false);
    expect(elementHitsWorld(r.s, element, { x: 400, y: 400 })).toBe(0);
    expect(elementHitsWorld(r.s, element, at(30, 30))).toBe(1);
    expect(f.open).toBe(true);
    expect(body.solid).toBe(false);
    expect(ofType(r.s.events.list, 'elementWorld')[0]).toMatchObject({ id, element });
    // Hitting it again changes nothing.
    expect(elementHitsWorld(r.s, element, at(30, 30))).toBe(0);
  });

  it('a burnt brush wall is ash for brushRegrowTicks, then grows back', () => {
    const r = rig();
    const id = spawnFixture(r.s, 'fixture.brush_wall', 30, 30);
    elementHitsWorld(r.s, 'ember', at(30, 30));
    expect(FIXTURES['fixture.brush_wall']!.flags).toContain('flammable');
    r.s.tick = 100;
    r.run(1);
    const f = r.s.entities.comps.fixture[id]!;
    f.until = r.s.tick + 5;
    expect(f.open).toBe(true);
    r.run(3);
    expect(f.open).toBe(true);
    r.run(5);
    expect(f.open).toBe(false);
    expect(r.s.entities.comps.body[id]!.solid).toBe(true);
    // The real length comes from the table.
    elementHitsWorld(r.s, 'ember', at(30, 30));
    expect(f.until).toBe(r.s.worldTick + B.brushRegrowTicks);
  });

  it('a fire that is doused stays out, and a raised step stays raised', () => {
    const r = rig();
    const fire = spawnFixture(r.s, 'fixture.fire_barrier', 30, 30);
    elementHitsWorld(r.s, 'tide', at(30, 30));
    r.run(B.brushRegrowTicks + 10);
    expect(r.s.entities.comps.fixture[fire]!.open).toBe(true);
  });

  it('Hexing reveals a hidden niche, which then opens like a chest', () => {
    const r = rig();
    const id = spawnFixture(r.s, 'fixture.hidden_niche', 20, 21);
    expect(r.s.entities.comps.interactable[id]).toBeNull();
    expect(r.s.entities.comps.body[id]!.solid).toBe(false);
    // Unrevealed, the button does nothing.
    r.run(1, { type: 'interact' });
    expect(ofType(r.events, 'chestOpened')).toHaveLength(0);
    expect(elementHitsWorld(r.s, 'ember', at(20, 21))).toBe(0);
    expect(elementHitsWorld(r.s, 'hexing', at(20, 21))).toBe(1);
    expect(r.s.entities.comps.fixture[id]!.revealed).toBe(true);
    r.run(1, { type: 'interact' });
    expect(ofType(r.events, 'chestOpened')).toHaveLength(1);
    expect(
      r.s.entities.comps.inventory[r.me]!.slots.some((x) => x?.item === 'item.herbed_skewer'),
    ).toBe(true);
  });

  it('a bolt of the right element is spent on the piece it hits', () => {
    const attacks = ATTACKS as Record<string, AttackDef>;
    attacks['attack.test_wind'] = {
      id: 'attack.test_wind',
      family: 'creature',
      windup: 1,
      active: 2,
      recover: 2,
      mult: 10,
      stagger: 0,
      knock: 0,
      shape: { kind: 'line', reach: 0, halfWidth: 0 },
      projectile: { speed: 5, ttl: 60, element: 'gale' },
    };
    try {
      const r = rig();
      const p = r.s.entities.comps.pos[r.me]!;
      const id = spawnFixture(r.s, 'fixture.windmill_gate', 20 + 3, 20);
      r.s.entities.comps.fighter[r.me]!.state = 'idle';
      startAttack(r.s, r.me, 'attack.test_wind', { x: p.x / 256 + 60, y: p.y / 256 - 8 });
      r.run(30);
      expect(r.s.entities.comps.fixture[id]!.open).toBe(true);
    } finally {
      delete attacks['attack.test_wind'];
    }
  });

  it('tiles carry element flags', () => {
    expect(tileHasFlag('tile.bush_dry_0', 'flammable')).toBe(true);
    expect(tileHasFlag('tile.rock', 'flammable')).toBe(false);
    for (const id of Object.keys(TILE_FLAGS)) expect(TILESET).toContain(id);
  });
});

describe('Fed, Rested and Hexing XP', () => {
  it('Fed is a status, one at a time, and its pool bonuses come through mods', () => {
    const r = rig();
    const inv = r.s.entities.comps.inventory[r.me]!;
    addItem(inv, 'item.hearty_stew', 1);
    const max0 = r.s.entities.comps.pools[r.me]!.hpMax;
    r.run(1, { type: 'use', slot: inv.slots.findIndex((x) => x?.item === 'item.hearty_stew') });
    expect(r.s.entities.comps.pools[r.me]!.hpMax).toBe(max0 + 20);
    expect(r.s.entities.comps.statuses[r.me]![0]).toMatchObject({
      id: 'fed',
      item: 'item.hearty_stew',
    });
  });

  it('a bedroll makes the avatar Rested, and Rested adds its percent to skill XP', () => {
    const r = rig();
    spawnFixture(r.s, 'fixture.bed', 20, 21);
    const before = r.s.ledger.xpEarned['skill.blades'] ?? 0;
    addXp(r.s, r.me, 'skill.blades', 100);
    expect((r.s.ledger.xpEarned['skill.blades'] ?? 0) - before).toBe(100);
    // The bedroll opens the Rest panel; sleeping is its own command.
    r.run(1, { type: 'interact' });
    expect(ofType(r.events, 'bedOpened')).toHaveLength(1);
    expect(hasStatus(r.s, r.me, 'rested')).toBe(false);
    r.run(1, { type: 'sleep' });
    expect(ofType(r.events, 'slept')).toHaveLength(1);
    expect(hasStatus(r.s, r.me, 'rested')).toBe(true);
    const mid = r.s.ledger.xpEarned['skill.blades'] ?? 0;
    addXp(r.s, r.me, 'skill.blades', 100);
    expect((r.s.ledger.xpEarned['skill.blades'] ?? 0) - mid).toBe(100 + B.restedXpPct);
    // It lasts restedTicks, then ends.
    const until = r.s.entities.comps.statuses[r.me]!.find((x) => x.id === 'rested')!.until;
    expect(until - r.s.tick).toBeLessThanOrEqual(B.restedTicks);
    r.s.tick = until;
    r.run(1);
    expect(hasStatus(r.s, r.me, 'rested')).toBe(false);
  });

  it('Hexing pays on statusApplied:hexed, with a first-time lump', () => {
    const r = rig();
    // The event is sent in a tick, so the skills system, which runs last, reads it in the same one.
    applyStatus(r.s, r.foe, 'hexed', r.me);
    skillsSystem(r.s);
    const xp1 = r.s.entities.comps.skills[r.me]!.xp['skill.hexing'] ?? 0;
    const pts = r.s.entities.comps.skills[r.me]!.points['skill.hexing'] ?? 0;
    expect(xp1 + pts).toBeGreaterThan(0);
    // Hexing yourself pays nothing.
    const e = rig();
    applyStatus(e.s, e.me, 'hexed', e.me);
    skillsSystem(e.s);
    expect(e.s.entities.comps.skills[e.me]!.xp['skill.hexing'] ?? 0).toBe(0);
  });
});
