import type { StampV2 } from '../../../sim/world/stamp';
import { Terrain } from '../tileset';
import { StampBuilder } from './builder';

/*
 * The places of interest that have a shape of their own (POW-M4-11, regions/01-dawnmeadow
 * section 12): small stamps the region spec drops on the map. They are scenery and the lay of the
 * ground; what a puzzle does when it is solved comes with the secrets. All built with the stamp
 * builder, so each opens in the dev map and stamp editor. Nothing here is solid but what is drawn
 * as an object.
 */

/** A roadside idol: a carved rock between two torches. */
function idol(): StampV2 {
  const b = new StampBuilder(3, 3);
  b.object(1, 0, 'tile.rock');
  b.object(0, 1, 'tile.torch');
  b.object(2, 1, 'tile.torch');
  b.detail(1, 2, 'tile.flower_white_0');
  return b.toStamp('poi_idol');
}

/** A tree shrine: an old oak ringed with flowers and a sign. */
function treeShrine(): StampV2 {
  const b = new StampBuilder(7, 7);
  b.object(3, 3, 'tile.tree_oak_1_trunk');
  b.overhead(3, 3, 'tile.tree_oak_1_canopy');
  b.overhead(3, 2, 'tile.tree_oak_0_canopy');
  for (const [x, y] of [
    [1, 4],
    [2, 5],
    [4, 5],
    [5, 4],
    [2, 1],
    [5, 2],
  ] as const)
    b.detail(x, y, (x + y) % 2 ? 'tile.flower_rose_0' : 'tile.flower_violet_0');
  b.object(3, 6, 'tile.sign_post');
  return b.toStamp('poi_tree_shrine');
}

/** A lookout: a small plank platform, a post and a sign. The view is the point. */
function vista(): StampV2 {
  const b = new StampBuilder(5, 4);
  b.rect(0, 1, 5, 3, Terrain.Planks);
  b.object(0, 0, 'tile.fence_post');
  b.object(4, 0, 'tile.fence_post');
  b.object(2, 0, 'tile.sign_post');
  b.object(0, 3, 'tile.fence_post');
  b.object(4, 3, 'tile.fence_post');
  return b.toStamp('poi_vista');
}

/** A cart in the ditch: the load spilled, a wheel in the grass. */
function cart(): StampV2 {
  const b = new StampBuilder(6, 4);
  b.rect(0, 2, 6, 2, Terrain.Dirt);
  b.object(2, 1, 'tile.crate');
  b.object(3, 1, 'tile.barrel');
  b.object(3, 2, 'tile.crate');
  b.object(0, 3, 'tile.rock');
  b.object(5, 0, 'tile.hay_bale');
  return b.toStamp('poi_cart');
}

/** A fallen tower: a ring of stone, half of it down, ivy on the rest. */
function fallenTower(): StampV2 {
  const b = new StampBuilder(8, 7);
  for (let x = 1; x < 7; x++) b.object(x, 1, 'tile.wall_stone_h');
  b.object(0, 1, 'tile.wall_stone_post');
  b.object(7, 1, 'tile.wall_stone_post');
  for (let y = 2; y < 5; y++) b.object(0, y, 'tile.wall_stone_v');
  b.object(7, 2, 'tile.wall_stone_v');
  for (const [x, y] of [
    [3, 4],
    [4, 5],
    [6, 4],
    [2, 6],
    [5, 6],
  ] as const)
    b.object(x, y, 'tile.rock');
  b.rect(1, 2, 6, 3, Terrain.Cobble);
  return b.toStamp('poi_fallen_tower');
}

/** A beached boat: a hull of planks on the sand, a mast stub, and its nets. */
function beachedBoat(): StampV2 {
  const b = new StampBuilder(8, 5);
  b.rect(1, 1, 6, 3, Terrain.Planks);
  for (let x = 1; x < 7; x++) b.object(x, 0, 'tile.fence_h');
  for (let x = 1; x < 7; x++) b.object(x, 4, 'tile.fence_h');
  b.object(3, 2, 'tile.fence_post');
  b.object(0, 3, 'tile.reeds_0');
  b.object(7, 1, 'tile.reeds_1');
  return b.toStamp('poi_beached_boat');
}

/** A burnt barn: black walls, no roof, ash on the floor. */
function burntBarn(): StampV2 {
  const b = new StampBuilder(8, 7);
  b.rect(1, 1, 6, 5, Terrain.Dirt);
  for (let x = 0; x < 8; x++) b.object(x, 0, x % 3 === 1 ? 'tile.fence_post' : 'tile.wall_timber');
  for (let y = 1; y < 6; y++) {
    if (y % 2) b.object(0, y, 'tile.wall_timber');
    if (y % 2 === 0) b.object(7, y, 'tile.wall_timber');
  }
  b.object(3, 3, 'tile.rock');
  b.object(5, 4, 'tile.barrel');
  b.object(2, 5, 'tile.hay_bale');
  b.object(4, 6, 'tile.bush_dry_0');
  return b.toStamp('poi_burnt_barn');
}

/** A painter's easel on the cliff edge, a stool, and a rock to lean on. */
function painter(): StampV2 {
  const b = new StampBuilder(5, 4);
  b.rect(0, 0, 5, 4, Terrain.Dirt);
  b.object(2, 1, 'tile.board');
  b.object(3, 2, 'tile.crate');
  b.object(0, 3, 'tile.rock');
  b.detail(4, 1, 'tile.flower_ochre_0');
  return b.toStamp('poi_painter');
}

/** A beekeeper's garden: hives in a fenced plot of flowers. */
function beekeeper(): StampV2 {
  const b = new StampBuilder(9, 6);
  b.fence(0, 0, 8, 0, [4]);
  b.fence(0, 5, 8, 5);
  b.fence(0, 0, 0, 5);
  b.fence(8, 0, 8, 5);
  for (const [x, y] of [
    [2, 2],
    [4, 2],
    [6, 2],
  ] as const)
    b.object(x, y, 'tile.hay_bale');
  for (let x = 1; x < 8; x++)
    b.detail(x, 3, x % 2 ? 'tile.flower_ochre_0' : 'tile.flower_violet_0');
  b.object(7, 4, 'tile.barrel');
  return b.toStamp('poi_beekeeper');
}

/** A lost traveler's camp: a dead fire, a crate and a torn pack. M5 puts a traveler in it. */
function travelersCamp(): StampV2 {
  const b = new StampBuilder(7, 5);
  b.rect(1, 1, 5, 3, Terrain.Dirt);
  b.object(3, 2, 'tile.torch');
  b.object(1, 1, 'tile.crate');
  b.object(5, 3, 'tile.barrel');
  b.object(0, 4, 'tile.rock');
  b.object(6, 0, 'tile.bush_dry_0');
  return b.toStamp('poi_travelers_camp');
}

/** A stone circle on the downs: nine standing stones round a flat slab. */
function stoneCircle(): StampV2 {
  const b = new StampBuilder(11, 11);
  b.rect(1, 1, 9, 9, Terrain.Dirt);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    b.object(5 + Math.round(Math.cos(a) * 4), 5 + Math.round(Math.sin(a) * 4), 'tile.rock');
  }
  b.rect(4, 4, 3, 3, Terrain.Cobble);
  return b.toStamp('poi_stone_circle');
}

/** A lever pond: a still pool, three posts round it and a stone to stand on. */
function leverPond(): StampV2 {
  const b = new StampBuilder(9, 7);
  b.rect(2, 1, 5, 4, Terrain.Water);
  b.rect(0, 5, 9, 2, Terrain.Dirt);
  for (const [x, y] of [
    [1, 2],
    [4, 0],
    [7, 3],
  ] as const)
    b.object(x, y, 'tile.fence_post');
  b.object(4, 5, 'tile.rock');
  return b.toStamp('poi_lever_pond');
}

/** A sundial: a ring of paving, and the gnomon at its middle. */
function sundial(): StampV2 {
  const b = new StampBuilder(7, 7);
  b.rect(1, 1, 5, 5, Terrain.Cobble);
  b.object(3, 3, 'tile.sign_post');
  for (const [x, y] of [
    [3, 0],
    [0, 3],
    [6, 3],
    [3, 6],
  ] as const)
    b.object(x, y, 'tile.rock');
  return b.toStamp('poi_sundial');
}

/**
 * A hedge maze, 13 by 13, with its way in at the bottom left. A perfect maze (one path between any
 * two cells) cut by a fixed walk, so it is the same on every build, and a test finds its centre.
 */
export const HEDGE_MAZE_SIZE = 13;
export const HEDGE_MAZE_CENTER = { x: 5, y: 5 } as const;
export const HEDGE_MAZE_DOOR = { x: 1, y: 12 } as const;

/** The maze as rows of `#` (hedge) and `.` (open). */
export function hedgeMazeRows(): string[] {
  const n = HEDGE_MAZE_SIZE;
  const open = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  // A fixed pseudo random walk (a depth first carve over the odd cells).
  let seed = 20260411;
  const rnd = (): number => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed >>> 16;
  };
  const stack: [number, number][] = [[1, 1]];
  (open[1] as boolean[])[1] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1] as [number, number];
    const next: [number, number][] = [];
    for (const [dx, dy] of [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && ny > 0 && nx < n - 1 && ny < n - 1 && !(open[ny] as boolean[])[nx])
        next.push([nx, ny]);
    }
    if (next.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny] = next[rnd() % next.length] as [number, number];
    (open[(y + ny) / 2] as boolean[])[(x + nx) / 2] = true;
    (open[ny] as boolean[])[nx] = true;
    stack.push([nx, ny]);
  }
  (open[HEDGE_MAZE_DOOR.y] as boolean[])[HEDGE_MAZE_DOOR.x] = true;
  return open.map((row) => row.map((o) => (o ? '.' : '#')).join(''));
}

function hedgeMaze(): StampV2 {
  const rows = hedgeMazeRows();
  const b = new StampBuilder(HEDGE_MAZE_SIZE, HEDGE_MAZE_SIZE);
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '#') b.object(x, y, 'tile.bush_green_0');
    }),
  );
  b.detail(HEDGE_MAZE_CENTER.x, HEDGE_MAZE_CENTER.y, 'tile.flower_rose_0');
  return b.toStamp('poi_hedge_maze');
}

/** A bell stone: a standing stone with a hollow in it, and a rope worn smooth. */
function bellStone(): StampV2 {
  const b = new StampBuilder(3, 3);
  b.object(1, 1, 'tile.rock');
  b.object(0, 0, 'tile.fence_post');
  b.detail(1, 2, 'tile.flower_white_0');
  return b.toStamp('poi_bell_stone');
}

/** A scarecrow line: five poles across a field, each with its crow. */
function scarecrowLine(): StampV2 {
  const b = new StampBuilder(11, 3);
  b.rect(0, 0, 11, 3, Terrain.Dirt);
  for (let x = 1; x < 11; x += 2) {
    b.object(x, 1, 'tile.fence_post');
    b.object(x, 0, 'tile.hay_bale');
  }
  return b.toStamp('poi_scarecrow_line');
}

export const POI_STAMPS: StampV2[] = [
  idol(),
  treeShrine(),
  vista(),
  cart(),
  fallenTower(),
  beachedBoat(),
  burntBarn(),
  painter(),
  beekeeper(),
  travelersCamp(),
  stoneCircle(),
  leverPond(),
  sundial(),
  hedgeMaze(),
  bellStone(),
  scarecrowLine(),
];
