import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../../src/content/world/fixtures';
import { CAVE_ROOMS, OUTDOORS, roomAt } from '../../src/content/world/rooms';
import { SLICE_MAP } from '../../src/content/world/slice-map';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { getComp, query } from '../../src/sim/kernel/entities';
import type { SimEvent } from '../../src/sim/kernel/events';
import type { Command } from '../../src/sim/kernel/commands';
import { countItem } from '../../src/sim/items';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { buildChunks } from '../../src/sim/world/stamp';
import { TileWorld } from '../../src/sim/world/world';
import { collisionOfCell } from '../../tools/bake-assets/world';

const chunks = buildChunks(SLICE_MAP, collisionOfCell);
const objects = chunks.flatMap((c) =>
  c.objects.map((o) => ({ kind: o.kind, x: c.cx * 32 + o.x, y: c.cy * 32 + o.y })),
);
const at = (kind: string): { x: number; y: number } => {
  const o = objects.find((e) => e.kind === kind);
  if (!o) throw new Error(`no ${kind}`);
  return o;
};

const N = 0;
const E = 2;
const S = 4;
const W = 6;
type Dir = 0 | 2 | 4 | 6;
const STEP: Record<Dir, [number, number]> = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };

/** The slice world with every fixture, no creatures, and the avatar on the player spawn. */
function world(): Bot {
  const s = createDemoState(3, 0);
  s.world = new TileWorld(chunks);
  for (const o of objects) if (FIXTURES[o.kind]) spawnFixture(s, o.kind, o.x, o.y);
  const sp = at('spawn.player');
  const f = feetAt(sp.x, sp.y);
  const me = createAvatar(s, f.x, f.y);
  return new Bot(s, me);
}

/** A scripted player: plans a route on the tile grid and walks it with real commands. */
class Bot {
  events: SimEvent[] = [];
  constructor(
    readonly s: SimState,
    readonly me: number,
  ) {
    this.tick();
  }

  tick(...cmds: Command[]): void {
    stepWorld(this.s, this.me, { commands: cmds });
    this.events.push(...this.s.events.list);
  }

  pos(): { x: number; y: number } {
    const p = getComp(this.s.entities, this.me, 'pos');
    if (!p) throw new Error('no avatar');
    return { x: p.x / 256, y: p.y / 256 };
  }

  tile(): { x: number; y: number } {
    const p = this.pos();
    return { x: Math.floor(p.x / 16), y: Math.floor((p.y - 1) / 16) };
  }

  room(): string {
    const t = this.tile();
    return roomAt(t.x, t.y)?.id ?? 'none';
  }

  count(type: SimEvent['type']): number {
    return this.events.filter((e) => e.type === type).length;
  }

  /** Tiles that block right now: walls, water, and solid fixtures. */
  private blocked(): Set<string> {
    const out = new Set<string>();
    for (const id of query(this.s.entities, 'fixture', 'body', 'pos')) {
      const b = getComp(this.s.entities, id, 'body');
      const p = getComp(this.s.entities, id, 'pos');
      if (b?.solid && p) out.add(`${Math.floor(p.x / 4096)},${Math.floor((p.y - 1) / 4096)}`);
    }
    return out;
  }

  /** Shortest 4-neighbor route over open tiles, or null. */
  route(goal: { x: number; y: number }, extraBlocked: string[] = []): [number, number][] | null {
    const start = this.tile();
    const w = this.s.world;
    if (!w) throw new Error('no world');
    const dyn = this.blocked();
    for (const k of extraBlocked) dyn.add(k);
    const key = (x: number, y: number): string => `${x},${y}`;
    const prev = new Map<string, string | null>([[key(start.x, start.y), null]]);
    const q: [number, number][] = [[start.x, start.y]];
    while (q.length > 0) {
      const [x, y] = q.shift() as [number, number];
      if (x === goal.x && y === goal.y) {
        const path: [number, number][] = [];
        for (let k: string | null | undefined = key(x, y); k; k = prev.get(k)) {
          const [px, py] = k.split(',').map(Number) as [number, number];
          path.unshift([px, py]);
        }
        return path.slice(1);
      }
      for (const [dx, dy] of Object.values(STEP)) {
        const nx = x + dx;
        const ny = y + dy;
        const k = key(nx, ny);
        if (prev.has(k) || w.solidAt(nx, ny) !== 0) continue;
        if (dyn.has(k) && !(nx === goal.x && ny === goal.y)) continue;
        prev.set(k, key(x, y));
        q.push([nx, ny]);
      }
    }
    return null;
  }

  /** Walks to a tile. Stops early if a portal moves the avatar. Returns false if there is no route. */
  walkTo(goal: { x: number; y: number }, extraBlocked: string[] = []): boolean {
    const path = this.route(goal, extraBlocked);
    if (!path) return false;
    const room = this.room();
    for (const [tx, ty] of path) {
      const cx = tx * 16 + 8;
      const cy = ty * 16 + 12;
      for (let i = 0; i < 400; i++) {
        const p = this.pos();
        const dx = cx - p.x;
        const dy = cy - p.y;
        if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) break;
        if (this.room() !== room) {
          this.tick({ type: 'move', dir: null });
          return true;
        }
        const dir = Math.abs(dx) > 2 ? (dx > 0 ? E : W) : dy > 0 ? S : N;
        this.tick({ type: 'move', dir });
      }
    }
    this.tick({ type: 'move', dir: null });
    return true;
  }

  /** Stand on `from`, face `dir`, and press the context button. */
  use(from: { x: number; y: number }, dir: Dir): void {
    expect(this.walkTo(from)).toBe(true);
    // Moving into the thing turns the avatar toward it.
    for (let i = 0; i < 4; i++) this.tick({ type: 'move', dir });
    this.tick({ type: 'move', dir: null });
    this.tick({ type: 'interact' });
    for (let i = 0; i < 3; i++) this.tick();
  }

  fixtureTile(kind: string): { x: number; y: number } {
    for (const id of query(this.s.entities, 'fixture', 'pos')) {
      if (getComp(this.s.entities, id, 'fixture')?.kind !== kind) continue;
      const p = getComp(this.s.entities, id, 'pos');
      if (p) return { x: Math.floor(p.x / 4096), y: Math.floor((p.y - 1) / 4096) };
    }
    throw new Error(`no fixture ${kind}`);
  }

  /** Pushes the puzzle block `times` tiles toward `dir`. */
  push(dir: Dir, times: number): void {
    for (let i = 0; i < times; i++) {
      const b = this.fixtureTile('fixture.block_puzzle');
      const [dx, dy] = STEP[dir];
      this.use({ x: b.x - dx, y: b.y - dy }, dir);
    }
  }
}

describe('slice map data', () => {
  it('is 3 x 5 chunks with the outdoor area and five cave rooms', () => {
    expect(chunks).toHaveLength(15);
    expect(CAVE_ROOMS).toHaveLength(5);
    for (const r of CAVE_ROOMS) {
      expect(r.x0).toBeGreaterThanOrEqual(0);
      expect(r.y0).toBeGreaterThanOrEqual(OUTDOORS.y1);
    }
  });

  it('every placed fixture kind exists, and every portal has a twin or an arrival', () => {
    const kinds = objects.filter((o) => o.kind.startsWith('fixture.')).map((o) => o.kind);
    for (const k of kinds) expect(FIXTURES[k], k).toBeDefined();
    for (const k of kinds) {
      const to = FIXTURES[k]?.to;
      if (to) expect(kinds, `${k} leads to ${to}`).toContain(to);
    }
  });

  it('every fixture and spawner stands on open ground inside a room', () => {
    const w = new TileWorld(chunks);
    for (const o of objects) {
      if (!o.kind.startsWith('fixture.') && !o.kind.startsWith('spawner.')) continue;
      expect(roomAt(o.x, o.y), `${o.kind} at ${o.x},${o.y}`).not.toBeNull();
      const type = FIXTURES[o.kind]?.type;
      if (type !== 'portal' && type !== 'arrival') expect(w.solidAt(o.x, o.y), o.kind).toBe(0);
    }
  });
});

describe('fixtures', () => {
  it('a locked door stays shut without the key, and opens with it, using the key up', () => {
    const b = world();
    const door = b.fixtureTile('fixture.door_boss');
    b.s.entities.comps.pos[b.me] = {
      x: (door.x - 1) * 4096 + 2048,
      y: door.y * 4096 + 3072,
    };
    b.tick({ type: 'move', dir: E });
    b.tick({ type: 'move', dir: E });
    b.tick({ type: 'interact' });
    expect(b.count('doorLocked')).toBe(1);
    expect(b.count('doorOpened')).toBe(0);
    const inv = b.s.entities.comps.inventory[b.me];
    inv?.slots.splice(0, 1, { item: 'item.old_key', qty: 1 });
    b.tick({ type: 'interact' });
    expect(b.count('doorOpened')).toBe(1);
    expect(inv ? countItem(inv, 'item.old_key') : -1).toBe(0);
  });

  it('the Waystone sets the respawn point and restores pools', () => {
    const b = world();
    const w = b.fixtureTile('fixture.waystone');
    const pools = b.s.entities.comps.pools[b.me];
    if (pools) pools.hp = 1;
    b.use({ x: w.x, y: w.y + 1 }, N);
    expect(b.count('waystoneSet')).toBe(1);
    const a = b.s.entities.comps.avatar[b.me];
    expect(a?.respawn.x).toBe(w.x * 4096 + 2048);
    expect(pools?.hp).toBe(pools?.hpMax);
  });

  it('a pressure plate ignores the avatar and takes only a block', () => {
    const b = world();
    // The slice puzzle plate lives in the cave. Put the avatar on it directly.
    const pl = b.fixtureTile('fixture.plate_puzzle');
    b.s.entities.comps.pos[b.me] = { x: pl.x * 4096 + 2048, y: pl.y * 4096 + 3072 };
    for (let i = 0; i < 5; i++) b.tick();
    expect(b.count('plateChanged')).toBe(0);
    expect(b.count('gateOpened')).toBe(0);
  });
});

describe('the cave run', () => {
  it('a bot goes from the square to the miniboss room and back through the shortcut', () => {
    const b = world();
    expect(b.room()).toBe('room.outdoors');

    // Out of the square, over the bridge, down the road, into the cave.
    expect(b.walkTo(at('fixture.portal_cave_mouth'))).toBe(true);
    expect(b.room()).toBe('room.a');

    // A to the hall.
    expect(b.walkTo(at('fixture.portal_a_east'))).toBe(true);
    expect(b.room()).toBe('room.b');

    // The hall's door to the boss is locked.
    const door = b.fixtureTile('fixture.door_boss');
    b.use({ x: door.x - 1, y: door.y }, E);
    expect(b.count('doorLocked')).toBe(1);

    // The puzzle room: block east along its row, then north onto the plate.
    expect(b.walkTo(at('fixture.portal_b_north'))).toBe(true);
    expect(b.room()).toBe('room.c');
    const home = b.fixtureTile('fixture.block_puzzle');
    const plate = b.fixtureTile('fixture.plate_puzzle');
    b.push(E, plate.x - home.x);
    b.push(N, home.y - plate.y);
    expect(b.count('gateOpened')).toBe(1);

    // The key is in the chest behind the gate.
    const chest = b.fixtureTile('fixture.chest_key');
    b.use({ x: chest.x, y: chest.y + 1 }, N);
    expect(b.count('chestOpened')).toBe(1);
    const inv = b.s.entities.comps.inventory[b.me];
    expect(inv ? countItem(inv, 'item.old_key') : 0).toBe(1);

    // Back to the hall, unlock, go through to the boss room.
    expect(b.walkTo(at('fixture.portal_c_south'))).toBe(true);
    expect(b.room()).toBe('room.b');
    b.use({ x: door.x - 1, y: door.y }, E);
    expect(b.count('doorOpened')).toBe(1);
    expect(b.walkTo(at('fixture.portal_b_east'))).toBe(true);
    expect(b.room()).toBe('room.e');

    // The shortcut leads to the entrance room, and the entrance room leads outside.
    expect(b.walkTo(at('fixture.portal_e_shortcut'))).toBe(true);
    expect(b.room()).toBe('room.a');
    expect(b.walkTo(at('fixture.portal_a_entry'))).toBe(true);
    expect(b.room()).toBe('room.outdoors');
    expect(b.tile().y).toBeGreaterThan(at('fixture.portal_cave_mouth').y);
  });

  it('the side room holds a chest and a tablet', () => {
    const b = world();
    expect(b.walkTo(at('fixture.portal_cave_mouth'))).toBe(true);
    expect(b.walkTo(at('fixture.portal_a_east'))).toBe(true);
    expect(b.walkTo(at('fixture.portal_b_south'))).toBe(true);
    expect(b.room()).toBe('room.d');
    const chest = b.fixtureTile('fixture.chest_side');
    b.use({ x: chest.x - 1, y: chest.y }, E);
    expect(b.count('chestOpened')).toBe(1);
    expect(b.s.entities.comps.avatar[b.me]?.coin).toBe(40);
    const tablet = b.fixtureTile('fixture.tablet');
    b.use({ x: tablet.x + 1, y: tablet.y }, W);
    expect(b.count('tabletRead')).toBe(1);
  });
});

describe('the pressure plate puzzle cannot soft lock', () => {
  /** Walks into the puzzle room and returns the bot. */
  function inPuzzleRoom(): Bot {
    const b = world();
    b.walkTo(at('fixture.portal_cave_mouth'));
    b.walkTo(at('fixture.portal_a_east'));
    b.walkTo(at('fixture.portal_b_north'));
    expect(b.room()).toBe('room.c');
    return b;
  }

  it('leaving and coming back resets a block that was pushed somewhere useless', () => {
    const b = inPuzzleRoom();
    const home = b.fixtureTile('fixture.block_puzzle');
    b.push(S, 1);
    b.push(S, 1);
    expect(b.fixtureTile('fixture.block_puzzle')).not.toEqual(home);
    b.walkTo(at('fixture.portal_c_south'));
    expect(b.room()).toBe('room.b');
    b.walkTo(at('fixture.portal_b_north'));
    expect(b.room()).toBe('room.c');
    expect(b.fixtureTile('fixture.block_puzzle')).toEqual(home);
    expect(b.count('blockReset')).toBeGreaterThan(0);
  });

  it('a solved puzzle stays solved: the block is not reset and the gate stays open', () => {
    const b = inPuzzleRoom();
    const home = b.fixtureTile('fixture.block_puzzle');
    const plate = b.fixtureTile('fixture.plate_puzzle');
    b.push(E, plate.x - home.x);
    b.push(N, home.y - plate.y);
    expect(b.count('gateOpened')).toBe(1);
    b.walkTo(at('fixture.portal_c_south'));
    b.walkTo(at('fixture.portal_b_north'));
    expect(b.fixtureTile('fixture.block_puzzle')).toEqual(plate);
    const gate = b.fixtureTile('fixture.gate_puzzle');
    expect(b.route({ x: gate.x, y: gate.y - 1 })).not.toBeNull();
  });

  it('wherever the block sits, the exit is still reachable from where you arrive', () => {
    const b = inPuzzleRoom();
    const room = CAVE_ROOMS.find((r) => r.id === 'room.c');
    if (!room) throw new Error('no room.c');
    const exit = at('fixture.portal_c_south');
    let checked = 0;
    for (let y = room.y0 + 1; y < room.y1 - 1; y++) {
      for (let x = room.x0 + 1; x < room.x1 - 1; x++) {
        if (b.s.world?.solidAt(x, y) !== 0) continue;
        // The sim refuses to push a block within 20 px of a portal, so such tiles are unreachable.
        if (Math.abs(x - exit.x) <= 1 && Math.abs(y - exit.y) <= 1) continue;
        const r = b.route(exit, [`${x},${y}`]);
        const here = b.tile();
        if (here.x === x && here.y === y) continue;
        expect(r, `block at ${x},${y} seals the exit`).not.toBeNull();
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
