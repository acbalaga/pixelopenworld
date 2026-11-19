import { afterAll, describe, expect, it } from 'vitest';
import { PHASE_DESPAWN_PX, SPAWN_STEPS } from '../../src/content/balance/world';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { ITEMS } from '../../src/content/items';
import { INTERACTIONS } from '../../src/content/creatures/interactions';
import { ROSTER_SPAWNERS, ZONES, slotKind } from '../../src/content/creatures/rosters';
import type { SpawnerDef } from '../../src/content/creatures/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { isDark, provoke } from '../../src/sim/combat/temperament';
import { feedCreature, isCalm, scareable, soothe } from '../../src/sim/creatureCare';
import { addItem } from '../../src/sim/items';
import { getComp, query } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { createSpawner, creatureNow, routePoint } from '../../src/sim/systems/spawner';
import { dayIndex } from '../../src/sim/time';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 120 || ty > 120 ? 1 : 0),
};

/** A tick of the world clock that is dark, and one that is light, found from the clock itself. */
const NIGHT = ((): number => {
  for (let t = 0; t < 1_000_000; t += 100) if (isDark(t)) return t;
  throw new Error('no night');
})();
const DAY = ((): number => {
  for (let t = 0; t < 1_000_000; t += 100) if (!isDark(t)) return t;
  throw new Error('no day');
})();

interface Arena {
  s: SimState;
  me: number;
  events: SimEvent[];
  clock: number;
  run: (n: number) => void;
}
function arena(clock: number, at = { x: 30, y: 30 }): Arena {
  const s = createDemoState(5, 0);
  s.world = OPEN;
  const f = feetAt(at.x, at.y);
  const me = createAvatar(s, f.x, f.y);
  const a: Arena = {
    s,
    me,
    events: [],
    clock,
    run: (n) => {
      for (let i = 0; i < n; i++) {
        stepWorld(s, me, { commands: [], worldTick: a.clock + i });
        a.events.push(...s.events.list);
      }
      a.clock += n;
    },
  };
  return a;
}

const made: string[] = [];
function temp(kind: string, def: SpawnerDef): string {
  (SPAWNERS as Record<string, SpawnerDef>)[kind] = def;
  made.push(kind);
  return kind;
}
afterAll(() => {
  for (const k of made) delete (SPAWNERS as Record<string, SpawnerDef>)[k];
});

const creaturesOf = (a: Arena): string[] =>
  query(a.s.entities, 'ai').map((id) => getComp(a.s.entities, id, 'ai')!.creature);

describe('rosters by phase', () => {
  const kind = temp('spawner.t_phase', {
    kind: 'spawner.t_phase',
    creature: 'creature.meadow_hare',
    cap: 2,
    respawn: 1,
    radius: 8,
    phases: { day: 'creature.meadow_hare', night: 'creature.moor_wisp' },
  });

  it('a spawner puts out its day creature by day and its night creature by night', () => {
    expect(creatureNow(SPAWNERS[kind]!, DAY)).toBe('creature.meadow_hare');
    expect(creatureNow(SPAWNERS[kind]!, NIGHT)).toBe('creature.moor_wisp');
    const day = arena(DAY, { x: 90, y: 90 });
    createSpawner(day.s, kind, 30 * 16, 30 * 16);
    day.run(10);
    expect(new Set(creaturesOf(day))).toEqual(new Set(['creature.meadow_hare']));
    const night = arena(NIGHT, { x: 90, y: 90 });
    createSpawner(night.s, kind, 30 * 16, 30 * 16);
    night.run(10);
    expect(new Set(creaturesOf(night))).toEqual(new Set(['creature.moor_wisp']));
  });

  it('a slot with nobody by night puts out nothing in the dark', () => {
    const k = temp('spawner.t_dayonly', {
      kind: 'spawner.t_dayonly',
      creature: 'creature.hedge_sparrow',
      cap: 2,
      respawn: 1,
      radius: 8,
      phases: { day: 'creature.hedge_sparrow', night: null },
    });
    const a = arena(NIGHT, { x: 90, y: 90 });
    createSpawner(a.s, k, 30 * 16, 30 * 16);
    a.run(20);
    expect(creaturesOf(a)).toEqual([]);
  });

  it('off-phase creatures leave once the avatar is far, and stay while it is near', () => {
    const far = arena(DAY, { x: 100, y: 100 });
    createSpawner(far.s, kind, 30 * 16, 30 * 16);
    far.run(10);
    expect(creaturesOf(far).length).toBeGreaterThan(0);
    far.clock = NIGHT;
    far.run(5);
    expect(new Set(creaturesOf(far))).toEqual(new Set(['creature.moor_wisp']));

    const near = arena(DAY, { x: 32, y: 30 });
    createSpawner(near.s, kind, 30 * 16, 30 * 16);
    near.run(10);
    const before = creaturesOf(near).length;
    expect(before).toBeGreaterThan(0);
    near.clock = NIGHT;
    near.run(5);
    // Still there: the avatar is close enough to watch them, under the despawn distance.
    expect(creaturesOf(near).filter((c) => c === 'creature.meadow_hare').length).toBeGreaterThan(0);
    expect(PHASE_DESPAWN_PX).toBeGreaterThan(64);
  });

  it('every zone slot is a real spawner whose creatures exist', () => {
    for (const z of ZONES)
      z.slots.forEach((s, i) => {
        const def = SPAWNERS[slotKind(z.id, i)];
        expect(def, `${z.id} ${i}`).toBeDefined();
        for (const c of [s.day, s.night]) if (c) expect(CREATURES[c], c).toBeDefined();
        expect(def!.step).toBe(z.step);
        expect(s.day ?? s.night).not.toBeNull();
      });
    expect(Object.keys(ROSTER_SPAWNERS).length).toBeGreaterThan(20);
  });
});

describe('zone steps', () => {
  it('b and c scale Health, defense and power over a', () => {
    const base = CREATURES['creature.fox']!;
    const a = arena(DAY);
    const ids = (['a', 'b', 'c'] as const).map((st) =>
      spawnCreature(a.s, 'creature.fox', 40, 40, -1, true, st),
    );
    const hp = ids.map((id) => a.s.entities.comps.pools[id]!.hpMax);
    const pow = ids.map((id) => a.s.entities.comps.combatant[id]!.power);
    expect(hp[0]).toBe(base.hp);
    expect(hp[1]).toBe(Math.round((base.hp * SPAWN_STEPS.b.hp) / 100));
    expect(hp[2]).toBeGreaterThan(hp[1]!);
    expect(pow[2]).toBeGreaterThan(pow[1]!);
    expect(pow[1]).toBeGreaterThan(pow[0]!);
  });

  it('a spawner spawns at its zone step', () => {
    const a = arena(DAY, { x: 100, y: 100 });
    const k = slotKind('cairnmoor', 0);
    createSpawner(a.s, k, 30 * 16, 30 * 16);
    a.run(5);
    const id = query(a.s.entities, 'ai')[0]!;
    expect(a.s.entities.comps.pools[id]!.hpMax).toBe(
      Math.round((CREATURES['creature.moorhound']!.hp * SPAWN_STEPS.c.hp) / 100),
    );
  });
});

describe('Hollowhorn on its daily route', () => {
  const def = SPAWNERS['spawner.hollowhorn']!;
  it('has a route, and calls a different point home each in-game day', () => {
    expect(def.route!.length).toBeGreaterThanOrEqual(3);
    const dayTicks = DAY + 1;
    const seen = new Set<string>();
    for (let d = 0; d < def.route!.length; d++) {
      let t = dayTicks;
      while (dayIndex(t) < dayIndex(dayTicks) + d) t += 500;
      const p = routePoint(def, t)!;
      seen.add(`${p.x},${p.y}`);
    }
    expect(seen.size).toBe(def.route!.length);
    expect(routePoint(SPAWNERS[slotKind('commons', 0)]!, DAY)).toBeNull();
  });

  it("its creature takes today's point as home, and a felled one is back the next day", () => {
    const a = arena(DAY, { x: 100, y: 100 });
    createSpawner(a.s, 'spawner.hollowhorn', 30 * 16, 62 * 16);
    a.run(3);
    const id = query(a.s.entities, 'ai')[0]!;
    const ai = a.s.entities.comps.ai[id]!;
    const p = routePoint(def, a.clock)!;
    expect(ai.home).toEqual({ x: px(p.x * 16 + 8), y: px(p.y * 16 + 14) });
    // Move the clock to the next day: the home changes with it.
    let next = a.clock;
    while (dayIndex(next) === dayIndex(a.clock)) next += 500;
    a.clock = next;
    a.run(3);
    const q = routePoint(def, a.clock)!;
    expect(ai.home).toEqual({ x: px(q.x * 16 + 8), y: px(q.y * 16 + 14) });
    expect(`${p.x},${p.y}`).not.toBe(`${q.x},${q.y}`);
  });
});

describe('feeding, soothing and scaring', () => {
  function withBerry(): { a: Arena; hare: number } {
    const a = arena(DAY);
    const inv = a.s.entities.comps.inventory[a.me]!;
    addItem(inv, 'item.berry_red', 2);
    a.s.entities.comps.avatar[a.me]!.facing = 2;
    const hare = spawnCreature(a.s, 'creature.meadow_hare', 30 * 16 + 8 + 20, 30 * 16 + 14);
    return { a, hare };
  }
  const slotOf = (a: Arena, item: string): number =>
    a.s.entities.comps.inventory[a.me]!.slots.findIndex((x) => x?.item === item);

  it('a creature takes an item its data lists, one unit, and is calm', () => {
    const { a, hare } = withBerry();
    const slot = slotOf(a, 'item.berry_red');
    expect(feedCreature(a.s, a.me, slot)).toBe(true);
    expect(a.s.entities.comps.inventory[a.me]!.slots[slot]!.qty).toBe(1);
    expect(isCalm(a.s, hare)).toBe(true);
    expect(a.s.events.list.some((e) => e.type === 'creatureFed')).toBe(true);
  });

  it('refuses what it does not eat, what is not in front, and what is in a fight', () => {
    const { a, hare } = withBerry();
    const inv = a.s.entities.comps.inventory[a.me]!;
    addItem(inv, 'item.moss_tuft', 1);
    expect(feedCreature(a.s, a.me, slotOf(a, 'item.moss_tuft'))).toBe(false);
    a.s.entities.comps.avatar[a.me]!.facing = 6;
    expect(feedCreature(a.s, a.me, slotOf(a, 'item.berry_red'))).toBe(false);
    a.s.entities.comps.avatar[a.me]!.facing = 2;
    a.s.entities.comps.ai[hare]!.provoked = true;
    expect(feedCreature(a.s, a.me, slotOf(a, 'item.berry_red'))).toBe(false);
    expect(inv.slots[slotOf(a, 'item.berry_red')]!.qty).toBe(2);
  });

  it('a calm hostile creature does not notice the avatar, and a hit ends the calm', () => {
    const a = arena(DAY);
    const fox = spawnCreature(a.s, 'creature.fox', 30 * 16 + 8 + 40, 30 * 16 + 14);
    // At night a fox is hostile. Calm it first by hand, as a fed fox.
    a.clock = NIGHT;
    getComp(a.s.entities, fox, 'ai')!.calmUntil = a.clock + 2000;
    a.run(120);
    expect(a.events.some((e) => e.type === 'noticed')).toBe(false);
    expect(a.s.entities.comps.ai[fox]!.state).not.toBe('approach');
    provoke(a.s, fox, a.me);
    expect(isCalm(a.s, fox)).toBe(false);
    a.run(80);
    expect(a.events.some((e) => e.type === 'noticed')).toBe(true);
  });

  it('calm drops a chase already under way', () => {
    const a = arena(NIGHT);
    const fox = spawnCreature(a.s, 'creature.fox', 30 * 16 + 8 + 50, 30 * 16 + 14);
    a.run(20);
    expect(['notice', 'approach']).toContain(a.s.entities.comps.ai[fox]!.state);
    getComp(a.s.entities, fox, 'ai')!.calmUntil = a.clock + 600;
    a.run(2);
    expect(a.s.entities.comps.ai[fox]!.state).toBe('idle');
    expect(a.s.entities.comps.ai[fox]!.target).toBeNull();
  });

  it('a song soothes the creatures whose data says it reaches them, and no others', () => {
    const a = arena(DAY);
    const hare = spawnCreature(a.s, 'creature.meadow_hare', 40, 40);
    const leech = spawnCreature(a.s, 'creature.marsh_leech', 50, 50);
    soothe(a.s, hare);
    soothe(a.s, leech);
    expect(isCalm(a.s, hare)).toBe(true);
    expect(isCalm(a.s, leech)).toBe(false);
  });

  it('the dead, stone and bosses cannot be scared; the rest can', () => {
    for (const id of ['strawman', 'barrow_bones', 'rubblet', 'hollowhorn', 'moor_wisp'])
      expect(scareable(`creature.${id}`), id).toBe(false);
    for (const id of ['meadow_hare', 'fox', 'moorhound', 'marsh_leech'])
      expect(scareable(`creature.${id}`), id).toBe(true);
  });

  it('every interaction names real creatures and real items, with positive durations', () => {
    for (const [c, i] of Object.entries(INTERACTIONS)) {
      expect(CREATURES[c], c).toBeDefined();
      if (i.feed) {
        expect(i.feed.calmTicks).toBeGreaterThan(0);
        for (const item of i.feed.items) expect(ITEMS[item], `${c} ${item}`).toBeDefined();
      }
      if (i.soothe !== undefined) expect(i.soothe).toBeGreaterThan(0);
    }
    for (const id of Object.keys(CREATURES))
      if (
        id !== 'creature.training_dummy' &&
        CREATURES[id]!.tier === 1 &&
        CREATURES[id]!.archetype !== 'dummy'
      )
        expect(INTERACTIONS[id], id).toBeDefined();
  });
});
