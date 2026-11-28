import { STARTER_PIECES } from '../content/furniture/pieces';

/**
 * The saved shape of the player's rooms (POW-M6-07). Kept apart from `home.ts` so the state module
 * can build and load it without pulling in the rules.
 */

/** One piece standing in a room. Saved. */
export interface Placed {
  /** The piece id (`straw_bed`). */
  piece: string;
  /** Top left of its footprint on the room's floor grid. A wall piece has y -1. */
  x: number;
  y: number;
  /** Quarter turns, 0 to 3. Wall pieces and rugs of a square footprint are never turned. */
  rot: number;
  /** The fixture entity that stands for it. 0 until the first tick has made it. */
  e: number;
}

/** Every room the player has furnished, by interior id. Saved. */
export interface HomeState {
  rooms: Record<string, Placed[]>;
}

/** The inn room as it begins: the straw bed along the back wall and the small chest by it. */
export function innStart(): Placed[] {
  const at: Record<string, [number, number]> = { straw_bed: [3, 0], small_chest: [2, 0] };
  return STARTER_PIECES.map((piece) => ({
    piece,
    x: (at[piece] as [number, number])[0],
    y: (at[piece] as [number, number])[1],
    rot: 0,
    e: 0,
  }));
}

export function newHome(): HomeState {
  return { rooms: { 'interior.inn_room': innStart() } };
}

/** A loaded home, or a new one if the save has none. Pieces the player stored stay stored. */
export function normalHome(raw: HomeState | undefined): HomeState {
  if (!raw || typeof raw.rooms !== 'object' || raw.rooms === null) return newHome();
  const rooms: Record<string, Placed[]> = {};
  for (const [id, list] of Object.entries(raw.rooms))
    rooms[id] = Array.isArray(list)
      ? list.map((p) => ({ ...p, e: p.e ?? 0, rot: p.rot ?? 0 }))
      : [];
  return { rooms };
}
