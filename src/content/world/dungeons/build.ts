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

/** A second way between a room and the open world (a back door). Both ends are portals. */
export interface DoorSpec {
  room: string;
  /** The tile in the room that leads out. */
  tile: { x: number; y: number };
  /** The region tile of the portal outside, and the fixture kinds of the two ends. */
  at: { x: number; y: number };
  kind: string;
  outKind: string;
  /** The in-room portal stays behind a slab until a creature of this kind falls (a way out that a boss guards). */
  unlockedBy?: string;
}

export interface DungeonSpec {
  /** `dungeon.<name>`. */
  id: string;
  /** Short fixture prefix, so each dungeon's portals are its own: `rw` gives `fixture.rw_e0a`. */
  prefix: string;
  /** Region tile of grid cell (0, 0). */
  origin: { x: number; y: number };
  /** Tiles in a grid cell. 32 by default; small rooms use 16 and pack four to a chunk. */
  cell?: number;
  rooms: readonly RoomSpec[];
  edges: readonly DungeonEdge[];
  /** The way in from outside: the region tile of the mouth, and the tile in the entrance room that leads out. */
  mouth: {
    at: { x: number; y: number };
    exit: { x: number; y: number };
    kind: string;
    exitKind: string;
  };
  def: Pick<DungeonDef, 'skills' | 'entrance' | 'boss' | 'region' | 'estMinutes' | 'mini'>;
  /** Back doors to the open world, besides the mouth. */
  doors?: readonly DoorSpec[];
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

/**
 * Draws a doorway at each of a room's portals, so a way on reads as a way on (G4 playtest: every
 * exit looked like a secret). A portal on the ring by a wall gets an arch cut into that wall,
 * facing into the room. A portal out in the room gets the arch on its own tile.
 */
export function withDoorways(
  stamp: StampV2,
  s: Pick<RoomSpec, 'w' | 'h' | 'floor'>,
  tiles: readonly { x: number; y: number }[],
): StampV2 {
  const object = (stamp.layers.object ?? []).map((row) => [...row]);
  const wallAt = (x: number, y: number): boolean => object[y]?.[x] === '#';
  for (const t of tiles) {
    const behind =
      t.y === 1
        ? { x: t.x, y: 0 }
        : t.y === s.h - 2
          ? { x: t.x, y: s.h - 1 }
          : t.x === 1
            ? { x: 0, y: t.y }
            : t.x === s.w - 2
              ? { x: s.w - 1, y: t.y }
              : null;
    const at = behind && wallAt(behind.x, behind.y) ? behind : t;
    object[at.y]![at.x] = DOORWAY;
  }
  return {
    ...stamp,
    legend: {
      ...stamp.legend,
      [DOORWAY]: { ground: s.floor ?? Terrain.Cave, object: tilesetId('tile.cave_arch') },
    },
    layers: { ...stamp.layers, object: object.map((r) => r.join('')) },
  };
}

/** The legend character of a doorway arch in a room stamp. */
const DOORWAY = 'A';

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
    const c = spec.cell ?? CELL;
    return { x: spec.origin.x + s.col * c + 2, y: spec.origin.y + s.row * c + 2 };
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
        // `arrive` is where someone coming TO this portal stands: out of the dungeon, below the mouth.
        arrive: [0, 24],
        at: spec.mouth.at,
      },
      {
        kind: spec.mouth.exitKind,
        type: 'portal',
        to: spec.mouth.kind,
        arrive: inward(spec.def.entrance, spec.mouth.exit),
        at: exit,
      },
    );
    for (const d of spec.doors ?? []) {
      out.push(
        {
          kind: d.kind,
          type: 'portal',
          to: d.outKind,
          arrive: [0, 24],
          at: regionTile(d.room, d.tile),
          ...(d.unlockedBy
            ? { unlockedBy: d.unlockedBy, sprite: 'tile.cave_wall_face', size: 16 }
            : {}),
        },
        { kind: d.outKind, type: 'portal', to: d.kind, arrive: inward(d.room, d.tile), at: d.at },
      );
    }
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
    for (const d of spec.doors ?? []) if (d.room === r.id) mine.push({ ...d.tile, kind: d.kind });
    return withDoorways(
      { ...r.stamp, objects: [...(r.stamp.objects ?? []), ...mine] },
      specOf(r.id),
      doorwaysOf(r.id),
    );
  });

  /**
   * The portal tiles of a room a person can walk through from inside it (G4 playtest): every edge
   * that leaves it, the far end of a two way edge, the way out, and back doors not behind a slab.
   * The landing end of a drop or a shortcut is not one: those work one way only.
   */
  function doorwaysOf(room: string): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (const e of spec.edges) {
      if (e.from === room) out.push(e.at);
      if (e.to === room && (e.kind === 'open' || e.kind === 'locked')) out.push(e.arrive);
    }
    if (room === spec.def.entrance) out.push(spec.mouth.exit);
    for (const d of spec.doors ?? []) if (d.room === room && !d.unlockedBy) out.push(d.tile);
    return out;
  }

  /** Where each room stamp goes, for the region spec. */
  const placements = (): { kind: string; stamp: string; x: number; y: number }[] =>
    def.rooms.map((r) => ({
      kind: stampId(r.id),
      stamp: stampId(r.id),
      ...roomOrigin(r.id),
    }));

  /** Objects the region spec places in the open world: the mouth portal and the back doors' outer ends. */
  const outside = (): { kind: string; x: number; y: number }[] => [
    { kind: spec.mouth.kind, ...spec.mouth.at },
    ...(spec.doors ?? []).map((d) => ({ kind: d.outKind, ...d.at })),
  ];

  return {
    spec,
    def,
    outside,
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
