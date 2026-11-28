/**
 * Interiors (POW-M6-07): a building's inside, as one small walled room in the rock under the sea,
 * like a dungeon room and built with the same plumbing (`defineDungeon`), but with no dungeon in it:
 * no boss, no pacing line, no validator graph. The room is a camera room, so the view snaps to it,
 * and its door is a pair of portals (POW-M5-20 doorways). Furniture is placed on its floor grid
 * (`sim/home.ts`, `content/furniture`).
 *
 * The baked `interiors` list of a region spec has no runtime loader, and twelve dungeons already
 * run on rooms in the rock, so interiors reuse that path.
 */
import { Terrain } from './tileset';
import { defineDungeon } from './dungeons/build';
import type { RoomDef } from './fixtures';

/** Region tile of grid cell (0, 0) for interiors: chunk column 11, row 15, free of the dungeons. */
export const INTERIOR_ORIGIN = { x: 11 * 32, y: 15 * 32 } as const;
/** Tiles in one interior cell. A room, its walls included, fits one. */
export const INTERIOR_CELL = 16;

export interface InteriorSpec {
  /** `interior.inn_room`. */
  id: string;
  /** Short fixture prefix. */
  prefix: string;
  /** Floor tiles across and down, walls not counted. */
  w: number;
  h: number;
  /** Grid cell (col, row) in the interior block. */
  col: number;
  row: number;
  /** The floor tile, in floor coordinates (0 to w-1), that leads out. It must be on the bottom row. */
  door: { x: number };
  /** The region tile of the door outside, and the fixture kinds of the two ends. */
  outside: { x: number; y: number };
  kinds: { out: string; in: string };
  floor?: number;
  wall?: string;
}

/** The camera room and the way in and out of an interior, from its spec. */
export function defineInterior(spec: InteriorSpec) {
  if (spec.door.x < 0 || spec.door.x >= spec.w) throw new Error(`${spec.id}: door off the floor`);
  const built = defineDungeon({
    id: `dungeon.${spec.prefix}`,
    prefix: spec.prefix,
    origin: INTERIOR_ORIGIN,
    cell: INTERIOR_CELL,
    rooms: [
      {
        id: 'room',
        col: spec.col,
        row: spec.row,
        w: spec.w + 2,
        h: spec.h + 2,
        floor: spec.floor ?? Terrain.Planks,
        wall: spec.wall ?? 'tile.wall_timber',
      },
    ],
    edges: [],
    mouth: {
      at: spec.outside,
      // In room coordinates the floor starts at (1, 1): the bottom floor row is h.
      exit: { x: spec.door.x + 1, y: spec.h },
      kind: spec.kinds.out,
      exitKind: spec.kinds.in,
    },
    def: { skills: [], entrance: 'room', region: 'dawnmeadow' },
  });
  const origin = built.roomOrigin('room');
  return {
    ...spec,
    /** The region tile of the floor's top left. */
    floorOrigin: { x: origin.x + 1, y: origin.y + 1 },
    fixtures: built.fixtures,
    stamps: built.stamps,
    placements: built.placements,
    outside: built.outside,
    rooms: (): RoomDef[] => built.rooms(),
    roomId: built.roomId('room'),
  };
}

export type Interior = ReturnType<typeof defineInterior>;

/** The inn room (design/13 section 1): upstairs at the inn, a 4 by 4 floor. */
export const INN_ROOM = defineInterior({
  id: 'interior.inn_room',
  prefix: 'innroom',
  w: 4,
  h: 4,
  col: 0,
  row: 0,
  door: { x: 1 },
  // Hearthford's origin is (164, 164): the stair arch stands east of the inn yard at (19, 50).
  outside: { x: 183, y: 214 },
  kinds: { out: 'fixture.innroom_stairs', in: 'fixture.innroom_exit' },
});

/** Every interior. */
export const INTERIORS: readonly Interior[] = [INN_ROOM];
