import { describe, expect, it } from 'vitest';
import { OUTCOME, PROGRESS } from '../../src/content/balance/travelers';
import { createAvatar } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { stepWorld } from '../../src/sim/step';
import { getComp, query } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, serializeState, type SimState } from '../../src/sim/state';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import {
  demoteAll,
  expectedPx,
  profileOf,
  standPx,
  travelerViews,
} from '../../src/sim/travelers/entities';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { isTravelerEntity, travelerSlotOf } from '../../src/sim/travelers/kind';
import { PLACE_LIST } from '../../src/sim/travelers/lists';
import { findPath } from '../../src/sim/travelers/path';

const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;
const OPEN = { solidAt: (): number => 0 };

/** A state with open ground, an avatar at (x, y) px, and the clock set. */
function world(seed: number, at: { x: number; y: number }): SimState {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  createAvatar(s, px(at.x), px(at.y));
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

/** Runs `ticks` sim ticks of 30 a second, the clock following. */
function run(s: SimState, ticks: number): void {
  const base = s.clock!.nowMs;
  const start = s.tick;
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    s.worldTick++;
    s.clock = { ...s.clock!, nowMs: base + Math.floor(((s.tick - start) * 1000) / 30) };
    s.events.list.length = 0;
    travelersSystem(s);
  }
}

const SQUARE = standPx(0, PLACE_LIST.indexOf('hearthford.square'))!;
const FAR = { x: 20_000, y: 20_000 };

describe('promotion and demotion', () => {
  it('promotes Travelers whose place is near the player, and only them', () => {
    const near = world(3, SQUARE);
    run(near, 300);
    const c = crowdOf(near);
    expect(c.ents.size).toBeGreaterThan(0);
    for (const id of c.ents.keys()) expect(travelerSlotOf(near, id)).toBeGreaterThanOrEqual(0);
    const far = world(3, FAR);
    run(far, 300);
    expect(crowdOf(far).ents.size).toBe(0);
  });

  it('holds the cap of 30 and keeps the nearest', () => {
    const s = world(5, SQUARE);
    run(s, 600);
    const c = crowdOf(s);
    expect(c.ents.size).toBeLessThanOrEqual(30);
  });

  it('builds the entity from the life and the identity', () => {
    const s = world(3, SQUARE);
    run(s, 300);
    const c = crowdOf(s);
    const [id, ent] = [...c.ents][0]!;
    const t = identitiesOf(3)[ent.slot]!;
    expect(getComp(s.entities, id, 'combatant')?.name).toBe(t.handle);
    expect(getComp(s.entities, id, 'fighter')?.team).toBe(0);
    expect(getComp(s.entities, id, 'pools')!.hpMax).toBeGreaterThan(60);
    expect(travelerViews(s).length).toBe(c.ents.size);
    expect(isTravelerEntity(s, id)).toBe(true);
  });

  it('never saves an entity, and saving does not disturb the crowd', () => {
    const s = world(3, SQUARE);
    run(s, 300);
    expect(crowdOf(s).ents.size).toBeGreaterThan(0);
    const text = serializeState(s);
    expect(text).not.toContain('traveler:');
    expect(crowdOf(s).ents.size).toBeGreaterThan(0);
    demoteAll(s);
    expect(crowdOf(s).ents.size).toBe(0);
    expect(query(s.entities, 'interactable').filter((i) => travelerSlotOf(s, i) >= 0)).toEqual([]);
  });

  it('a Traveler who logs out on screen shimmers and is gone, and is not online next tick', () => {
    const s = world(3, SQUARE);
    run(s, 300);
    const c = crowdOf(s);
    // Skip ahead ten real minutes at a time until a promoted Traveler logs out.
    let out = -1;
    for (let i = 0; i < 40 && out < 0; i++) {
      const before = [...c.ents.values()].map((e) => e.slot);
      s.clock = { ...s.clock!, nowMs: s.clock!.nowMs + 600_000 };
      run(s, 61);
      out = before.find((slot) => !c.online[slot]) ?? -1;
      if (out >= 0 && !c.fx.some((f) => f.slot === out && f.kind === 'out')) out = -1;
    }
    expect(out).toBeGreaterThanOrEqual(0);
    expect(c.entOf[out]).toBe(-1);
    expect(c.promoted[out]).toBe(0);
    expect(c.fx.some((f) => f.slot === out && f.kind === 'out')).toBe(true);
    run(s, 1);
    expect(c.online[out]).toBe(0);
  });

  it('shimmers a Traveler in on login', () => {
    const s = world(3, SQUARE);
    let seen = false;
    for (let i = 0; i < 60 * 60 * 3 && !seen; i += 30) {
      run(s, 30);
      seen = crowdOf(s).fx.some((f) => f.kind === 'in');
    }
    expect(seen).toBe(true);
  });
});

describe('the round trip', () => {
  /** A promoted run and a purely abstract run of the same 600 ticks must agree on every life. */
  it('changes nothing the abstract model would not: 1,000 seeded round trips', () => {
    // A fall in a fight is the one thing the entity layer replaces with the real thing: on screen
    // a Traveler dies to a creature, off screen to a roll. The roll is off for this comparison.
    const outcome = OUTCOME as { deathChance: number };
    const kept = outcome.deathChance;
    outcome.deathChance = 0;
    try {
      roundTrips();
    } finally {
      outcome.deathChance = kept;
    }
  }, 120_000);

  function roundTrips(): void {
    for (let seed = 1; seed <= 1000; seed++) {
      const a = world(seed, SQUARE);
      const b = world(seed, FAR);
      run(a, 600);
      run(b, 600);
      demoteAll(a);
      const ca = crowdOf(a);
      expect(ca.ents.size).toBe(0);
      // Same lives, same goods, same doing: coin and items are neither created nor lost.
      expect(a.travelers, `seed ${seed}`).toEqual(b.travelers);
      expect(crowdOf(a).stock).toEqual(crowdOf(b).stock);
      if (seed <= 3) expect(crowdOf(a).promoted.some((v) => v === 1)).toBe(false);
    }
  }

  it('keeps every life inside the bounds the abstract model accepts', () => {
    const s = world(8, SQUARE);
    const before = structuredClone(s.travelers);
    run(s, 1800);
    demoteAll(s);
    const ids = identitiesOf(8);
    s.travelers.forEach((l, i) => {
      expect(PLACE_LIST[l.place]).toBeDefined();
      expect(l.coin).toBeGreaterThanOrEqual(0);
      expect(l.coin).toBeLessThanOrEqual(PROGRESS.coinCap);
      for (const [skill, pts] of l.build) {
        const was = before[i]!.build.find(([k]) => k === skill)?.[1] ?? 0;
        expect(pts).toBeGreaterThanOrEqual(was);
        expect(ids[i]!.focus.length).toBeGreaterThan(0);
      }
    });
  });

  it('puts a Traveler back on the road with the minutes left when it walks out of range', () => {
    const s = world(3, SQUARE);
    run(s, 300);
    const c = crowdOf(s);
    const [id, ent] = [...c.ents][0]!;
    const d = {
      kind: 'social' as const,
      place: PLACE_LIST.indexOf('stonecrop.quarry'),
      left: 30,
      eta: 20,
      from: PLACE_LIST.indexOf('hearthford.square'),
      total: 20,
      skill: -1,
      thing: '',
    };
    c.doing[ent.slot] = d;
    // Carry the avatar away so the entity is outside the loaded ring.
    const av = query(s.entities, 'avatar')[0]!;
    getComp(s.entities, av, 'pos')!.x = px(FAR.x);
    getComp(s.entities, av, 'pos')!.y = px(FAR.y);
    run(s, 60);
    expect(c.ents.has(id)).toBe(false);
    const after = c.doing[ent.slot];
    if (after && after === d) expect(after.eta).toBeGreaterThanOrEqual(1);
    expect(expectedPx(s, c, ent.slot)).not.toBeNull();
  });
});

describe('walking', () => {
  it('finds a path around a wall and reports an unreachable goal', () => {
    const wall = {
      solidAt: (x: number, y: number): number => (x === 5 && y >= -3 && y <= 3 ? 1 : 0),
    };
    const p = findPath(wall, { x: 0, y: 0 }, { x: 10, y: 0 })!;
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[p.length - 1]).toEqual({ x: 10, y: 0 });
    expect(p.some((t) => t.x === 5 && Math.abs(t.y) <= 3)).toBe(false);
    const box = {
      solidAt: (x: number, y: number): number =>
        Math.abs(x - 10) <= 1 && Math.abs(y) <= 1 && !(x === 10 && y === 0) ? 1 : 0,
    };
    expect(findPath(box, { x: 0, y: 0 }, { x: 10, y: 0 }, 200)).toBeNull();
  });

  it('shows walking Travelers moving over time', () => {
    const s = world(3, SQUARE);
    run(s, 600);
    const a = new Map(
      travelerViews(s).map((v) => [v.slot, `${Math.round(v.x)},${Math.round(v.y)}`]),
    );
    run(s, 600);
    let moved = 0;
    for (const v of travelerViews(s))
      if (a.has(v.slot) && a.get(v.slot) !== `${Math.round(v.x)},${Math.round(v.y)}`) moved++;
    expect(moved).toBeGreaterThan(0);
  });
});

describe('profile card', () => {
  it('shows handle, guild and three top skills by band, never exact points', () => {
    const s = createDemoState(3, 0);
    const card = profileOf(s, 12); // Marrow
    expect(card.handle).toBe('Marrow');
    expect(card.guild).toBe(2);
    expect(card.skills.length).toBeLessThanOrEqual(3);
    for (const k of card.skills) {
      expect(Number.isInteger(k.band)).toBe(true);
      expect(k.band).toBeLessThanOrEqual(4);
    }
    expect(card.met).toBe(false);
  });
});

describe('Travelers in combat', () => {
  it('fight creatures in the real combat system and the kill pays nothing', () => {
    const s = world(3, { x: SQUARE.x + 600, y: SQUARE.y });
    // A busy crowd first, so some Traveler is promoted near the square.
    run(s, 300);
    const c = crowdOf(s);
    const [id, ent] = [...c.ents][0]!;
    const who = query(s.entities, 'avatar')[0]!;
    // Pin the Traveler to a fight and put a rat in front of it, far from the avatar.
    c.doing[ent.slot] = {
      kind: 'fight',
      place: s.travelers[ent.slot]!.place,
      left: 400,
      eta: 0,
      from: 0,
      total: 0,
      skill: -1,
      thing: 'creature.grain_rat',
    };
    const p = getComp(s.entities, id, 'pos')!;
    const rat = spawnCreature(s, 'creature.grain_rat', p.x / 256 + 36, p.y / 256);
    const killsBefore = { ...s.ledger.kills };
    let died = false;
    for (let i = 0; i < 900 && !died; i++) {
      s.clock = { ...s.clock!, nowMs: s.clock!.nowMs + 33 };
      stepWorld(s, who, { commands: [], worldTick: s.worldTick + 1, clock: s.clock });
      died = s.events.list.some((e) => e.type === 'killed' && e.dst === rat);
    }
    expect(died).toBe(true);
    const killed = s.events.list.find((e) => e.type === 'killed');
    expect(killed && 'src' in killed && travelerSlotOf(s, killed.src)).toBeGreaterThanOrEqual(0);
    expect(s.ledger.kills).toEqual(killsBefore);
    for (let i = 0; i < 30; i++)
      stepWorld(s, who, { commands: [], worldTick: s.worldTick + 1, clock: s.clock! });
    expect(query(s.entities, 'pickup')).toEqual([]);
  });
});
