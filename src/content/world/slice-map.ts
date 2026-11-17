import { rng } from '../sprites/gen/img';
import type { Stamp, StampCell } from '../../sim/world/stamp';
import { CAVE_ROOMS, OUTDOORS } from './rooms';
import { Terrain, tilesetId } from './tileset';

/*
 * The slice map: Hearthford outskirts (96 x 96 tiles, chunks 0..2) with the cave below it
 * (chunk rows 3 and 4). Built the way design/02 describes: ASCII stamps for what the player looks
 * at closely (the puzzle room), seeded fill rules for the rest (trees, flowers, roads, water).
 * Same code, same map, same baked bytes.
 */

const W = 96;
const H = 160;

const cell = (ground: number, extra: Partial<StampCell> = {}): StampCell => ({ ground, ...extra });
const G = Terrain.Grass;
const obj = (id: string, ground: number = G): StampCell => cell(ground, { object: tilesetId(id) });
const tree = (trunk: string, canopy: string): StampCell =>
  cell(G, { object: tilesetId(trunk), overhead: tilesetId(canopy) });

const TREES: readonly StampCell[] = (
  [
    ['oak', 0],
    ['oak', 1],
    ['pine', 0],
    ['pine', 1],
    ['birch', 0],
  ] as const
).map(([s, v]) => tree(`tile.tree_${s}_${v}_trunk`, `tile.tree_${s}_${v}_canopy`));
const BUSHES = ['tile.bush_green_0', 'tile.bush_berry_0', 'tile.bush_dry_0'] as const;
const FLOWERS = [
  'tile.flower_white_0',
  'tile.flower_rose_0',
  'tile.flower_ochre_0',
  'tile.flower_violet_0',
] as const;

/** A mutable grid of cells that the stamp is built from. */
class Grid {
  readonly cells: StampCell[][];
  /** Tiles that fill rules must leave alone: roads, the square, buildings. */
  readonly keep: boolean[][];
  constructor() {
    this.cells = Array.from({ length: H }, () => Array.from({ length: W }, () => cell(G)));
    this.keep = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  }
  set(x: number, y: number, c: StampCell, keep = true): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    (this.cells[y] as StampCell[])[x] = c;
    if (keep) (this.keep[y] as boolean[])[x] = true;
  }
  get(x: number, y: number): StampCell {
    return (this.cells[y] as StampCell[])[x] as StampCell;
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: StampCell, keep = true): void {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(x, y, c, keep);
  }
  isKept(x: number, y: number): boolean {
    return (this.keep[y] as boolean[] | undefined)?.[x] ?? true;
  }
}

/** A thick line of one terrain along a polyline. */
function stroke(
  g: Grid,
  pts: readonly (readonly [number, number])[],
  width: number,
  c: StampCell,
  keep = true,
): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i] as readonly [number, number];
    const [bx, by] = pts[i + 1] as readonly [number, number];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let k = 0; k <= n; k++) {
      const x = Math.round(ax + ((bx - ax) * k) / n);
      const y = Math.round(ay + ((by - ay) * k) / n);
      g.rect(
        x - Math.floor(width / 2),
        y - Math.floor(width / 2),
        x - Math.floor(width / 2) + width,
        y - Math.floor(width / 2) + width,
        c,
        keep,
      );
    }
  }
}

type Obj = { x: number; y: number; kind: string };
const object = (_g: Grid, x: number, y: number, kind: string, out: Obj[]): void => {
  out.push({ x, y, kind });
};

/** A 5 wide, 3 tall building whose bottom wall row is on `y + 2`. `front` is the wall tile at the middle. */
function building(
  g: Grid,
  x: number,
  y: number,
  w: number,
  color: 'red' | 'slate',
  mid: string,
): void {
  for (let i = 0; i < w; i++) {
    const col = i === 0 ? 'l' : i === w - 1 ? 'r' : 'm';
    g.set(x + i, y, obj(`tile.roof_${color}_0${col}`));
    g.set(x + i, y + 1, obj(`tile.roof_${color}_1${col}`));
    const wallTile =
      i === Math.floor(w / 2) ? mid : i % 2 === 0 ? 'tile.wall_window' : 'tile.wall_plaster';
    g.set(x + i, y + 2, obj(wallTile));
  }
}

function outdoors(g: Grid, objects: Obj[]): void {
  const r = rng(9001);
  // Ground: a stream east to west with a bridge, a dirt road out of the square, paved square.
  stroke(
    g,
    [
      [47, 47],
      [47, 64],
      [56, 70],
      [70, 74],
      [81, 78],
    ],
    2,
    cell(Terrain.Dirt),
  );
  stroke(
    g,
    [
      [0, 52],
      [30, 55],
      [60, 60],
      [95, 57],
    ],
    4,
    cell(Terrain.Water),
  );
  // Bridge where the road crosses the stream. Boards run along the road.
  for (let y = 50; y < 64; y++)
    for (let x = 46; x < 49; x++)
      if (g.get(x, y).ground === Terrain.Water) g.set(x, y, cell(Terrain.Planks));
  g.rect(34, 29, 60, 48, cell(Terrain.Cobble));
  // Square gap to the south for the road, and a dirt apron.
  g.rect(46, 47, 49, 50, cell(Terrain.Dirt));
  // Buildings along the north edge: a shop with an awning, and a house.
  building(g, 37, 26, 6, 'red', 'tile.wall_shop');
  building(g, 51, 26, 6, 'slate', 'tile.wall_door');
  // Fences close the sides and the south edge of the square, leaving gaps for roads.
  for (let y = 31; y < 47; y++) {
    g.set(34, y, obj('tile.fence_v', Terrain.Cobble));
    g.set(59, y, obj('tile.fence_v', Terrain.Cobble));
  }
  for (let x = 34; x < 60; x++)
    if (x < 45 || x > 49) g.set(x, 47, obj('tile.fence_h', Terrain.Cobble));
  for (const [x, y] of [
    [34, 47],
    [59, 47],
    [34, 30],
    [59, 30],
    [45, 47],
    [49, 47],
  ] as const)
    g.set(x, y, obj('tile.fence_post', Terrain.Cobble));
  // Square dressing: request board, crates, barrels, a sign where the road leaves.
  g.set(45, 30, obj('tile.board', Terrain.Cobble));
  g.set(36, 30, obj('tile.crate', Terrain.Cobble));
  g.set(35, 30, obj('tile.barrel', Terrain.Cobble));
  g.set(58, 30, obj('tile.barrel', Terrain.Cobble));
  g.set(43, 46, obj('tile.sign_post', Terrain.Cobble));
  // Cave mouth: a rock face with an arch, at the end of the road.
  g.rect(76, 74, 87, 79, obj('tile.cave_wall_top', Terrain.Cave));
  for (let x = 76; x < 87; x++)
    g.set(x, 78, obj(x === 78 || x === 84 ? 'tile.torch' : 'tile.cave_wall_face', Terrain.Cave));
  g.rect(76, 79, 87, 80, cell(Terrain.Cave));
  g.rect(76, 79, 87, 80, cell(Terrain.Dirt));
  g.set(81, 78, obj('tile.cave_arch', Terrain.Cave));
  g.rect(79, 79, 84, 83, cell(Terrain.Dirt));
  // Fill rules: trees thicken toward the edges and south, flowers and bushes in the meadow.
  for (let y = 0; y < OUTDOORS.y1; y++) {
    for (let x = 0; x < OUTDOORS.x1; x++) {
      if (g.isKept(x, y) || g.get(x, y).ground !== G) continue;
      const edge = Math.min(x, y, 95 - x, 95 - y);
      const nearSquare = x > 28 && x < 66 && y > 22 && y < 52;
      const forest = edge < 7 || (y > 62 && !(x > 74 && y < 84)) || x > 86;
      const p = forest ? 0.34 : nearSquare ? 0.012 : 0.05;
      const roll = r();
      if (roll < p) g.set(x, y, TREES[Math.floor(r() * TREES.length)] as StampCell, false);
      else if (roll < p + 0.025)
        g.set(x, y, obj(BUSHES[Math.floor(r() * BUSHES.length)] as string), false);
      else if (roll < p + 0.1) {
        g.set(
          x,
          y,
          cell(G, { detail: tilesetId(FLOWERS[Math.floor(r() * FLOWERS.length)] as string) }),
          false,
        );
      }
    }
  }
  // Clear a pocket around gathering and spawn spots so nothing grows on them.
  const clear = (cx: number, cy: number, rad: number): void => {
    for (let y = cy - rad; y <= cy + rad; y++)
      for (let x = cx - rad; x <= cx + rad; x++)
        if (g.get(x, y).ground === G) g.set(x, y, cell(G), false);
  };
  for (const [cx, cy, rad] of [
    [30, 44, 3],
    [66, 40, 3],
    [60, 50, 2],
    [26, 40, 3],
    [50, 70, 3],
    [66, 72, 2],
    [62, 74, 2],
    [20, 40, 2],
  ] as const)
    clear(cx, cy, rad);
  // Objects.
  object(g, 48, 40, 'spawn.player', objects);
  object(g, 47, 37, 'fixture.waystone', objects);
  object(g, 42, 40, 'prop.camp_pot', objects);
  object(g, 81, 78, 'fixture.portal_cave_mouth', objects);
  for (const [x, y] of [
    [24, 40],
    [27, 43],
    [22, 45],
  ] as const)
    object(g, x, y, 'node.herb_patch', objects);
  for (const [x, y] of [
    [20, 38],
    [29, 38],
  ] as const)
    object(g, x, y, 'node.berry_bush', objects);
  // Spawners ramp up from the square: gentle Mosslings first, then a shooter, boars past the stream.
  object(g, 53, 38, 'spawner.training_dummy', objects);
  object(g, 30, 44, 'spawner.mossling', objects);
  object(g, 66, 40, 'spawner.mossling', objects);
  object(g, 60, 50, 'spawner.spitbloom', objects);
  object(g, 50, 70, 'spawner.bramble_boar', objects);
  object(g, 66, 72, 'spawner.bramble_boar', objects);
  object(g, 62, 74, 'spawner.spitbloom', objects);
}

const FLOOR = (): StampCell => cell(Terrain.Cave);
const WALL_TOP = obj('tile.cave_wall_top', Terrain.Cave);
const WALL_FACE = obj('tile.cave_wall_face', Terrain.Cave);
const TORCH = obj('tile.torch', Terrain.Cave);
const ARCH = obj('tile.cave_arch', Terrain.Cave);

/** The puzzle room, authored as ASCII. # wall, . floor, g gate, p plate, b block home, c chest, P portal. */
const ROOM_C: readonly string[] = [
  '####################',
  '#............#.....#',
  '#............#.c...#',
  '#............#.....#',
  '#............##g####',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..........#.......#',
  '#..........#.......#',
  '#..................#',
  '#.....b............#',
  '#..................#',
  '#....##............#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '####P###############',
];

function cave(g: Grid, objects: Obj[]): void {
  // Everything below the outdoor area is rock until a room is carved.
  g.rect(0, 96, W, H, WALL_TOP);
  const carve = (id: string, f: (x: number, y: number) => void): void => {
    const room = CAVE_ROOMS.find((r) => r.id === id);
    if (!room) throw new Error(`no room ${id}`);
    for (let y = room.y0 + 1; y < room.y1 - 1; y++)
      for (let x = room.x0 + 1; x < room.x1 - 1; x++) g.set(x, y, FLOOR());
    f(room.x0, room.y0);
  };
  const portal = (x: number, y: number, kind: string): void => {
    g.set(x, y, ARCH);
    object(g, x, y, kind, objects);
  };
  const fixture = (x: number, y: number, kind: string): void => object(g, x, y, kind, objects);

  carve('room.a', (x0, y0) => {
    portal(x0 + 9, y0, 'fixture.portal_a_entry');
    portal(x0 + 17, y0 + 7, 'fixture.portal_a_east');
    g.set(x0 + 9, y0 + 13, ARCH);
    fixture(x0 + 9, y0 + 13, 'fixture.arrival_a_shortcut');
    object(g, x0 + 5, y0 + 6, 'spawner.mossling', objects);
  });
  carve('room.b', (x0, y0) => {
    portal(x0, y0 + 10, 'fixture.portal_b_west');
    portal(x0 + 11, y0, 'fixture.portal_b_north');
    portal(x0 + 11, y0 + 19, 'fixture.portal_b_south');
    portal(x0 + 21, y0 + 10, 'fixture.portal_b_east');
    fixture(x0 + 20, y0 + 10, 'fixture.door_boss');
    object(g, x0 + 10, y0 + 10, 'spawner.bramble_boar', objects);
  });
  // The puzzle room from its stamp.
  const c = CAVE_ROOMS.find((r) => r.id === 'room.c');
  if (!c) throw new Error('no room.c');
  ROOM_C.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      const x = c.x0 + rx;
      const y = c.y0 + ry;
      if (ch === '#') return g.set(x, y, WALL_TOP);
      g.set(x, y, FLOOR());
      if (ch === 'P') portal(x, y, 'fixture.portal_c_south');
      else if (ch === 'g') fixture(x, y, 'fixture.gate_puzzle');
      else if (ch === 'c') fixture(x, y, 'fixture.chest_key');
      else if (ch === 'b') fixture(x, y, 'fixture.block_puzzle');
    }),
  );
  fixture(c.x0 + 15, c.y0 + 7, 'fixture.plate_puzzle');
  carve('room.d', (x0, y0) => {
    portal(x0 + 9, y0, 'fixture.portal_d_north');
    fixture(x0 + 14, y0 + 5, 'fixture.chest_side');
    fixture(x0 + 3, y0 + 4, 'fixture.tablet');
    object(g, x0 + 10, y0 + 9, 'spawner.spitbloom', objects);
  });
  carve('room.e', (x0, y0) => {
    portal(x0, y0 + 11, 'fixture.portal_e_west');
    portal(x0 + 18, y0, 'fixture.portal_e_shortcut');
    object(g, x0 + 16, y0 + 11, 'spawner.old_bramblehide', objects);
  });
  // Walls: a wall tile with floor directly below is a lit face, and a few carry torches.
  for (let y = 96; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      if (g.get(x, y).object !== WALL_TOP.object) continue;
      if (
        g.get(x, y + 1).ground === Terrain.Cave &&
        g.get(x, y + 1).object !== WALL_TOP.object &&
        g.get(x, y + 1).object !== WALL_FACE.object &&
        g.get(x, y + 1).object !== TORCH.object &&
        g.get(x, y + 1).object !== ARCH.object
      )
        g.set(x, y, (x * 7 + y * 3) % 11 === 0 ? TORCH : WALL_FACE);
    }
  }
}

/** Builds the slice stamp. */
export function buildSliceMap(): Stamp {
  const g = new Grid();
  const objects: Obj[] = [];
  outdoors(g, objects);
  cave(g, objects);
  // One legend character per distinct cell.
  const legend: Record<string, StampCell> = {};
  const byKey = new Map<string, string>();
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      const c = g.get(x, y);
      const key = `${c.ground}|${c.detail ?? 0}|${c.object ?? 0}|${c.overhead ?? 0}`;
      let ch = byKey.get(key);
      if (!ch) {
        ch = String.fromCharCode(0x100 + byKey.size);
        byKey.set(key, ch);
        legend[ch] = c;
      }
      row += ch;
    }
    rows.push(row);
  }
  return { id: 'slice', legend, rows, objects };
}

/** The slice map. */
export const SLICE_MAP: Stamp = buildSliceMap();
