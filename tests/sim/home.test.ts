import { describe, expect, it } from 'vitest';
import {
  FULL_INN_LAYOUT,
  PIECES,
  PIECE_BY_ID,
  STARTER_PIECES,
} from '../../src/content/furniture/pieces';
import { FIXTURES } from '../../src/content/world/fixtures';
import { INN_ROOM, INTERIORS } from '../../src/content/world/interiors';
import { roomAt } from '../../src/content/world/rooms';
import { createAvatar } from '../../src/sim/avatar';
import {
  doorTiles,
  firstSpot,
  footprint,
  homeCommand,
  interiorOf,
  placedIn,
  whyNot,
} from '../../src/sim/home';
import { newHome } from '../../src/sim/homeState';
import type { Placed } from '../../src/sim/homeState';
import { give } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import {
  createDemoState,
  deserializeState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture, bedNear } from '../../src/sim/systems/fixtures';

/**
 * Rooms and furniture (POW-M6-07): the placement rules, the commands, the inn room's door, and that
 * a layout survives a reload. The save and integrity side is in `tests/unit/homeSave.test.ts`.
 */

const OPEN = { solidAt: (): number => 0 };
const T = 16;
const room = INN_ROOM;

/** A state with the avatar standing on floor tile (fx, fy) of the inn room. */
function inRoom(
  fx = 2,
  fy = 2,
): { s: SimState; me: number; events: SimEvent[]; tick: (...c: Command[]) => void } {
  const s = createDemoState(11, 0);
  s.world = OPEN;
  s.region = 'dawnmeadow';
  const me = createAvatar(s, 0, 0);
  const pos = s.entities.comps.pos[me]!;
  pos.x = px((room.floorOrigin.x + fx) * T + T / 2);
  pos.y = px((room.floorOrigin.y + fy) * T + T - 2);
  const events: SimEvent[] = [];
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds, worldTick: s.tick + 1 });
    events.push(...s.events.list);
  };
  tick({ type: 'scheme', scheme: 'classic' });
  return { s, me, events, tick };
}

const piece = (id: string, x: number, y: number, rot = 0): Placed => ({
  piece: id,
  x,
  y,
  rot,
  e: 0,
});
const can = (id: string, x: number, y: number, rot = 0, others: Placed[] = []): string | null =>
  whyNot(room, PIECE_BY_ID[id]!, x, y, rot, others);

describe('the inn room', () => {
  it('is a 4 by 4 floor in a camera room of its own, and the avatar is in it', () => {
    expect(room.w).toBe(4);
    expect(room.h).toBe(4);
    const { s, me } = inRoom();
    expect(interiorOf(s, me)?.id).toBe('interior.inn_room');
    const r = roomAt(room.floorOrigin.x, room.floorOrigin.y, 'dawnmeadow');
    expect(r?.id).toBe(room.roomId);
    expect(r?.outdoors).toBeFalsy();
    expect(r!.x1 - r!.x0).toBe(6);
    expect(r!.y1 - r!.y0).toBe(6);
  });

  it('starts with the straw bed and the small chest standing in it', () => {
    expect(newHome().rooms['interior.inn_room']!.map((p) => p.piece)).toEqual(STARTER_PIECES);
    const { s } = inRoom();
    // The first tick made an entity for each.
    for (const o of placedIn(s, room.id)) expect(s.entities.comps.fixture[o.e]).toBeDefined();
  });

  it('the stair door and the way out lead to each other', () => {
    const fx = room.fixtures();
    const out = fx.find((f) => f.kind === 'fixture.innroom_stairs')!;
    const inn = fx.find((f) => f.kind === 'fixture.innroom_exit')!;
    expect(out.to).toBe(inn.kind);
    expect(inn.to).toBe(out.kind);
    expect(FIXTURES[out.kind]).toBeDefined();
    expect(FIXTURES[inn.kind]).toBeDefined();
  });

  it('taking the stairs and coming back changes the room, once each, and leaves no spare entities', () => {
    const { s, me, events, tick } = inRoom();
    const stairs = FIXTURES['fixture.innroom_stairs']!;
    const exit = FIXTURES['fixture.innroom_exit']!;
    const stairsId = spawnFixture(s, stairs.kind, stairs.at!.x, stairs.at!.y);
    const exitId = spawnFixture(s, exit.kind, exit.at!.x, exit.at!.y);
    const fixturesBefore = Object.keys(s.entities.comps.fixture).length;
    // Out: stand on the exit portal.
    const e = s.entities.comps.pos[exitId]!;
    const pos = s.entities.comps.pos[me]!;
    pos.x = e.x;
    pos.y = e.y - px(T / 2);
    events.length = 0;
    tick();
    expect(interiorOf(s, me)).toBeNull();
    expect(events.filter((x) => x.type === 'roomChanged')).toHaveLength(1);
    // In again: stand on the stairs.
    const st = s.entities.comps.pos[stairsId]!;
    pos.x = st.x;
    pos.y = st.y - px(T / 2);
    events.length = 0;
    tick();
    expect(interiorOf(s, me)?.id).toBe('interior.inn_room');
    expect(events.filter((x) => x.type === 'roomChanged')).toHaveLength(1);
    // One entity for each piece, plus the two portals: nothing is made twice.
    tick();
    tick();
    const pieces = placedIn(s, room.id).length;
    const furn = Object.values(s.entities.comps.fixture).filter((f) =>
      f?.kind.startsWith('fixture.furn_'),
    );
    expect(furn).toHaveLength(pieces);
    expect(Object.keys(s.entities.comps.fixture).length).toBeGreaterThanOrEqual(fixturesBefore);
  });
});

describe('the placement rules', () => {
  const [door, front] = doorTiles(room);

  it('turning swaps the footprint', () => {
    const bed = PIECE_BY_ID.straw_bed!;
    expect(footprint(bed, 0)).toEqual({ w: 1, h: 2 });
    expect(footprint(bed, 1)).toEqual({ w: 2, h: 1 });
    expect(footprint(bed, 2)).toEqual({ w: 1, h: 2 });
  });

  it('a piece never covers the door tile or the tile in front of it', () => {
    for (const p of PIECES.filter((q) => q.layer !== 'wall'))
      for (let rot = 0; rot < 4; rot++) {
        for (let y = 0; y < room.h; y++)
          for (let x = 0; x < room.w; x++) {
            const f = footprint(p, rot);
            const covers = [door, front].some(
              (d) => d!.x >= x && d!.x < x + f.w && d!.y >= y && d!.y < y + f.h,
            );
            if (covers) expect(can(p.id, x, y, rot), `${p.id} ${x},${y} r${rot}`).not.toBeNull();
          }
      }
    expect(can('stool', door!.x, door!.y)).toBe('in the doorway');
    expect(can('stool', front!.x, front!.y)).toBe('in the doorway');
    expect(can('rug_red', door!.x, door!.y - 1)).toBe('in the doorway');
  });

  it('a piece never goes off the floor', () => {
    expect(can('stool', -1, 0)).toBe('off the floor');
    expect(can('stool', room.w, 0)).toBe('off the floor');
    expect(can('small_table', room.w - 1, 0)).toBe('off the floor');
    expect(can('straw_bed', 0, room.h - 1)).toBe('off the floor');
  });

  it('pieces never overlap, but a rug lies under a piece and a piece stands on a rug', () => {
    const stool = piece('stool', 0, 0);
    expect(can('stool', 0, 0, 0, [stool])).toBe('taken');
    expect(can('small_table', 0, 0, 0, [stool])).toBe('taken');
    expect(can('stool', 1, 0, 0, [stool])).toBeNull();
    const rug = piece('rug_red', 0, 0);
    expect(can('stool', 1, 1, 0, [rug])).toBeNull();
    expect(can('rug_blue', 1, 0, 0, [stool])).toBeNull();
    // But never rug on rug.
    expect(can('rug_blue', 1, 0, 0, [rug])).toBe('taken');
  });

  it('wall pieces go on the wall row only, one to a tile, and are never turned', () => {
    expect(can('mirror', 0, -1)).toBeNull();
    expect(can('clock', 3, -1)).toBeNull();
    expect(can('mirror', 0, 0)).toBe('wall pieces go on the wall');
    expect(can('mirror', 4, -1)).toBe('wall pieces go on the wall');
    expect(can('mirror', 0, -1, 1)).toBe('wall pieces are not turned');
    expect(can('clock', 0, -1, 0, [piece('mirror', 0, -1)])).toBe('taken');
    // A floor piece is not on the wall.
    expect(can('stool', 0, -1)).toBe('off the floor');
  });

  it('every piece fits somewhere in an empty room', () => {
    for (const p of PIECES) expect(firstSpot(room, p, []), p.id).not.toBeNull();
  });

  it('all twelve pieces stand in the room at once, each by the rules', () => {
    const placed: Placed[] = [];
    for (const [id, x, y, rot] of FULL_INN_LAYOUT) {
      expect(can(id, x, y, rot, placed), `${id} at ${x},${y}`).toBeNull();
      placed.push(piece(id, x, y, rot));
    }
    expect(new Set(FULL_INN_LAYOUT.map((p) => p[0])).size).toBe(12);
  });

  it('twelve pieces: the starter pair, and ten more, each an item that sits in the Bag other filter', () => {
    expect(PIECES).toHaveLength(12);
    expect(INTERIORS.length).toBeGreaterThan(0);
  });
});

describe('the commands', () => {
  it('place takes the piece from the bag, move and turn change it, store gives it back', () => {
    const { s, me, events, tick } = inRoom();
    give(s, me, 'item.furn_stool', 1, 'craft');
    const bag = s.entities.comps.inventory[me]!;
    const slot = bag.slots.findIndex((x) => x?.item === 'item.furn_stool');
    const before = placedIn(s, room.id).length;
    tick({ type: 'home', op: 'place', room: room.id, slot, x: 0, y: 2, rot: 0 });
    expect(placedIn(s, room.id)).toHaveLength(before + 1);
    expect(bag.slots.some((x) => x?.item === 'item.furn_stool')).toBe(false);
    const i = before;
    const o = placedIn(s, room.id)[i]!;
    const entity = o.e;
    expect(s.entities.comps.fixture[entity]).toBeDefined();
    tick({ type: 'home', op: 'move', room: room.id, i, x: 2, y: 2 });
    expect(placedIn(s, room.id)[i]).toMatchObject({ x: 2, y: 2 });
    tick({ type: 'home', op: 'store', room: room.id, i });
    expect(placedIn(s, room.id)).toHaveLength(before);
    expect(bag.slots.some((x) => x?.item === 'item.furn_stool')).toBe(true);
    expect(events.filter((e) => e.type === 'furnitureDenied')).toHaveLength(0);
  });

  it('turning the bed makes it lie across the floor, and a refused move changes nothing', () => {
    const { s, events, tick } = inRoom();
    const list = placedIn(s, room.id);
    const bed = list.findIndex((p) => p.piece === 'straw_bed');
    // Along the back wall it has no room to lie across, so it is moved to open floor first.
    tick({ type: 'home', op: 'move', room: room.id, i: bed, x: 0, y: 0 });
    tick({ type: 'home', op: 'rotate', room: room.id, i: bed });
    expect(list[bed]).toMatchObject({ x: 0, y: 0, rot: 1 });
    const at = { ...list[bed]! };
    events.length = 0;
    tick({ type: 'home', op: 'move', room: room.id, i: bed, x: 9, y: 9 });
    expect(list[bed]).toMatchObject({ x: at.x, y: at.y, rot: at.rot });
    expect(events.some((e) => e.type === 'furnitureDenied')).toBe(true);
  });

  it('nothing can be placed from outside the room', () => {
    const { s, me, tick } = inRoom();
    give(s, me, 'item.furn_stool', 1, 'craft');
    s.entities.comps.pos[me]!.x = px(10 * T);
    s.entities.comps.pos[me]!.y = px(10 * T);
    const slot = s.entities.comps.inventory[me]!.slots.findIndex(
      (x) => x?.item === 'item.furn_stool',
    );
    const before = placedIn(s, room.id).length;
    tick({ type: 'home', op: 'place', room: room.id, slot, x: 0, y: 2, rot: 0 });
    expect(placedIn(s, room.id)).toHaveLength(before);
  });

  it('a full bag refuses to take a stored piece, and the piece stays standing', () => {
    const { s, me, tick } = inRoom();
    const bag = s.entities.comps.inventory[me]!;
    bag.slots = bag.slots.map((_x, i) => ({ item: 'item.coin_junk_' + i, qty: 1 }) as never);
    const before = placedIn(s, room.id).length;
    homeCommand(s, me, { type: 'home', op: 'store', room: room.id, i: 0 });
    expect(placedIn(s, room.id)).toHaveLength(before);
    tick();
  });

  it('a piece cannot be placed in the doorway through the command either', () => {
    const { s, me, tick } = inRoom();
    give(s, me, 'item.furn_stool', 1, 'craft');
    const slot = s.entities.comps.inventory[me]!.slots.findIndex(
      (x) => x?.item === 'item.furn_stool',
    );
    const [door] = doorTiles(room);
    const before = placedIn(s, room.id).length;
    tick({ type: 'home', op: 'place', room: room.id, slot, x: door!.x, y: door!.y, rot: 0 });
    expect(placedIn(s, room.id)).toHaveLength(before);
  });
});

describe('what the pieces do', () => {
  it('the straw bed is a bed: it can be slept in', () => {
    const { s, me } = inRoom();
    expect(bedNear(s, me)).not.toBeNull();
  });

  it('a piece blocks the floor under it, and a rug does not', () => {
    const { s, tick } = inRoom();
    give(s, 1, 'item.furn_rug_red', 0, 'craft');
    const list = placedIn(s, room.id);
    list.push(piece('rug_red', 0, 2), piece('stool', 3, 3));
    tick();
    const bodyOf = (p: Placed): { solid: boolean } | null | undefined => s.entities.comps.body[p.e];
    expect(bodyOf(list.find((p) => p.piece === 'stool')!)?.solid).toBe(true);
    expect(bodyOf(list.find((p) => p.piece === 'rug_red')!)?.solid).toBeFalsy();
  });
});

describe('the layout and the save', () => {
  it('survives a reload: the same pieces in the same places, one entity each', () => {
    const { s, tick } = inRoom();
    placedIn(s, room.id).push(piece('stool', 0, 3), piece('mirror', 2, -1));
    tick();
    const text = serializeState(s);
    const back = deserializeState(text, OPEN);
    expect(back.home).toEqual(s.home);
    expect(serializeState(back)).toBe(text);
  });
});
