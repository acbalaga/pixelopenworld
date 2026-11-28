import { furnKind } from '../content/furniture/fixtures';
import { PIECE_BY_ID, PIECE_BY_ITEM, type PieceDef } from '../content/furniture/pieces';
import { FIXTURES } from '../content/world/fixtures';
import { INTERIORS, type Interior } from '../content/world/interiors';
import { roomAt } from '../content/world/rooms';
import { destroy, getComp, query, setComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import type { Command } from './kernel/commands';
import { px } from './kernel/fixed';
import { addItem, canHold, removeItem } from './items';
import { spawnFixture } from './systems/fixtures';
import type { Placed } from './homeState';
import type { SimState } from './state';

/**
 * The player's rooms (POW-M6-07, design/13 section 6). Pieces stand on an interior's floor grid
 * and are fixture entities made from the saved list, so the world draws, blocks and uses them like
 * any fixture. The rules are here and pure; nothing reads the clock or a random number.
 */

const TILE = 16;

export const INTERIOR_BY_ID: Readonly<Record<string, Interior>> = Object.fromEntries(
  INTERIORS.map((i) => [i.id, i]),
);

/** Tiles across and down after `rot` quarter turns. */
export function footprint(p: PieceDef, rot: number): { w: number; h: number } {
  return rot % 2 === 0 ? { w: p.w, h: p.h } : { w: p.h, h: p.w };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The door tile of an interior, on the floor grid, and the tile in front of it. */
export function doorTiles(room: Interior): [Rect, Rect] {
  const x = room.door.x;
  return [
    { x, y: room.h - 1, w: 1, h: 1 },
    { x, y: room.h - 2, w: 1, h: 1 },
  ];
}

/**
 * Why a piece cannot stand at (x, y) turned `rot`, or null if it can. `others` are the pieces
 * already there, without the one being moved. Rules (design/13 section 6): inside the floor, never
 * on the door tile or the tile in front of it, no overlap, rugs go under pieces but not under other
 * rugs, wall pieces only on the wall row.
 */
export function whyNot(
  room: Interior,
  p: PieceDef,
  x: number,
  y: number,
  rot: number,
  others: readonly Placed[],
): string | null {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(rot) || rot < 0 || rot > 3)
    return 'bad spot';
  const f = footprint(p, rot);
  const r: Rect = { x, y, w: f.w, h: f.h };
  if (p.layer === 'wall') {
    if (rot !== 0) return 'wall pieces are not turned';
    if (y !== -1 || x < 0 || x + f.w > room.w) return 'wall pieces go on the wall';
    return others.some((o) => {
      const q = PIECE_BY_ID[o.piece];
      return q?.layer === 'wall' && overlap(r, { x: o.x, y: o.y, ...footprint(q, o.rot) });
    })
      ? 'taken'
      : null;
  }
  if (x < 0 || y < 0 || x + f.w > room.w || y + f.h > room.h) return 'off the floor';
  if (doorTiles(room).some((d) => overlap(r, d))) return 'in the doorway';
  for (const o of others) {
    const q = PIECE_BY_ID[o.piece];
    if (!q || q.layer === 'wall') continue;
    if (!overlap(r, { x: o.x, y: o.y, ...footprint(q, o.rot) })) continue;
    // A rug lies under anything that is not a rug, and anything stands on a rug.
    if ((p.layer === 'rug') !== (q.layer === 'rug')) continue;
    return 'taken';
  }
  return null;
}

/** The first spot, scanning the floor, where the piece fits at rotation 0, or null. */
export function firstSpot(
  room: Interior,
  p: PieceDef,
  others: readonly Placed[],
): { x: number; y: number } | null {
  const ys = p.layer === 'wall' ? [-1] : Array.from({ length: room.h }, (_v, i) => i);
  for (const y of ys)
    for (let x = 0; x < room.w; x++) if (whyNot(room, p, x, y, 0, others) === null) return { x, y };
  return null;
}

/** The pieces standing in a room. */
export function placedIn(state: SimState, room: string): Placed[] {
  return (state.home.rooms[room] ??= []);
}

/** The room the avatar is standing in, if it is an interior of the player's. */
export function interiorOf(state: SimState, who: EntityId): Interior | null {
  const p = getComp(state.entities, who, 'pos');
  if (!p) return null;
  const tx = Math.floor(p.x / 256 / TILE);
  const ty = Math.floor((p.y / 256 - 1) / TILE);
  const room = roomAt(tx, ty, state.region ?? 'slice');
  return INTERIORS.find((i) => i.roomId === room?.id) ?? null;
}

/** Tile of a placed piece on the region map: the top left of its footprint. */
function tileOf(room: Interior, o: Placed): { x: number; y: number } {
  return { x: room.floorOrigin.x + o.x, y: room.floorOrigin.y + o.y };
}

/** Makes the entity of one placed piece, standing where the list says. */
function spawnPiece(state: SimState, room: Interior, o: Placed): void {
  const p = PIECE_BY_ID[o.piece];
  if (!p) return;
  const f = footprint(p, o.rot);
  const kind = furnKind(p.id, o.rot % 2 === 1 && p.w !== p.h);
  if (!FIXTURES[kind]) return;
  const t = tileOf(room, o);
  const id = spawnFixture(state, kind, t.x, t.y);
  // The fixture was made for one tile; stand it at the foot of the whole footprint.
  setComp(state.entities, id, 'pos', {
    x: px((t.x + f.w / 2) * TILE),
    y: px((t.y + f.h) * TILE),
  });
  const home = getComp(state.entities, id, 'fixture');
  const pos = getComp(state.entities, id, 'pos');
  if (home && pos) home.home = { ...pos };
  const body = getComp(state.entities, id, 'body');
  if (body) {
    body.w = px(f.w * TILE - 2);
    body.h = px(f.h * TILE - 2);
  }
  o.e = id;
}

function dropPiece(state: SimState, o: Placed): void {
  if (o.e) destroy(state.entities, o.e);
  o.e = 0;
}

/**
 * Keeps one entity for each placed piece of the room the avatar is in. A piece whose entity is gone
 * (a new save, a migration, a chunk that left the window) gets one. Runs every tick; the lists are
 * a few dozen entries at most.
 */
export function homeSystem(state: SimState): void {
  // Only the room the avatar is in is made: the chunk of any other is not streamed in, and the
  // stream removes the entities of a chunk that leaves the window.
  for (const who of query(state.entities, 'avatar', 'pos')) {
    const room = interiorOf(state, who);
    if (!room) continue;
    for (const o of placedIn(state, room.id)) {
      const live = o.e ? getComp(state.entities, o.e, 'fixture') : null;
      if (!live) spawnPiece(state, room, o);
    }
  }
}

/** True when `who` stands in the room. Pieces are only handled from inside it. */
function inside(state: SimState, who: EntityId, room: Interior): boolean {
  return interiorOf(state, who)?.id === room.id;
}

function deny(state: SimState, who: EntityId, reason: string): void {
  emit(state.events, { type: 'furnitureDenied', id: who, reason });
}

/** The Home commands: place from the bag, move, turn and store. */
export function homeCommand(
  state: SimState,
  who: EntityId,
  c: Extract<Command, { type: 'home' }>,
): void {
  const room = INTERIOR_BY_ID[c.room];
  const inv = getComp(state.entities, who, 'inventory');
  if (!room || !inv || !inside(state, who, room)) return deny(state, who, 'not here');
  const list = placedIn(state, room.id);
  if (c.op === 'place') {
    const stack = inv.slots[c.slot ?? -1];
    const p = stack ? PIECE_BY_ITEM[stack.item] : undefined;
    if (!stack || !p) return deny(state, who, 'not a piece');
    const why = whyNot(room, p, c.x ?? 0, c.y ?? 0, c.rot ?? 0, list);
    if (why) return deny(state, who, why);
    removeItem(inv, stack.item, 1);
    const o: Placed = { piece: p.id, x: c.x ?? 0, y: c.y ?? 0, rot: c.rot ?? 0, e: 0 };
    list.push(o);
    spawnPiece(state, room, o);
    emit(state.events, { type: 'furniturePlaced', id: who, piece: p.id });
    return;
  }
  const o = list[c.i ?? -1];
  const p = o ? PIECE_BY_ID[o.piece] : undefined;
  if (!o || !p) return deny(state, who, 'no such piece');
  const rest = list.filter((q) => q !== o);
  if (c.op === 'store') {
    if (!canHold(inv, p.item, 1)) return deny(state, who, 'bag full');
    dropPiece(state, o);
    list.splice(list.indexOf(o), 1);
    addItem(inv, p.item, 1);
    emit(state.events, { type: 'furnitureStored', id: who, piece: p.id });
    return;
  }
  const rot = c.op === 'rotate' ? (p.layer === 'wall' ? 0 : (o.rot + 1) % 4) : (c.rot ?? o.rot);
  const x = c.op === 'rotate' ? o.x : (c.x ?? o.x);
  const y = c.op === 'rotate' ? o.y : (c.y ?? o.y);
  if (c.op === 'rotate' && p.layer === 'wall')
    return deny(state, who, 'wall pieces are not turned');
  const why = whyNot(room, p, x, y, rot, rest);
  if (why) return deny(state, who, why);
  dropPiece(state, o);
  o.x = x;
  o.y = y;
  o.rot = rot;
  spawnPiece(state, room, o);
  emit(state.events, { type: 'furnitureMoved', id: who, piece: p.id });
}
