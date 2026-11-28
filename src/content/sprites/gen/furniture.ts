import { PIECES, type PieceDef } from '../../furniture/pieces';
import type { SpriteDef } from '../types';
import { Img, outlined, toSprite } from './img';
import {
  CREAM,
  FIRE,
  GOLD,
  LEAF,
  RUST,
  STEEL,
  STONE,
  WATER,
  WOOD,
  ROSE,
  SIZE,
  VIOLET,
  disc,
  icon,
  line,
} from './iconKit';

/**
 * Furniture art (POW-M6-07). Each piece is drawn once at its footprint, 16 px a tile, and the item
 * icon is that drawing sampled down to 12 x 12. Feet on the bottom row, centred on the footprint.
 */
const T = 16;

type Art = (im: Img, w: number, h: number) => void;

const ART: Readonly<Record<string, Art>> = {
  straw_bed: (im, w, h) => {
    im.rect(2, 2, w - 3, h - 2, WOOD[1]);
    im.rect(3, 3, w - 4, h - 4, CREAM[2]);
    im.rect(3, 3, w - 4, 8, CREAM[3]);
    im.rect(3, 12, w - 4, h - 8, GOLD[2]);
    im.rect(3, h - 12, w - 4, h - 7, ROSE[2]);
    im.rect(2, h - 4, w - 3, h - 2, WOOD[2]);
  },
  small_chest: (im, w, h) => {
    im.rect(2, 6, w - 3, h - 2, WOOD[2]);
    im.rect(2, 4, w - 3, 7, WOOD[3]);
    im.rect(2, 9, w - 3, 9, WOOD[1]);
    im.rect(7, 8, 8, 11, GOLD[3]);
  },
  stool: (im, w, h) => {
    im.rect(3, 5, w - 4, 8, WOOD[3]);
    im.rect(4, 8, w - 5, 9, WOOD[1]);
    im.rect(4, 10, 5, h - 2, WOOD[2]);
    im.rect(w - 6, 10, w - 5, h - 2, WOOD[2]);
    im.rect(7, 10, 8, h - 3, WOOD[1]);
  },
  small_table: (im, w, h) => {
    im.rect(2, 4, w - 3, 8, WOOD[3]);
    im.rect(2, 9, w - 3, 10, WOOD[1]);
    im.rect(4, 11, 5, h - 2, WOOD[2]);
    im.rect(w - 6, 11, w - 5, h - 2, WOOD[2]);
  },
  candle: (im, w, h) => {
    im.rect(6, 7, 9, h - 3, CREAM[3]);
    im.rect(6, 7, 6, h - 3, CREAM[2]);
    im.rect(4, h - 3, 11, h - 2, STONE[2]);
    im.rect(7, 3, 8, 6, FIRE[2]);
    im.set(7, 2, FIRE[3]);
    im.set(7, 4, GOLD[3]);
  },
  lantern: (im, w, h) => {
    im.rect(5, 3, 10, 4, STEEL[1]);
    im.rect(4, 5, 11, h - 4, GOLD[2]);
    im.rect(6, 6, 9, h - 5, GOLD[3]);
    im.rect(4, h - 3, 11, h - 2, STEEL[0]);
    line(im, 5, 5, 5, h - 4, STEEL[1]);
    line(im, 10, 5, 10, h - 4, STEEL[1]);
  },
  rug_red: (im, w, h) => {
    im.rect(1, 1, w - 2, h - 2, ROSE[1]);
    im.rect(3, 3, w - 4, h - 4, ROSE[3]);
    im.rect(6, 6, w - 7, h - 7, CREAM[2]);
    for (let x = 2; x < w - 2; x += 4) im.set(x, 2, CREAM[3]);
  },
  rug_blue: (im, w, h) => {
    im.rect(1, 1, w - 2, h - 2, WATER[0]);
    im.rect(3, 3, w - 4, h - 4, WATER[2]);
    for (let y = 5; y < h - 4; y += 4) line(im, 4, y, w - 5, y, WATER[3]);
    for (let x = 2; x < w - 2; x += 4) im.set(x, 2, CREAM[3]);
  },
  potted_fern: (im, w, h) => {
    im.rect(4, 10, 11, h - 2, RUST[1]);
    im.rect(3, 9, 12, 10, RUST[2]);
    for (const [x, y] of [
      [4, 4],
      [7, 2],
      [10, 4],
      [3, 7],
      [11, 7],
    ] as const)
      line(im, 7, 9, x, y, LEAF[2]);
    im.set(7, 2, LEAF[3]);
  },
  mirror: (im, w, h) => {
    im.rect(3, 1, w - 4, h - 2, WOOD[2]);
    im.rect(4, 2, w - 5, h - 3, STEEL[3]);
    im.rect(5, 3, 6, 5, CREAM[3]);
  },
  clock: (im) => {
    disc(im, 7, 7, 6, WOOD);
    disc(im, 7, 7, 4, CREAM);
    line(im, 7, 7, 7, 3, STONE[0]);
    line(im, 7, 7, 10, 7, STONE[0]);
    im.set(7, 7, FIRE[1]);
  },
  wardrobe: (im, w, h) => {
    im.rect(2, 3, w - 3, h - 2, WOOD[2]);
    im.rect(2, 2, w - 3, 3, WOOD[3]);
    im.rect(4, 5, 7, h - 5, WOOD[1]);
    im.rect(8, 5, w - 5, h - 5, WOOD[1]);
    im.set(7, h >> 1, GOLD[3]);
    im.set(8, h >> 1, GOLD[3]);
    im.rect(3, h - 2, 5, h - 1, VIOLET[0]);
  },
};

function draw(p: PieceDef, turned = false): Img {
  const w = (turned ? p.h : p.w) * T;
  const h = (turned ? p.w : p.h) * T;
  const im = new Img(w, h);
  (ART[p.id] as Art)(im, w, h);
  return im;
}

/** The drawing sampled to a 12 x 12 icon, nearest pixel, centred. */
function iconOf(p: PieceDef): SpriteDef {
  const src = draw(p);
  return icon(`furn_${p.id}`, (im) => {
    const k = Math.max(src.w, src.h) / SIZE;
    const ox = Math.floor((SIZE - src.w / k) / 2);
    const oy = Math.floor((SIZE - src.h / k) / 2);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const c = src.get(Math.floor((x - ox) * k), Math.floor((y - oy) * k));
        if (c !== null && x >= ox && y >= oy) im.set(x, y, c);
      }
  });
}

export function furnitureSprites(): SpriteDef[] {
  return PIECES.flatMap((p) => {
    // `closed` is the storage frame the world asks for; every other fixture asks for `base`.
    const sprite = (turned: boolean): SpriteDef => {
      const im = outlined(draw(p, turned));
      return toSprite(`furn.${p.id}${turned ? '_s' : ''}`, 'core', [im.w >> 1, im.h - 1], {
        base: im,
        closed: im,
      });
    };
    return [sprite(false), ...(p.w !== p.h ? [sprite(true)] : []), iconOf(p)];
  });
}
