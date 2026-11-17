import type { RoomDef } from './fixtures';

/**
 * Where things are in the slice world, in tiles. The outdoor area is chunks 0..2 on both axes
 * (96 x 96 tiles). The cave sits below it in chunk rows 3 and 4, on a grid of 32 tile cells, one
 * room per cell, so rooms never touch and nothing notices a creature through a wall.
 */
export const OUTDOORS: RoomDef = {
  id: 'room.outdoors',
  x0: 0,
  y0: 0,
  x1: 96,
  y1: 96,
  outdoors: true,
};

/** Cave rooms, walls included. The camera snaps to the one the avatar is in. */
export const CAVE_ROOMS: readonly RoomDef[] = [
  { id: 'room.a', x0: 3, y0: 99, x1: 21, y1: 113 },
  { id: 'room.b', x0: 34, y0: 98, x1: 56, y1: 118 },
  { id: 'room.c', x0: 68, y0: 98, x1: 88, y1: 118 },
  { id: 'room.d', x0: 36, y0: 130, x1: 54, y1: 144 },
  { id: 'room.e', x0: 66, y0: 128, x1: 90, y1: 150 },
];

export const ROOMS: readonly RoomDef[] = [OUTDOORS, ...CAVE_ROOMS];

/** The room containing a tile, or null in the rock between rooms. */
export function roomAt(tx: number, ty: number): RoomDef | null {
  for (const r of ROOMS) if (tx >= r.x0 && tx < r.x1 && ty >= r.y0 && ty < r.y1) return r;
  return null;
}
