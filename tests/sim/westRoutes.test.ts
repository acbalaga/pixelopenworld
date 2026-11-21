import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../../src/content/world/fixtures';
import {
  BELL_ORDER,
  CLIMB_TOP,
  LANDING,
  LANDING_SPOTS,
} from '../../src/content/world/dungeons/west';
import { MINIS } from '../../src/content/world/dungeons/minis';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { roomAt } from '../../src/content/world/rooms';
import {
  THORNWALL_BUILT,
  KEEP_DOOR,
  THORNWALL_MOUTH,
} from '../../src/content/world/dungeons/thornwall';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { kill } from '../../src/sim/combat/fighter';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { getComp } from '../../src/sim/kernel/entities';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { fixturesSystem, interactFixture, spawnFixture } from '../../src/sim/systems/fixtures';
import { Solid, decodeChunk } from '../../src/sim/world/chunk';
import { newStream } from '../../src/sim/world/stream';
import { TileWorld } from '../../src/sim/world/world';
import { bakeRegion } from '../../tools/bake-world/bake';

const OPEN = { solidAt: (): number => 0 };
function world(): { s: SimState; me: number } {
  const s = createDemoState(5, 0);
  s.world = OPEN;
  const f = feetAt(10, 10);
  const me = createAvatar(s, f.x, f.y);
  return { s, me };
}
const at = (s: SimState, me: number): [number, number] => {
  const p = getComp(s.entities, me, 'pos')!;
  return [Math.floor(p.x / 256 / 16), Math.floor((p.y / 256 - 1) / 16)];
};

describe('ledges (the Fernside climb)', () => {
  it('need Athletics 25 and Stamina, and carry the avatar two tiles on', () => {
    const { s, me } = world();
    spawnFixture(s, 'fixture.ledge', 10, 9);
    const a = getComp(s.entities, me, 'avatar')!;
    a.facing = 0;
    const pools = getComp(s.entities, me, 'pools')!;
    const sk = getComp(s.entities, me, 'skills')!;
    const before = at(s, me);
    interactFixture(s, me);
    expect(at(s, me)).toEqual(before);
    expect(s.events.list.some((e) => e.type === 'denied' && e.reason === 'requires')).toBe(true);
    sk.points['skill.athletics'] = 25;
    pools.sta = 5;
    s.events.list.length = 0;
    interactFixture(s, me);
    expect(at(s, me)).toEqual(before);
    expect(s.events.list.some((e) => e.type === 'denied' && e.reason === 'stamina')).toBe(true);
    pools.sta = pools.staMax;
    const sta0 = pools.sta;
    interactFixture(s, me);
    expect(at(s, me)[1]).toBe(before[1] - 2);
    expect(pools.sta).toBe(sta0 - FIXTURES['fixture.ledge']!.climb!.stamina);
  });

  it('span the whole climb route, so there is no way round', () => {
    const climb = DAWNMEADOW.placements.find((p) => p.stamp === 'fernside_climb')!;
    const objs = STAMPS['fernside_climb']!.objects!.filter((o) => o.kind === 'fixture.ledge');
    expect(objs.length).toBeGreaterThanOrEqual(18);
    for (const y of new Set(objs.map((o) => o.y)))
      expect(
        objs
          .filter((o) => o.y === y)
          .map((o) => o.x)
          .sort(),
      ).toEqual([3, 4, 5]);
    expect(CLIMB_TOP.x).toBeGreaterThanOrEqual(climb.x + 3);
  });
});

describe('bells', () => {
  const bells = (): { s: SimState; me: number; ids: number[] } => {
    const { s, me } = world();
    const ids = [1, 2, 3].map((n) => spawnFixture(s, `fixture.tw_bell_${n}`, 10 + n * 2, 9));
    return { s, me, ids };
  };
  const ring = (s: SimState, me: number, id: number): void => {
    const p = getComp(s.entities, id, 'pos')!;
    s.entities.comps.pos[me] = { x: p.x, y: p.y + 16 * 256 };
    getComp(s.entities, me, 'avatar')!.facing = 0;
    interactFixture(s, me);
  };
  const state = (s: SimState, ids: number[]): boolean[] =>
    ids.map((i) => getComp(s.entities, i, 'fixture')!.open);

  it('stay rung when rung in order', () => {
    const { s, me, ids } = bells();
    for (const n of BELL_ORDER) ring(s, me, ids[n - 1]!);
    expect(state(s, ids)).toEqual([true, true, true]);
  });

  it('are all silenced by a bell rung out of turn', () => {
    const { s, me, ids } = bells();
    // The first of the order, then the last: out of turn.
    ring(s, me, ids[BELL_ORDER[0]! - 1]!);
    expect(state(s, ids).filter(Boolean)).toHaveLength(1);
    ring(s, me, ids[BELL_ORDER[2]! - 1]!);
    expect(state(s, ids)).toEqual([false, false, false]);
  });
});

describe('the closed yard at the west edge', () => {
  const files = bakeRegion(DAWNMEADOW, STAMPS);
  const grid = new TileWorld();
  for (const [name, v] of files)
    if (/^dawnmeadow\/chunk-\d+-\d+\.bin$/.test(name)) grid.set(decodeChunk(v as Uint8Array));

  it("has open floor at each route's end, and rock all round it", () => {
    for (const p of Object.values(LANDING_SPOTS)) {
      expect(grid.solidAt(p.x, p.y)).toBe(Solid.None);
      expect(p.x).toBeGreaterThan(LANDING.x);
      expect(p.x).toBeLessThan(LANDING.x + LANDING.w - 1);
    }
    for (let x = LANDING.x; x < LANDING.x + LANDING.w; x++) {
      expect(grid.solidAt(x, LANDING.y)).not.toBe(Solid.None);
      expect(grid.solidAt(x, LANDING.y + LANDING.h - 1)).not.toBe(Solid.None);
    }
    for (let y = LANDING.y; y < LANDING.y + LANDING.h; y++) {
      expect(grid.solidAt(LANDING.x, y)).not.toBe(Solid.None);
      expect(grid.solidAt(LANDING.x + LANDING.w - 1, y)).not.toBe(Solid.None);
    }
  });

  const game = (): { s: SimState; me: number } => {
    const s = createDemoState(5, 0);
    s.region = 'dawnmeadow';
    s.tick = 10_000;
    s.world = grid;
    s.stream = newStream(grid, false);
    const f = feetAt(2, 2);
    return { s, me: createAvatar(s, f.x, f.y) };
  };
  const stand = (s: SimState, me: number, t: { x: number; y: number }): void => {
    s.entities.comps.pos[me] = { x: (t.x * 16 + 8) * 256, y: (t.y * 16 + 8) * 256 };
    for (let i = 0; i < 3; i++) stepWorld(s, me, { commands: [] } as never);
  };
  const inYard = (s: SimState, me: number): boolean => {
    const [x, y] = at(s, me);
    return x > LANDING.x && x < LANDING.x + LANDING.w && y > LANDING.y && y < LANDING.y + LANDING.h;
  };

  it('is reached by the top of the Fernside climb', () => {
    const { s, me } = game();
    stand(s, me, CLIMB_TOP);
    expect(inYard(s, me)).toBe(true);
    expect(roomAt(...at(s, me), 'dawnmeadow')?.outdoors).toBe(true);
  });

  it("is reached through the badger tunnels, by the Sett's back door", () => {
    const m2 = MINIS.find((m) => m.def.id === 'dungeon.m2')!;
    const d = m2.spec.doors![0]!;
    const { s, me } = game();
    stand(s, me, m2.regionTile(d.room, d.tile));
    expect(inYard(s, me)).toBe(true);
  });

  it('is reached through Thornwall Pass, once the Warden is down', () => {
    const m = THORNWALL_BUILT;
    const { s, me } = game();
    stand(s, me, { x: THORNWALL_MOUTH.x + 1, y: THORNWALL_MOUTH.y + 1 });
    expect(roomAt(...at(s, me), 'dawnmeadow')?.id).toBe(m.roomId('t1'));
    for (const e of m.def.edges) {
      stand(s, me, m.regionTile(e.from, e.at));
      expect(roomAt(...at(s, me), 'dawnmeadow')?.id, `${e.from} to ${e.to}`).toBe(m.roomId(e.to));
    }
    // The way out is shut behind its slab.
    const door = m.spec.doors![0]!;
    const t = m.regionTile(door.room, door.tile);
    spawnFixture(s, door.kind, t.x, t.y);
    stand(s, me, t);
    expect(inYard(s, me)).toBe(false);
    // The Warden falls, and it opens.
    const w = spawnCreature(s, 'creature.hedge_warden', 40 * 16, 40 * 16, -1);
    kill(s, w);
    // The fixtures system reads the death the tick it happens.
    fixturesSystem(s);
    stand(s, me, t);
    expect(inYard(s, me)).toBe(true);
  });

  it("reaches the keep's upper room by a door in the Fernside climb, and no other way", () => {
    const { s, me } = game();
    stand(s, me, KEEP_DOOR);
    expect(roomAt(...at(s, me), 'dawnmeadow')?.id).toBe(THORNWALL_BUILT.roomId('t7'));
  });
});
