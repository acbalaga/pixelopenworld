import type { SpriteDef } from '../types';
import { Img, outlined, rng, toSprite, type Tones4 } from './img';

/**
 * Dawnmeadow's own art (POW-M4-04): thatch and timber for farms, huts and homes, the low stone
 * town wall, barley, hay and reeds. Seeded like the other generators, so the same code is the same
 * art. Light comes from the top left (tech/03 art bible).
 */

const WOOD: Tones4 = [4, 5, 6, 7];
const STONE: Tones4 = [16, 17, 18, 19];
const FOLIAGE: Tones4 = [8, 9, 10, 11];
const STRAW: Tones4 = [44, 45, 46, 47];
const DARK = 0;
const ORIGIN_TILE = [8, 14] as const;

function fill(c: number): Img {
  const im = new Img(16, 16);
  im.rect(0, 0, 15, 15, c);
  return im;
}

function speckle(im: Img, r: () => number, c: number, chance: number): void {
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) if (im.get(x, y) !== null && r() < chance) im.set(x, y, c);
}

/** A thatch roof piece: overlapping bundles of straw, a shaggy eave. `row` 0 is the ridge, 1 the eave. */
function thatch(row: 0 | 1, col: 'l' | 'm' | 'r'): SpriteDef {
  const r = rng(700 + row * 3 + (col === 'l' ? 0 : col === 'm' ? 1 : 2));
  const im = fill(STRAW[1]);
  // Bundles run down the slope: short vertical strokes in staggered courses.
  for (let y = 0; y < 16; y += 4) {
    const off = (y / 4) % 2 === 0 ? 0 : 2;
    for (let x = off; x < 16; x += 4) {
      im.rect(x, y, x + 1, y + 3, STRAW[2]);
      im.rect(x, y, x, y + 3, STRAW[3]);
      im.rect(x + 2, y, x + 2, y + 3, STRAW[0]);
    }
    im.rect(0, y + 3, 15, y + 3, STRAW[0]);
  }
  speckle(im, r, STRAW[3], 0.06);
  speckle(im, r, STRAW[0], 0.05);
  if (row === 0) {
    // The ridge: a thick bound roll of straw.
    im.rect(0, 0, 15, 3, STRAW[2]);
    im.rect(0, 0, 15, 1, STRAW[3]);
    im.rect(0, 3, 15, 3, STRAW[0]);
    for (const x of [3, 8, 13]) im.rect(x, 0, x, 3, WOOD[1]);
  }
  if (row === 1) {
    // The eave overhangs the wall: a ragged lower edge over a shadow line.
    im.rect(0, 12, 15, 15, WOOD[0]);
    for (let x = 0; x < 16; x++) {
      const drop = 12 + Math.floor(r() * 3);
      im.rect(x, 11, x, drop, x % 3 === 0 ? STRAW[2] : STRAW[1]);
    }
    im.rect(0, 11, 15, 11, STRAW[0]);
  }
  if (col === 'l') im.rect(0, 0, 0, 15, DARK);
  if (col === 'r') im.rect(15, 0, 15, 15, DARK);
  if (row === 0) im.rect(0, 0, 15, 0, DARK);
  return toSprite(`tile.roof_thatch_${row}${col}`, 'core', ORIGIN_TILE, { base: im });
}

type TimberKind = 'plain' | 'window' | 'door';

/** A timber frame wall: pale infill between dark posts, a cross brace, a stone footing. */
function timber(kind: TimberKind): SpriteDef {
  const r = rng(720);
  const im = fill(WOOD[3]);
  speckle(im, r, 3, 0.05);
  // Footing and top plate.
  im.rect(0, 14, 15, 15, STONE[1]);
  im.rect(0, 14, 15, 14, STONE[2]);
  im.rect(0, 0, 15, 1, WOOD[0]);
  // Posts at the edges and a cross brace.
  im.rect(0, 0, 1, 15, WOOD[0]);
  im.rect(14, 0, 15, 15, WOOD[0]);
  im.rect(0, 0, 0, 15, WOOD[1]);
  if (kind === 'plain') {
    for (let k = 0; k < 11; k++) {
      im.set(2 + Math.floor(k * 1.1), 12 - k, WOOD[1]);
      im.set(3 + Math.floor(k * 1.1), 12 - k, WOOD[1]);
    }
    im.rect(7, 2, 8, 13, WOOD[0]);
  }
  if (kind === 'window') {
    im.rect(3, 3, 12, 11, WOOD[0]);
    im.rect(4, 4, 11, 10, 13);
    im.rect(4, 4, 6, 5, 14);
    im.rect(7, 4, 8, 10, WOOD[1]);
    im.rect(4, 7, 11, 7, WOOD[1]);
    im.rect(2, 12, 13, 12, WOOD[2]);
    // Shutters, one open each side.
    im.rect(2, 3, 2, 11, WOOD[1]);
    im.rect(13, 3, 13, 11, WOOD[1]);
  }
  if (kind === 'door') {
    im.rect(3, 2, 12, 15, WOOD[0]);
    im.rect(4, 3, 11, 15, WOOD[2]);
    im.rect(4, 3, 5, 15, WOOD[3]);
    im.rect(8, 3, 8, 15, WOOD[1]);
    im.rect(3, 6, 12, 6, WOOD[0]);
    im.rect(3, 11, 12, 11, WOOD[0]);
    im.rect(10, 9, 10, 10, STRAW[2]);
    im.rect(3, 15, 12, 15, STONE[2]);
  }
  return toSprite(`tile.wall_timber${kind === 'plain' ? '' : `_${kind}`}`, 'core', ORIGIN_TILE, {
    base: im,
  });
}

/** The town wall: a low dry stone wall with a flat coping, seen from the front. */
function stoneWall(kind: 'h' | 'v' | 'post'): SpriteDef {
  const r = rng(740);
  const im = new Img(16, 16);
  if (kind === 'h') {
    // Coping, two courses of stones, a shadow at the foot.
    im.rect(0, 4, 15, 5, STONE[3]);
    im.rect(0, 5, 15, 5, STONE[2]);
    im.rect(0, 6, 15, 13, STONE[2]);
    speckle(im, r, STONE[1], 0.14);
    speckle(im, r, STONE[3], 0.07);
    im.rect(0, 9, 15, 9, STONE[1]);
    for (const x of [3, 10]) im.rect(x, 6, x, 8, STONE[1]);
    for (const x of [0, 6, 13]) im.rect(x, 10, x, 13, STONE[1]);
    im.rect(0, 13, 15, 13, STONE[0]);
    im.rect(0, 14, 15, 14, STONE[0]);
  } else if (kind === 'v') {
    // Seen end on: a narrow wall running away, its top a lighter strip.
    im.rect(5, 0, 10, 15, STONE[2]);
    im.rect(5, 0, 7, 15, STONE[3]);
    im.rect(9, 0, 10, 15, STONE[1]);
    for (const y of [3, 8, 13]) im.rect(5, y, 10, y, STONE[1]);
    speckle(im, r, STONE[0], 0.05);
    im.rect(5, 15, 10, 15, STONE[0]);
  } else {
    // A pier: taller than the wall, with a capstone.
    im.rect(4, 1, 11, 2, STONE[3]);
    im.rect(3, 3, 12, 14, STONE[2]);
    im.rect(3, 3, 4, 14, STONE[3]);
    im.rect(11, 3, 12, 14, STONE[1]);
    for (const y of [6, 10]) im.rect(3, y, 12, y, STONE[1]);
    im.rect(7, 3, 7, 5, STONE[1]);
    im.rect(8, 7, 8, 9, STONE[1]);
    im.rect(3, 14, 12, 14, STONE[0]);
  }
  return toSprite(`tile.wall_stone_${kind}`, 'core', ORIGIN_TILE, { base: im });
}

/** Barley: a patch of upright stalks with heavy golden heads, drawn over the field's earth. */
function barley(v: number): SpriteDef {
  const r = rng(760 + v);
  const im = new Img(16, 16);
  const stalks = v === 0 ? [2, 5, 8, 11, 14] : [1, 4, 7, 10, 13];
  for (const x of stalks) {
    const top = 3 + Math.floor(r() * 4);
    im.rect(x, top + 2, x, 14, FOLIAGE[2]);
    if (x + 1 < 16) im.set(x + 1, 12, FOLIAGE[1]);
    // The head: a short ear with awns.
    im.rect(x, top, x, top + 2, STRAW[2]);
    im.set(x, top, STRAW[3]);
    if (x > 0) im.set(x - 1, top + 1, STRAW[1]);
    if (x + 1 < 16) im.set(x + 1, top + 1, STRAW[1]);
  }
  return toSprite(`tile.crop_barley_${v}`, 'core', ORIGIN_TILE, { base: im });
}

/** A hay bale: a tied block of straw. */
function hayBale(): SpriteDef {
  const im = new Img(16, 16);
  im.rect(2, 5, 13, 14, STRAW[2]);
  im.rect(2, 5, 13, 6, STRAW[3]);
  im.rect(2, 5, 3, 14, STRAW[3]);
  im.rect(12, 6, 13, 14, STRAW[1]);
  im.rect(2, 13, 13, 14, STRAW[1]);
  // Straw lines, and two twine bands.
  for (const [x, y] of [
    [5, 8],
    [9, 10],
    [6, 12],
    [10, 7],
  ] as const)
    im.rect(x, y, x + 2, y, STRAW[1]);
  im.rect(5, 5, 5, 14, WOOD[1]);
  im.rect(10, 5, 10, 14, WOOD[1]);
  return toSprite('tile.hay_bale', 'core', ORIGIN_TILE, { base: outlined(im) });
}

/** Reeds: tall stems with a cattail head, two clumps. */
function reeds(v: number): SpriteDef {
  const r = rng(780 + v);
  const im = new Img(16, 16);
  const stems = v === 0 ? [3, 7, 11] : [4, 8, 12];
  for (const x of stems) {
    const top = 1 + Math.floor(r() * 4);
    im.rect(x, top, x, 14, FOLIAGE[1]);
    im.rect(x + 1, top + 3, x + 1, 14, FOLIAGE[2]);
    if (x % 8 !== 0) im.rect(x - 2, 6 + (x % 3), x - 1, 7 + (x % 3), FOLIAGE[2]);
    // The cattail head, brown, on the tallest.
    if (x === stems[1]) {
      im.rect(x, top, x + 1, top + 3, WOOD[1]);
      im.set(x, top, WOOD[0]);
    }
  }
  im.rect(1, 14, 14, 14, FOLIAGE[0]);
  return toSprite(`tile.reeds_${v}`, 'core', ORIGIN_TILE, { base: im });
}

/** Every sprite of Dawnmeadow's own art. */
export function dawnmeadowSprites(): SpriteDef[] {
  return [
    ...([0, 1] as const).flatMap((row) =>
      (['l', 'm', 'r'] as const).map((col) => thatch(row, col)),
    ),
    timber('plain'),
    timber('window'),
    timber('door'),
    stoneWall('h'),
    stoneWall('v'),
    stoneWall('post'),
    barley(0),
    barley(1),
    hayBale(),
    reeds(0),
    reeds(1),
  ];
}
