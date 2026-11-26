import type { SpriteDef } from '../types';
import { Img, outlined, toSprite } from '../gen/img';

/**
 * Giver marks (POW-M4-22D): a 7 x 9 speech bubble over a person who has work for you. `offer` is
 * a light bubble with a "?", `ready` a gold one with a tick, `rest` a light one with a "z" over a rest point. Drawn with the darkest neutral
 * outline so both read at 1x on a phone. The origin is the bottom middle, where the tail ends.
 */
const OUTLINE = 0;
const GLYPH = 16;
const GLYPH_READY = 8;
const LIGHT = 3;
const GOLD = 23;

function bubble(
  fill: number,
  glyph: number,
  glyphPixels: readonly (readonly [number, number])[],
): Img {
  const im = new Img(7, 9);
  // The body: a 7 x 7 rounded box.
  im.rect(1, 0, 5, 0, OUTLINE);
  im.rect(0, 1, 6, 5, OUTLINE);
  im.rect(1, 1, 5, 5, fill);
  im.rect(1, 6, 2, 6, OUTLINE);
  im.set(3, 6, fill);
  im.rect(4, 6, 5, 6, OUTLINE);
  // The tail.
  im.set(2, 7, OUTLINE);
  im.set(3, 7, fill);
  im.set(4, 7, OUTLINE);
  im.set(3, 8, OUTLINE);
  for (const [x, y] of glyphPixels) im.set(x, y, glyph);
  return im;
}

const QUESTION = [
  [2, 1],
  [3, 1],
  [4, 1],
  [4, 2],
  [3, 3],
  [3, 5],
] as const;
const TICK = [
  [2, 3],
  [3, 4],
  [4, 3],
  [5, 2],
] as const;

/** A "z": a rest point, a place to bed down (POW-M5-25). */
const ZZZ = [
  [2, 1],
  [3, 1],
  [4, 1],
  [4, 2],
  [3, 3],
  [2, 4],
  [2, 5],
  [3, 5],
  [4, 5],
] as const;

/** A small floating "z" over a Traveler who is asleep (POW-M5-31): 3 x 5 ink, outlined. */
const SNORE_Z = [
  [1, 1],
  [2, 1],
  [3, 1],
  [3, 2],
  [2, 3],
  [1, 4],
  [1, 5],
  [2, 5],
  [3, 5],
] as const;
function snore(): Img {
  const im = new Img(5, 7);
  for (const [x, y] of SNORE_Z) im.set(x, y, LIGHT);
  return outlined(im);
}

export const MARK_SPRITES: readonly SpriteDef[] = [
  toSprite('ui.mark_snore', 'ui', [2, 7], { base: snore() }),
  toSprite('ui.mark_offer', 'ui', [3, 9], { base: bubble(LIGHT, GLYPH, QUESTION) }),
  toSprite('ui.mark_rest', 'ui', [3, 9], { base: bubble(LIGHT, GLYPH, ZZZ) }),
  toSprite('ui.mark_ready', 'ui', [3, 9], { base: bubble(GOLD, GLYPH_READY, TICK) }),
];
