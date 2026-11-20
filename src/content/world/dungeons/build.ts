/**
 * Dungeon plumbing (POW-M4-11, lifted from the Rootway, POW-M4-21). A dungeon is authored as room
 * specs (a walled rectangle with extra walls and objects), edges between rooms and its own puzzle
 * fixtures. `defineDungeon` turns that into everything the game needs: the room graph the validator
 * reads, the portals and arrival markers for every edge and the way in from outside, the camera
 * rooms, and the stamps the region places. Rooms sit on a grid of 32 tile cells below the world.
 */
import type { FixtureDef, RoomDef } from '../fixtures';
import type { StampV2 } from '../../../sim/world/stamp';
import { Terrain, tilesetId } from '../tileset';
import type { DungeonDef, DungeonEdge, DungeonRoom } from './types';

/** Tiles in one grid cell. */
export const CELL = 32;

export interface RoomSpec {
  id: string;
  col: number;
  row: number;
  w: number;
  h: number;
  /** Extra wall tiles inside the room. */
  walls?: readonly (readonly [number, number])[];
  objects?: readonly { x: number; y: number; kind: string }[];
  extra?: Partial<DungeonRoom>;
  /** The floor and wall tiles. Caves by default. */
  floor?: number;
  wall?: string;
}

export interface DungeonSpec {
  /** `dungeon.<name>`. */
  id: string;
  /** Short fixture prefix, so each dungeon's portals are its own: `rw` gives `fixture.rw_e0a`. */
  prefix: string;
  /** Region tile of grid cell (0, 0). */
  origin: { x: number; y: number };
  rooms: readonly RoomSpec[];
  edges: readonly DungeonEdge[];
  /** The way in from outside: the region tile of the mouth, and the tile in the entrance room that leads out. */
  mouth: {
    at: { x: number; y: number };
    exit: { x: number; y: number };
    kind: string;
    exitKind: string;
  };
  def: Pick<DungeonDef, 'skills' | 'entrance' | 'boss' | 'region' | 'estMinutes'>;
  /** The rooms' own puzzle fixtures, doors, gates and chests. */
  parts?: readonly FixtureDef[];
}

const roomStamp = (id: string, s: RoomSpec): DungeonRoom => {
  const walls = new Set((s.walls ?? []).map(([x, y]) => `${x},${y}`));
  const rows = Array.from({ length: s.h }, (_r, y) =>
    Array.from({ length: s.w }, (_c, x) =>
      x === 0 || y === 0 || x === s.w - 1 || y === s.h - 1 || walls.has(`${x},${y}`) ? '#' : '.',
    ).join(''),
  );
  const floor = s.floor ?? Terrain.Cave;
  const stamp: StampV2 = {
    version: 2,
    id,
    legend: {
      '.': { ground: floor },
      '#': { ground: floor, object: tilesetId(s.wall ?? 'tile.cave_wall_top') },
    },
    layers: {
      ground: rows.map((r) => '.'.repeat(r.length)),
      object: rows.map((r) => [...r].map((c) => (c === '#' ? '#' : ' ')).join('')),
    },
    objects: s.objects ?? [],
  };
  return { id: s.id, stamp, ...s.extra };
};

export function defineDungeon(spec: DungeonSpec) {
  const specOf = (id: string): RoomSpec => {
    const s = spec.rooms.find((r) => r.id === id);
    if (!s) throw new Error(`${spec.id}: no room ${id}`);
    return s;
  };
  const stampId = (room: string): string => `${spec.id.replace(/^dungeon\./, '')}_${room}`;
  const kindOf = (n: number, side: 'a' | 'b'): string => `fixture.${spec.prefix}_e${n}${side}`;

  const roomOrigin = (id: string): { x: number; y: number } => {
    const s = specOf(id);
    return { x: spec.origin.x + s.col * CELL + 2, y: spec.origin.y + s.row * CELL + 2 };
  };
  const regionTile = (room: string, t: { x: number; y: number }): { x: number; y: number } => {
    const o = roomOrigin(room);
    return { x: o.x + t.x, y: o.y + t.y };
  };
  /** The way a portal at a room's ring faces: a step into the room, in px. */
  const inward = (room: string, t: { x: number; y: number }): [number, number] => {
    const s = specOf(room);
    if (t.y === 1) return [0, 22];
    if (t.y === s.h - 2) return [0, -22];
    if (t.x === 1) return [22, 0];
    if (t.x === s.w - 2) return [-22, 0];
    return [0, 22];
  };

  const def: DungeonDef = {
    id: spec.id,
    ...spec.def,
    rooms: spec.rooms.map((s) => roomStamp(stampId(s.id), s)),
    edges: spec.edges,
  };

  /** The portal fixture that takes the avatar from room `from` into room `to`. */
  const portal = (from: string, to: string): string => {
    const i = spec.edges.findIndex((e) => e.from === from && e.to === to);
    if (i < 0) throw new Error(`${spec.id}: no edge ${from} to ${to}`);
    return kindOf(i, 'a');
  };

  /** Portals and arrival markers for every edge, and the way in and out. Each carries `at`, its region tile. */
  const fixtures = (): FixtureDef[] => {
    const out: FixtureDef[] = [];
    spec.edges.forEach((e, i) => {
      const a = regionTile(e.from, e.at);
      const b = regionTile(e.to, e.arrive);
      const both = e.kind === 'open' || e.kind === 'locked';
      out.push({
        kind: kindOf(i, 'a'),
        type: 'portal',
        to: kindOf(i, 'b'),
        arrive: inward(e.to, e.arrive),
        at: a,
        ...(e.kind === 'oneWay' ? { fall: 10 } : {}),
      });
      out.push(
        both
          ? {
              kind: kindOf(i, 'b'),
              type: 'portal',
              to: kindOf(i, 'a'),
              arrive: inward(e.from, e.at),
              at: b,
            }
          : { kind: kindOf(i, 'b'), type: 'arrival', arrive: inward(e.to, e.arrive), at: b },
      );
    });
    const exit = regionTile(spec.def.entrance, spec.mouth.exit);
    out.push(
      {
        kind: spec.mouth.kind,
        type: 'portal',
        to: spec.mouth.exitKind,
        arrive: inward(spec.def.entrance, spec.mouth.exit),
        at: spec.mouth.at,
      },
      { kind: spec.mouth.exitKind, type: 'portal', to: spec.mouth.kind, arrive: [0, 24], at: exit },
    );
    return out;
  };

  /** The camera rooms, in region tiles. The dark and reset flags come from the room specs. */
  const rooms = (): RoomDef[] =>
    spec.rooms.map((s) => {
      const o = roomOrigin(s.id);
      return {
        id: `${spec.id}.${s.id}`,
        x0: o.x,
        y0: o.y,
        x1: o.x + s.w,
        y1: o.y + s.h,
        ...(s.extra?.dark ? { dark: true as const } : {}),
        ...(s.extra?.reset ? { reset: true as const } : {}),
      };
    });

  /** The room stamps, with each room's portals and markers added. */
  const stamps: StampV2[] = def.rooms.map((r) => {
    const mine: { x: number; y: number; kind: string }[] = [];
    spec.edges.forEach((e, i) => {
      if (e.from === r.id) mine.push({ ...e.at, kind: kindOf(i, 'a') });
      if (e.to === r.id) mine.push({ ...e.arrive, kind: kindOf(i, 'b') });
    });
    if (r.id === spec.def.entrance) mine.push({ ...spec.mouth.exit, kind: spec.mouth.exitKind });
    return { ...r.stamp, objects: [...(r.stamp.objects ?? []), ...mine] };
  });

  /** Where each room stamp goes, for the region spec. */
  const placements = (): { kind: string; stamp: string; x: number; y: number }[] =>
    def.rooms.map((r) => ({
      kind: stampId(r.id),
      stamp: stampId(r.id),
      ...roomOrigin(r.id),
    }));

  return {
    spec,
    def,
    roomOrigin,
    regionTile,
    portal,
    fixtures,
    parts: (): FixtureDef[] => [...(spec.parts ?? [])],
    rooms,
    stamps,
    placements,
    roomId: (room: string): string => `${spec.id}.${room}`,
  };
}
