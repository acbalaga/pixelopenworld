import type { SpriteDef } from '../types';
import { Img, outlined, rng, toSprite, type Tones4 } from './img';

/**
 * Generated art for the Hearthford slice: square paving, bridge, cave rock, buildings, fences,
 * and the puzzle fixtures. Seeded like the other generators, so the same code is the same art.
 */

const WOOD: Tones4 = [4, 5, 6, 7];
const STONE: Tones4 = [16, 17, 18, 19];
const METAL: Tones4 = [28, 29, 30, 31];
const FIRE: Tones4 = [20, 21, 22, 23];
const WATER: Tones4 = [12, 13, 14, 15];
const GOLD: Tones4 = [44, 45, 46, 47];
const DARK = 0;
const ORIGIN_TILE = [8, 14] as const;
const ORIGIN_FEET = [8, 15] as const;

/** Scatters specks of `c` over filled pixels. */
function speckle(im: Img, r: () => number, c: number, chance: number): void {
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) if (im.get(x, y) !== null && r() < chance) im.set(x, y, c);
}

function fill(c: number): Img {
  const im = new Img(16, 16);
  im.rect(0, 0, 15, 15, c);
  return im;
}

/** Paving: flagstones with mortar lines, two variants. */
function cobble(v: number): SpriteDef {
  const r = rng(300 + v);
  const im = fill(STONE[2]);
  speckle(im, r, STONE[1], 0.12);
  speckle(im, r, STONE[3], 0.08);
  const rows = [0, 5, 10];
  rows.forEach((y0, i) => {
    im.rect(0, y0 + 4, 15, y0 + 4, STONE[1]);
    const off = (i * 5 + v * 3) % 8;
    for (const x of [off, off + 8]) im.rect(x % 16, y0, x % 16, y0 + 3, STONE[1]);
  });
  im.rect(0, 15, 15, 15, STONE[1]);
  return toSprite(`tile.cobble_${v}`, 'core', [0, 0], { base: im });
}

/** Bridge boards running east to west. */
function planks(): SpriteDef {
  const r = rng(310);
  const im = fill(WOOD[2]);
  for (const y of [0, 4, 8, 12]) {
    im.rect(0, y, 15, y, WOOD[1]);
    im.rect(0, y + 1, 15, y + 1, WOOD[3]);
  }
  speckle(im, r, WOOD[1], 0.07);
  for (const [x, y] of [
    [2, 2],
    [13, 6],
    [4, 10],
    [11, 14],
  ] as const)
    im.set(x, y, WOOD[0]);
  return toSprite('tile.planks_0', 'core', [0, 0], { base: im });
}

function caveFloor(v: number): SpriteDef {
  const r = rng(320 + v);
  const im = fill(STONE[1]);
  speckle(im, r, STONE[0], 0.14);
  speckle(im, r, STONE[2], 0.07);
  speckle(im, r, STONE[3], 0.012);
  return toSprite(`tile.cave_floor_${v}`, 'core', [0, 0], { base: im });
}

/** Wall tops are dark rock seen from above. */
function wallTop(): SpriteDef {
  const r = rng(330);
  const im = fill(0);
  speckle(im, r, STONE[0], 0.28);
  speckle(im, r, STONE[1], 0.05);
  return toSprite('tile.cave_wall_top', 'core', ORIGIN_TILE, { base: im });
}

/** The lit face of a wall, with blocky rock courses. */
function wallFace(torch: boolean): SpriteDef {
  const r = rng(331);
  const frame = (flame: number): Img => {
    const im = fill(STONE[1]);
    speckle(im, r, STONE[2], 0.14);
    speckle(im, r, STONE[0], 0.1);
    im.rect(0, 0, 15, 1, STONE[2]);
    im.rect(0, 14, 15, 15, STONE[0]);
    im.rect(0, 7, 15, 7, STONE[0]);
    for (const x of [4, 11]) im.rect(x, 0, x, 6, STONE[0]);
    for (const x of [1, 8, 14]) im.rect(x, 8, x, 13, STONE[0]);
    if (torch) {
      im.rect(7, 6, 8, 12, WOOD[1]);
      im.rect(6, 5, 9, 6, METAL[1]);
      const tones = [FIRE[1], FIRE[2], FIRE[3]];
      im.rect(7, 2 + flame, 8, 5, tones[0] as number);
      im.rect(7, 3 + flame, 8, 5, tones[1] as number);
      im.set(7, 4, tones[2] as number);
      im.set(8 - flame, 3, tones[2] as number);
    }
    return im;
  };
  if (!torch) return toSprite('tile.cave_wall_face', 'core', ORIGIN_TILE, { base: frame(0) });
  return toSprite(
    'tile.torch',
    'core',
    ORIGIN_TILE,
    { flame_0: frame(0), flame_1: frame(1) },
    { flame: { frames: ['flame_0', 'flame_1'], fps: 5 } },
  );
}

/** A doorway cut in a cave wall, dark inside with a lintel. */
function arch(): SpriteDef {
  const im = fill(0);
  im.rect(0, 0, 15, 1, STONE[2]);
  im.rect(0, 0, 1, 15, STONE[1]);
  im.rect(14, 0, 15, 15, STONE[1]);
  im.rect(2, 2, 13, 15, 0);
  im.rect(2, 2, 13, 2, STONE[0]);
  im.rect(0, 14, 15, 15, STONE[0]);
  im.rect(2, 12, 13, 15, STONE[0]);
  return toSprite('tile.cave_arch', 'core', ORIGIN_TILE, { base: im });
}

type RoofColor = 'red' | 'slate';
const ROOFS: Record<RoofColor, Tones4> = { red: FIRE, slate: [16, 17, 18, 19] };

/** A roof piece. `row` 0 is the ridge row, 1 the eave. `col` is l, m or r. */
function roof(color: RoofColor, row: 0 | 1, col: 'l' | 'm' | 'r'): SpriteDef {
  const t = ROOFS[color];
  const im = fill(t[1]);
  for (let y = 0; y < 16; y += 4) {
    im.rect(0, y + 3, 15, y + 3, t[0]);
    for (let x = (y / 4) % 2 === 0 ? 0 : 4; x < 16; x += 8) im.rect(x, y, x, y + 2, t[0]);
    im.rect(0, y, 15, y, t[2]);
  }
  if (row === 0) im.rect(0, 0, 15, 2, t[2]);
  if (row === 1) {
    im.rect(0, 13, 15, 15, WOOD[0]);
    im.rect(0, 12, 15, 12, t[0]);
  }
  if (col === 'l') im.rect(0, 0, 0, 15, DARK);
  if (col === 'r') im.rect(15, 0, 15, 15, DARK);
  if (row === 0) im.rect(0, 0, 15, 0, DARK);
  return toSprite(`tile.roof_${color}_${row}${col}`, 'core', ORIGIN_TILE, { base: im });
}

function wall(kind: 'plaster' | 'window' | 'door' | 'shop'): SpriteDef {
  const im = fill(GOLD[3]);
  speckle(im, rng(340), 3, 0.05);
  im.rect(0, 0, 0, 15, WOOD[2]);
  im.rect(15, 0, 15, 15, WOOD[1]);
  im.rect(0, 15, 15, 15, STONE[1]);
  im.rect(0, 0, 15, 0, WOOD[1]);
  if (kind === 'window') {
    im.rect(3, 3, 12, 11, WOOD[0]);
    im.rect(4, 4, 11, 10, WATER[2]);
    im.rect(4, 4, 6, 5, WATER[3]);
    im.rect(7, 4, 8, 10, WOOD[1]);
    im.rect(4, 7, 11, 7, WOOD[1]);
    im.rect(2, 12, 13, 12, WOOD[2]);
  }
  if (kind === 'door') {
    im.rect(3, 3, 12, 15, WOOD[0]);
    im.rect(4, 4, 11, 15, WOOD[2]);
    im.rect(4, 4, 5, 15, WOOD[3]);
    im.rect(8, 4, 8, 15, WOOD[1]);
    im.rect(10, 9, 10, 10, GOLD[2]);
    im.rect(3, 15, 12, 15, STONE[2]);
  }
  if (kind === 'shop') {
    for (let x = 0; x < 16; x += 4) {
      im.rect(x, 0, x + 1, 4, FIRE[1]);
      im.rect(x + 2, 0, x + 3, 4, 3);
    }
    im.rect(0, 5, 15, 5, WOOD[0]);
    im.rect(2, 8, 13, 15, WOOD[1]);
    im.rect(2, 8, 13, 9, WOOD[3]);
    im.rect(4, 6, 5, 7, FIRE[2]);
    im.rect(8, 6, 9, 7, 10);
    im.rect(11, 6, 12, 7, WATER[2]);
  }
  return toSprite(`tile.wall_${kind}`, 'core', ORIGIN_TILE, { base: im });
}

function fence(kind: 'h' | 'v' | 'post'): SpriteDef {
  const im = new Img(16, 16);
  if (kind === 'h' || kind === 'post') {
    if (kind === 'h') {
      im.rect(0, 6, 15, 7, WOOD[2]);
      im.rect(0, 6, 15, 6, WOOD[3]);
      im.rect(0, 10, 15, 11, WOOD[2]);
      im.rect(0, 10, 15, 10, WOOD[3]);
      im.rect(0, 8, 15, 8, WOOD[0]);
    }
    for (const x of kind === 'h' ? [1, 13] : [6]) {
      im.rect(x, 4, x + 2, 14, WOOD[1]);
      im.rect(x, 4, x, 14, WOOD[2]);
      im.rect(x, 3, x + 2, 3, WOOD[3]);
    }
  } else {
    im.rect(6, 0, 9, 15, WOOD[2]);
    im.rect(6, 0, 6, 15, WOOD[3]);
    im.rect(9, 0, 9, 15, WOOD[1]);
    for (const y of [2, 8, 14]) im.rect(5, y, 10, y + 1, WOOD[1]);
  }
  return toSprite(`tile.fence_${kind}`, 'core', ORIGIN_TILE, { base: outlined(im) });
}

function crate(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(2, 4, 13, 14, WOOD[2]);
  im.rect(2, 4, 13, 5, WOOD[3]);
  im.rect(2, 4, 3, 14, WOOD[1]);
  im.rect(12, 4, 13, 14, WOOD[1]);
  im.rect(7, 4, 8, 14, WOOD[1]);
  im.rect(2, 9, 13, 9, WOOD[1]);
  return toSprite('tile.crate', 'core', ORIGIN_TILE, { base: outlined(im) });
}

function barrel(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(3, 3, 12, 14, WOOD[2]);
  im.rect(3, 3, 4, 14, WOOD[3]);
  im.rect(11, 3, 12, 14, WOOD[1]);
  im.rect(3, 5, 12, 5, METAL[1]);
  im.rect(3, 11, 12, 11, METAL[1]);
  im.rect(4, 3, 11, 3, WOOD[3]);
  return toSprite('tile.barrel', 'core', ORIGIN_TILE, { base: outlined(im) });
}

/** The sign you can read: the same post, drawn as an object with its feet at the bottom. */
function readableSign(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(7, 6, 8, 14, WOOD[1]);
  im.rect(2, 3, 13, 8, WOOD[2]);
  im.rect(2, 3, 13, 3, WOOD[3]);
  im.rect(2, 8, 13, 8, WOOD[1]);
  im.rect(4, 5, 6, 5, WOOD[0]);
  im.rect(8, 5, 11, 5, WOOD[0]);
  im.rect(5, 6, 10, 6, WOOD[0]);
  return toSprite('prop.sign', 'core', ORIGIN_FEET, { base: outlined(im) });
}

function signpost(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(7, 6, 8, 14, WOOD[1]);
  im.rect(2, 3, 13, 8, WOOD[2]);
  im.rect(2, 3, 13, 3, WOOD[3]);
  im.rect(2, 8, 13, 8, WOOD[1]);
  im.rect(4, 5, 6, 5, WOOD[0]);
  im.rect(8, 5, 11, 5, WOOD[0]);
  im.rect(5, 6, 10, 6, WOOD[0]);
  return toSprite('tile.sign_post', 'core', ORIGIN_TILE, { base: outlined(im) });
}

/** The request board: a frame with pinned notes. */
/** The notice board's pixels, as a tile for the map and as a prop the avatar can stand at. */
function boardImg(): Img {
  const im = new Img(16, 16);
  im.rect(2, 1, 13, 11, WOOD[1]);
  im.rect(3, 2, 12, 10, WOOD[2]);
  im.rect(4, 3, 7, 6, 3);
  im.rect(8, 3, 11, 5, GOLD[3]);
  im.rect(5, 7, 10, 9, 3);
  for (const [x, y] of [
    [5, 3],
    [9, 3],
    [7, 7],
  ] as const)
    im.set(x, y, FIRE[1]);
  im.rect(3, 11, 4, 14, WOOD[1]);
  im.rect(11, 11, 12, 14, WOOD[1]);
  return im;
}

function board(): SpriteDef {
  return toSprite('tile.board', 'core', ORIGIN_TILE, { base: outlined(boardImg()) });
}

/** The request board in the square (M3-11): the same board, standing on its own feet. */
function boardProp(): SpriteDef {
  return toSprite('prop.board', 'core', ORIGIN_FEET, { base: outlined(boardImg()) });
}

/** The inn mirror (M4-19): a tall oval of glass in a wooden frame, on two small feet. */
function mirrorProp(): SpriteDef {
  const im = new Img(16, 16);
  // Frame, then glass with a diagonal glint.
  for (let y = 1; y <= 13; y++) {
    const half = y <= 2 || y >= 12 ? 3 : y <= 4 || y >= 10 ? 4 : 5;
    im.rect(8 - half, y, 7 + half, y, WOOD[1]);
    im.rect(9 - half, y, 6 + half, y, WOOD[2]);
  }
  for (let y = 2; y <= 12; y++) {
    const half = y <= 3 || y >= 11 ? 2 : y <= 4 || y >= 10 ? 3 : 4;
    im.rect(8 - half, y, 7 + half, y, 15);
  }
  im.rect(5, 4, 5, 5, 3);
  im.rect(6, 6, 6, 6, 3);
  im.rect(10, 9, 10, 10, 14);
  im.rect(5, 14, 6, 15, WOOD[0]);
  im.rect(9, 14, 10, 15, WOOD[0]);
  return toSprite('prop.mirror', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** A satchel a patrol dropped: a leather bag with a flap and a buckle. Closed, ajar, and open. */
function satchel(): SpriteDef {
  const body = (im: Img): void => {
    im.rect(3, 6, 12, 13, WOOD[2]);
    im.rect(3, 6, 12, 8, WOOD[3]);
    im.rect(3, 12, 12, 13, WOOD[1]);
    im.rect(3, 6, 3, 13, WOOD[1]);
  };
  const closed = new Img(16, 16);
  body(closed);
  closed.rect(7, 8, 8, 10, GOLD[2]);
  closed.rect(5, 4, 10, 5, WOOD[1]);
  closed.set(5, 3, WOOD[1]);
  closed.set(10, 3, WOOD[1]);
  const ajar = new Img(16, 16);
  body(ajar);
  ajar.rect(4, 6, 11, 7, DARK);
  ajar.rect(5, 3, 10, 4, WOOD[1]);
  const open = new Img(16, 16);
  body(open);
  open.rect(4, 6, 11, 8, DARK);
  open.rect(5, 2, 10, 3, WOOD[1]);
  return toSprite('prop.satchel', 'core', ORIGIN_FEET, {
    closed: outlined(closed),
    opening_0: outlined(ajar),
    open: outlined(open),
  });
}

function waystone(): SpriteDef {
  const frame = (n: number): Img => {
    const im = new Img(16, 24);
    // Emitter plate on the ground, with a ring of light that breathes.
    im.rect(3, 21, 12, 22, STONE[1]);
    im.rect(4, 20, 11, 20, STONE[2]);
    im.rect(3, 21, 12, 21, STONE[2]);
    im.rect(5, 22, 10, 22, STONE[0]);
    const ring = n % 2 === 0 ? WATER[3] : WATER[2];
    im.rect(6, 21, 9, 21, ring);
    // The diamond. It bobs one pixel up and down over the four frames.
    const bob = [0, -1, 0, 1][n] as number;
    const cy = 10 + bob;
    const half = 8;
    for (let dy = -half; dy <= half; dy++) {
      const w = Math.round(((half - Math.abs(dy)) * 5.5) / half);
      for (let dx = -w; dx <= w; dx++) {
        const x = 8 + dx - (dx > 0 ? 1 : 0);
        const y = cy + dy;
        // Facets: top lit, left lit, right in shade, and a bright seam down the middle.
        let c = dx < 0 ? WATER[2] : dx > 0 ? WATER[1] : WATER[3];
        if (dy < 0 && dx < 0) c = dx < -1 ? WATER[3] : WATER[2];
        if (dy > 2 && dx > 0) c = WATER[0];
        im.set(x, y, c);
      }
    }
    // A bright core that pulses, and a highlight on the upper left edge.
    const core = n === 1 || n === 2 ? 3 : 2;
    im.rect(7, cy - 1, 8, cy + 1, WATER[core as 2 | 3]);
    im.set(6, cy - 3, 3);
    im.set(5, cy - 2, 3);
    // Two shards circling the crystal.
    const orbit: [number, number][] = [
      [2, 6],
      [13, 9],
      [13, 14],
      [2, 12],
    ];
    const a = orbit[n] as [number, number];
    const b = orbit[(n + 2) % 4] as [number, number];
    im.set(a[0], a[1] + bob, WATER[3]);
    im.set(b[0], b[1] + bob, WATER[2]);
    // A faint beam of light between the crystal and the plate.
    for (let y = cy + half + 1; y <= 19; y++) if ((y + n) % 2 === 0) im.set(7, y, WATER[1]);
    return outlined(im);
  };
  return toSprite(
    'prop.waystone',
    'core',
    [8, 23],
    { glow_0: frame(0), glow_1: frame(1), glow_2: frame(2), glow_3: frame(3) },
    { glow: { frames: ['glow_0', 'glow_1', 'glow_2', 'glow_3'], fps: 4 } },
  );
}

/**
 * A stone door in two leaves. `slide` is how far each leaf has drawn back from the middle, in px
 * (0 is shut). `lit` turns the lock gold for the frame where the key turns.
 */
function doorLeaves(slide: number, lit = false): Img {
  const im = new Img(16, 16);
  // The dark passage shows through the gap as the leaves part.
  im.rect(2, 2, 13, 15, DARK);
  const leaf = (x0: number, x1: number): void => {
    if (x1 < x0) return;
    im.rect(x0, 0, x1, 15, STONE[1]);
    im.rect(Math.min(x0 + 1, x1), 1, x1, 15, STONE[2]);
    im.rect(x0, 1, x1, 2, STONE[3]);
    for (const y of [4, 11]) im.rect(x0, y, x1, y + 1, METAL[1]);
  };
  // Each leaf is clipped by the jamb as it slides, so it narrows rather than leaving the frame.
  leaf(0, 7 - slide);
  leaf(8 + slide, 15);
  if (slide === 0) {
    im.rect(6, 7, 9, 10, lit ? GOLD[3] : GOLD[2]);
    im.rect(7, 8, 8, 9, lit ? GOLD[1] : DARK);
  }
  // The jambs stay put.
  im.rect(0, 0, 1, 15, STONE[2]);
  im.rect(14, 0, 15, 15, STONE[2]);
  return im;
}

function lockedDoor(): SpriteDef {
  const open = new Img(16, 16);
  open.rect(0, 0, 15, 15, STONE[1]);
  open.rect(2, 2, 13, 15, DARK);
  open.rect(0, 0, 1, 15, STONE[2]);
  open.rect(14, 0, 15, 15, STONE[2]);
  return toSprite('prop.door_locked', 'core', ORIGIN_FEET, {
    closed: outlined(doorLeaves(0)),
    // The key turns, then the leaves draw apart. The game steps through these on open.
    opening_0: outlined(doorLeaves(0, true)),
    opening_1: outlined(doorLeaves(2)),
    opening_2: outlined(doorLeaves(4)),
    opening_3: outlined(doorLeaves(5)),
    open: open,
  });
}

/** A portcullis with its bars lifted `rise` px. */
function gateBars(rise: number): Img {
  const im = new Img(16, 16);
  // Only the part still below the lintel is drawn; the lintel itself is solid.
  im.rect(0, 0, 15, 1, METAL[2]);
  const top = 2;
  const bottom = 15 - rise;
  if (bottom >= top) {
    for (let x = 1; x < 16; x += 4) im.rect(x, top, x + 1, bottom, METAL[1]);
    im.rect(0, Math.min(bottom, 3), 15, Math.min(bottom, 4), METAL[2]);
    if (bottom > 11) im.rect(0, 11, 15, 12, METAL[2]);
  }
  return im;
}

const LEAF: Tones4 = [8, 9, 10, 11];
const VIOLET: Tones4 = [24, 25, 26, 27];

/** A wall of dry brush: tangled sticks and leaves. Burnt, it is a low heap of ash. */
function brushWall(): SpriteDef {
  const r = rng(71);
  const closed = new Img(16, 16);
  closed.rect(1, 3, 14, 14, WOOD[1]);
  for (let i = 0; i < 40; i++) {
    const x = 1 + Math.floor(r() * 14);
    const y = 2 + Math.floor(r() * 12);
    closed.rect(x, y, x + 1, y, r() < 0.5 ? WOOD[2] : GOLD[1]);
  }
  closed.rect(2, 2, 13, 4, WOOD[2]);
  speckle(closed, r, GOLD[2], 0.18);
  const open = new Img(16, 16);
  open.rect(3, 11, 12, 14, STONE[1]);
  open.rect(5, 10, 10, 11, STONE[2]);
  speckle(open, r, STONE[0], 0.2);
  return toSprite('prop.brush_wall', 'core', ORIGIN_FEET, {
    closed: outlined(closed),
    open: outlined(open),
  });
}

/** A fire that bars the way. Doused, scorched ground and one thin curl of smoke. */
function fireBarrier(): SpriteDef {
  const closed = new Img(16, 16);
  closed.rect(1, 12, 14, 14, STONE[1]);
  for (const x of [1, 6, 11]) {
    closed.rect(x, 5, x + 3, 12, FIRE[1]);
    closed.rect(x + 1, 2, x + 2, 6, FIRE[2]);
    closed.rect(x + 1, 7, x + 2, 12, FIRE[3]);
  }
  const open = new Img(16, 16);
  open.rect(2, 12, 13, 14, STONE[0]);
  open.rect(4, 13, 11, 13, STONE[1]);
  open.rect(7, 6, 8, 11, STONE[2]);
  return toSprite('prop.fire_barrier', 'core', ORIGIN_FEET, {
    closed: outlined(closed),
    open: outlined(open),
  });
}

/** A windmill gate: four blades across the way. Spun, the blades stand upright either side. */
function windmillGate(): SpriteDef {
  const closed = new Img(16, 16);
  closed.rect(7, 2, 8, 14, WOOD[2]);
  closed.rect(1, 7, 14, 8, WOOD[3]);
  closed.rect(2, 2, 5, 5, WOOD[1]);
  closed.rect(10, 10, 13, 13, WOOD[1]);
  closed.rect(10, 2, 13, 5, STONE[2]);
  closed.rect(2, 10, 5, 13, STONE[2]);
  closed.rect(7, 7, 8, 8, METAL[2]);
  const open = new Img(16, 16);
  open.rect(0, 2, 2, 14, WOOD[2]);
  open.rect(13, 2, 15, 14, WOOD[2]);
  open.rect(0, 2, 5, 3, WOOD[3]);
  open.rect(10, 2, 15, 3, WOOD[3]);
  open.rect(1, 7, 1, 8, METAL[2]);
  open.rect(14, 7, 14, 8, METAL[2]);
  return toSprite('prop.windmill_gate', 'core', ORIGIN_FEET, {
    closed: outlined(closed),
    open: outlined(open),
  });
}

/** A gap in the path. A stone step rises across it. */
function stoneGap(): SpriteDef {
  const closed = new Img(16, 16);
  closed.rect(0, 5, 15, 14, DARK);
  closed.rect(1, 6, 14, 13, STONE[0]);
  closed.rect(2, 7, 13, 9, DARK);
  closed.rect(0, 5, 15, 5, STONE[1]);
  const open = new Img(16, 16);
  open.rect(0, 5, 15, 14, DARK);
  open.rect(1, 7, 14, 13, STONE[2]);
  open.rect(1, 7, 14, 8, STONE[3]);
  open.rect(1, 12, 14, 13, STONE[1]);
  return toSprite('prop.stone_gap', 'core', ORIGIN_FEET, {
    closed: outlined(closed),
    open: outlined(open),
  });
}

/** A withered vine hanging dead from a ledge. Grown, a green ladder of leaves and rungs. */
function witheredVine(): SpriteDef {
  const r = rng(73);
  const closed = new Img(16, 16);
  closed.rect(6, 1, 7, 12, WOOD[1]);
  closed.rect(9, 3, 9, 9, WOOD[1]);
  for (let i = 0; i < 8; i++)
    closed.set(4 + Math.floor(r() * 8), 2 + Math.floor(r() * 10), WOOD[2]);
  closed.rect(3, 13, 12, 14, WOOD[0]);
  const open = new Img(16, 16);
  open.rect(4, 0, 5, 14, LEAF[2]);
  open.rect(10, 0, 11, 14, LEAF[2]);
  for (let y = 2; y < 14; y += 3) open.rect(4, y, 11, y, WOOD[2]);
  speckle(open, r, LEAF[3], 0.25);
  return toSprite('prop.withered_vine', 'core', ORIGIN_FEET, {
    closed: outlined(closed),
    open: outlined(open),
  });
}

/** A niche in a wall that was always there: a violet glow, and a small chest inside, then empty. */
function hiddenNiche(): SpriteDef {
  const closed = new Img(16, 16);
  closed.rect(2, 3, 13, 14, STONE[0]);
  closed.rect(3, 4, 12, 13, VIOLET[0]);
  closed.rect(5, 9, 10, 13, WOOD[2]);
  closed.rect(5, 9, 10, 9, WOOD[3]);
  closed.rect(7, 10, 8, 11, GOLD[2]);
  closed.rect(4, 5, 5, 6, VIOLET[3]);
  const open = new Img(16, 16);
  open.rect(2, 3, 13, 14, STONE[0]);
  open.rect(3, 4, 12, 13, VIOLET[0]);
  open.rect(5, 12, 10, 13, WOOD[1]);
  return toSprite('prop.hidden_niche', 'core', ORIGIN_FEET, {
    closed: outlined(closed),
    open: outlined(open),
  });
}

/** A wall of raised earth and rock. */
function earthWall(): SpriteDef {
  const r = rng(79);
  const im = new Img(16, 16);
  im.rect(1, 3, 14, 14, WOOD[1]);
  im.rect(2, 2, 13, 4, STONE[2]);
  im.rect(0, 5, 15, 14, STONE[1]);
  speckle(im, r, STONE[3], 0.2);
  speckle(im, r, WOOD[2], 0.15);
  im.rect(0, 13, 15, 14, STONE[0]);
  return toSprite('prop.earth_wall', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** A loom: a frame with warp threads and a cloth bar. */
function loom(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(1, 2, 2, 14, WOOD[1]);
  im.rect(13, 2, 14, 14, WOOD[1]);
  im.rect(1, 2, 14, 3, WOOD[2]);
  for (let x = 4; x < 13; x += 2) im.rect(x, 4, x, 11, STONE[3]);
  im.rect(3, 8, 12, 9, FIRE[2]);
  im.rect(3, 12, 12, 13, WOOD[2]);
  return toSprite('prop.loom', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** An alchemy table with a bubbling flask over a small flame. */
function alchemyTable(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(1, 8, 14, 9, WOOD[3]);
  im.rect(2, 10, 3, 14, WOOD[1]);
  im.rect(12, 10, 13, 14, WOOD[1]);
  im.rect(6, 7, 9, 7, FIRE[2]);
  im.rect(5, 3, 10, 6, WATER[2]);
  im.rect(6, 1, 9, 2, STONE[3]);
  im.rect(6, 4, 7, 5, WATER[3]);
  im.rect(4, 8, 5, 8, GOLD[2]);
  return toSprite('prop.alchemy_table', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** A rune stone: a slab with a glowing glyph. */
function runeStone(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(4, 2, 11, 14, STONE[2]);
  im.rect(3, 4, 12, 13, STONE[2]);
  im.rect(4, 2, 11, 3, STONE[3]);
  im.rect(7, 5, 8, 11, VIOLET[3]);
  im.rect(5, 7, 10, 7, VIOLET[3]);
  im.rect(5, 11, 6, 11, VIOLET[2]);
  im.rect(9, 11, 10, 11, VIOLET[2]);
  return toSprite('prop.rune_stone', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** A tinker bench: a bench with a vice, gears and a spring. */
function tinkerBench(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(1, 8, 14, 10, WOOD[3]);
  im.rect(1, 8, 14, 8, WOOD[2]);
  im.rect(2, 11, 3, 14, WOOD[1]);
  im.rect(12, 11, 13, 14, WOOD[1]);
  im.rect(2, 4, 5, 7, METAL[2]);
  im.rect(3, 3, 4, 3, METAL[3]);
  im.rect(8, 5, 11, 7, METAL[1]);
  im.rect(9, 4, 10, 4, METAL[3]);
  im.rect(7, 7, 7, 7, GOLD[2]);
  return toSprite('prop.tinker_bench', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** A snare: a loop of cord and a peg. */
function snareProp(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(2, 10, 13, 12, WOOD[1]);
  for (const [x, y] of [
    [4, 8],
    [5, 7],
    [6, 7],
    [9, 7],
    [10, 7],
    [11, 8],
  ] as const)
    im.set(x, y, GOLD[2]);
  im.rect(7, 6, 8, 9, METAL[2]);
  return toSprite('prop.snare', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** A bedroll with a pillow. */
function bedroll(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(1, 6, 14, 13, FIRE[1]);
  im.rect(1, 6, 14, 8, FIRE[2]);
  im.rect(2, 7, 5, 11, GOLD[3]);
  im.rect(1, 12, 14, 13, FIRE[0]);
  im.rect(11, 6, 11, 13, FIRE[0]);
  return toSprite('prop.bedroll', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** A wall torch on a stand: dark until Ember lights it (M4-08 art, added with the Rootway). */
function torchProp(): SpriteDef {
  const base = new Img(16, 16);
  base.rect(7, 6, 8, 14, WOOD[1]);
  base.rect(5, 12, 10, 14, WOOD[2]);
  base.rect(6, 4, 9, 6, METAL[1]);
  const lit = new Img(16, 16);
  lit.rect(7, 6, 8, 14, WOOD[1]);
  lit.rect(5, 12, 10, 14, WOOD[2]);
  lit.rect(6, 4, 9, 6, METAL[1]);
  lit.rect(6, 1, 9, 4, FIRE[2]);
  lit.rect(7, 0, 8, 2, GOLD[3]);
  return toSprite('prop.torch', 'core', ORIGIN_FEET, { base: outlined(base), lit: outlined(lit) });
}

/** A scarecrow on a post with a crow perched on its arm (M4-20). */
function scarecrow(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(7, 4, 8, 15, WOOD[1]);
  im.rect(2, 6, 13, 7, WOOD[2]);
  im.rect(5, 8, 10, 13, GOLD[1]);
  im.rect(6, 1, 9, 4, GOLD[3]);
  im.rect(5, 1, 10, 1, WOOD[1]);
  // The crow: a dark body, a beak and a bright eye.
  im.rect(10, 3, 13, 6, METAL[0]);
  im.rect(13, 4, 14, 4, GOLD[2]);
  im.set(12, 4, METAL[3]);
  return toSprite('prop.scarecrow', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** A low mound of turned earth with a few pebbles (M4-20). */
function crowMound(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(3, 10, 12, 14, WOOD[1]);
  im.rect(5, 8, 10, 10, WOOD[2]);
  im.set(6, 9, WOOD[3]);
  im.set(9, 11, STONE[2]);
  im.set(4, 12, STONE[3]);
  return toSprite('prop.crow_mound', 'core', ORIGIN_FEET, { base: outlined(im) });
}

function gate(): SpriteDef {
  const closed = new Img(16, 16);
  for (let x = 1; x < 16; x += 4) closed.rect(x, 1, x + 1, 15, METAL[1]);
  closed.rect(0, 2, 15, 3, METAL[2]);
  closed.rect(0, 11, 15, 12, METAL[2]);
  for (let x = 1; x < 16; x += 4) closed.rect(x, 1, x, 15, METAL[2]);
  const open = new Img(16, 16);
  open.rect(0, 0, 1, 15, METAL[1]);
  open.rect(14, 0, 15, 15, METAL[1]);
  open.rect(0, 0, 15, 2, METAL[2]);
  for (let x = 3; x < 14; x += 4) open.rect(x, 0, x + 1, 2, METAL[1]);
  return toSprite('prop.gate', 'core', ORIGIN_FEET, {
    closed: outlined(closed),
    opening_0: outlined(gateBars(4)),
    opening_1: outlined(gateBars(8)),
    opening_2: outlined(gateBars(11)),
    open: outlined(open),
  });
}

function plate(): SpriteDef {
  const up = new Img(16, 16);
  up.rect(2, 3, 13, 13, STONE[1]);
  up.rect(3, 4, 12, 11, STONE[2]);
  up.rect(3, 4, 12, 4, STONE[3]);
  up.rect(7, 6, 8, 9, STONE[1]);
  up.rect(2, 12, 13, 13, STONE[0]);
  const down = new Img(16, 16);
  down.rect(2, 5, 13, 13, STONE[0]);
  down.rect(3, 6, 12, 12, STONE[1]);
  down.rect(7, 8, 8, 10, GOLD[2]);
  return toSprite('prop.plate', 'core', ORIGIN_FEET, { up, down });
}

function block(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(1, 1, 14, 14, STONE[2]);
  im.rect(1, 1, 14, 3, STONE[3]);
  im.rect(1, 1, 3, 14, STONE[3]);
  im.rect(12, 3, 14, 14, STONE[1]);
  im.rect(3, 12, 14, 14, STONE[1]);
  im.rect(6, 6, 9, 9, GOLD[1]);
  im.rect(7, 7, 8, 8, GOLD[3]);
  return toSprite('prop.block', 'core', ORIGIN_FEET, { base: outlined(im) });
}

function chest(): SpriteDef {
  const closed = new Img(16, 16);
  closed.rect(2, 6, 13, 14, WOOD[2]);
  closed.rect(2, 4, 13, 7, WOOD[3]);
  closed.rect(2, 4, 13, 4, WOOD[2]);
  closed.rect(2, 9, 13, 9, METAL[1]);
  closed.rect(7, 8, 8, 11, GOLD[2]);
  closed.rect(2, 13, 13, 14, WOOD[1]);
  const open = new Img(16, 16);
  open.rect(2, 8, 13, 14, WOOD[2]);
  open.rect(3, 8, 12, 9, DARK);
  open.rect(2, 2, 13, 6, WOOD[3]);
  open.rect(2, 2, 13, 2, WOOD[2]);
  open.rect(2, 13, 13, 14, WOOD[1]);
  open.rect(6, 9, 9, 10, GOLD[2]);
  // Lid lifting: a wedge of dark under a raised front edge.
  const ajar = new Img(16, 16);
  ajar.rect(2, 7, 13, 14, WOOD[2]);
  ajar.rect(3, 7, 12, 7, DARK);
  ajar.rect(2, 4, 13, 6, WOOD[3]);
  ajar.rect(2, 4, 13, 4, WOOD[2]);
  ajar.rect(2, 13, 13, 14, WOOD[1]);
  ajar.rect(7, 6, 8, 8, GOLD[2]);
  return toSprite('prop.chest', 'core', ORIGIN_FEET, {
    closed: outlined(closed),
    opening_0: outlined(ajar),
    open: outlined(open),
  });
}

function anvil(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(3, 12, 12, 14, WOOD[1]);
  im.rect(5, 9, 10, 12, METAL[1]);
  im.rect(2, 6, 13, 8, METAL[2]);
  im.rect(2, 6, 13, 6, METAL[3]);
  im.rect(11, 7, 14, 7, METAL[2]);
  im.rect(4, 8, 11, 8, METAL[1]);
  return toSprite('prop.anvil', 'core', ORIGIN_FEET, { base: outlined(im) });
}

function workbench(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(1, 7, 14, 9, WOOD[3]);
  im.rect(1, 7, 14, 7, WOOD[2]);
  im.rect(2, 10, 3, 14, WOOD[1]);
  im.rect(12, 10, 13, 14, WOOD[1]);
  im.rect(4, 5, 7, 6, METAL[2]);
  im.rect(9, 4, 11, 6, WOOD[2]);
  return toSprite('prop.workbench', 'core', ORIGIN_FEET, { base: outlined(im) });
}

function tablet(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(3, 2, 12, 14, STONE[2]);
  im.rect(4, 1, 11, 1, STONE[2]);
  im.rect(3, 2, 4, 14, STONE[3]);
  im.rect(11, 3, 12, 14, STONE[1]);
  for (const [x, y, w] of [
    [5, 4, 5],
    [5, 7, 4],
    [5, 10, 5],
  ] as const)
    im.rect(x, y, x + w - 1, y, STONE[0]);
  im.set(6, 5, STONE[0]);
  im.set(9, 8, STONE[0]);
  return toSprite('prop.tablet', 'core', ORIGIN_FEET, { base: outlined(im) });
}

/** Every sprite for the slice map. */
export function worldSprites(): SpriteDef[] {
  return [
    cobble(0),
    cobble(1),
    planks(),
    caveFloor(0),
    caveFloor(1),
    wallTop(),
    wallFace(false),
    wallFace(true),
    arch(),
    ...(['red', 'slate'] as const).flatMap((c) =>
      ([0, 1] as const).flatMap((row) =>
        (['l', 'm', 'r'] as const).map((col) => roof(c, row, col)),
      ),
    ),
    wall('plaster'),
    wall('window'),
    wall('door'),
    wall('shop'),
    fence('h'),
    fence('v'),
    fence('post'),
    crate(),
    barrel(),
    signpost(),
    readableSign(),
    board(),
    boardProp(),
    mirrorProp(),
    satchel(),
    waystone(),
    lockedDoor(),
    gate(),
    plate(),
    block(),
    chest(),
    anvil(),
    workbench(),
    tablet(),
    brushWall(),
    fireBarrier(),
    windmillGate(),
    stoneGap(),
    witheredVine(),
    hiddenNiche(),
    bedroll(),
    earthWall(),
    loom(),
    alchemyTable(),
    runeStone(),
    tinkerBench(),
    snareProp(),
    scarecrow(),
    crowMound(),
    torchProp(),
  ];
}
