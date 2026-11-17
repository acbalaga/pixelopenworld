import type { SpriteDef } from '../types';
import { Img, toSprite } from './img';

/**
 * Item icons, 12 x 12, from shape templates and ramps (art bible: generators multiply bases).
 * Light from the top left. A 1 px outline in the darkest neutral keeps them readable on any
 * slot color. Each icon is one frame, `base`.
 */
const SIZE = 12;
const OUT = 0;

type Ramp = readonly [number, number, number, number];

const METAL: Ramp = [28, 29, 30, 31];
const RUST: Ramp = [20, 4, 5, 6];
const WOOD: Ramp = [4, 5, 6, 7];
const LEAF: Ramp = [8, 9, 10, 11];
const FIRE: Ramp = [20, 21, 22, 23];
const WATER: Ramp = [12, 13, 14, 15];
const VIOLET: Ramp = [24, 25, 26, 27];
const STONE: Ramp = [16, 17, 18, 19];
const GOLD: Ramp = [44, 45, 46, 47];
const ROSE: Ramp = [40, 41, 42, 43];
const CREAM: Ramp = [4, 44, 45, 46];

function line(im: Img, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    im.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c);
  }
}

/** A shaded disc: shadow bottom right, highlight top left. */
function disc(im: Img, cx: number, cy: number, r: number, ramp: Ramp): void {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r + r * 0.6) continue;
      const lit = dx + dy;
      im.set(x, y, lit < -r * 0.6 ? ramp[3] : lit > r * 0.5 ? ramp[1] : ramp[2]);
    }
}

/** 1 px outline around everything drawn, painted only on empty pixels. */
function outline(im: Img): Img {
  const out = new Img(im.w, im.h);
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      const c = im.get(x, y);
      if (c !== null) {
        out.set(x, y, c);
        continue;
      }
      const near = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => im.get(x + (dx as number), y + (dy as number)) !== null);
      if (near) out.set(x, y, OUT);
    }
  return out;
}

function icon(name: string, draw: (im: Img) => void): SpriteDef {
  const im = new Img(SIZE, SIZE);
  draw(im);
  return toSprite(`icon.${name}`, 'ui', [0, 0], { base: outline(im) });
}

function sword(name: string, blade: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 9, 2, 4, 7, blade[2]);
    line(im, 10, 3, 5, 8, blade[1]);
    line(im, 8, 2, 4, 6, blade[3]);
    line(im, 3, 6, 6, 9, WOOD[2]);
    line(im, 4, 8, 2, 10, WOOD[1]);
  });
}

function tunic(name: string, c: Ramp, sleeves = true): SpriteDef {
  return icon(name, (im) => {
    im.rect(3, 2, 8, 9, c[2]);
    im.rect(3, 2, 4, 9, c[3]);
    im.rect(7, 4, 8, 9, c[1]);
    if (sleeves) {
      im.rect(1, 2, 2, 5, c[2]);
      im.rect(9, 2, 10, 5, c[1]);
    }
    im.rect(5, 2, 6, 3, c[0]);
  });
}

function dish(name: string, food: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(2, 7, 9, 8, STONE[3]);
    im.rect(3, 9, 8, 9, STONE[2]);
    im.rect(3, 5, 8, 6, food[2]);
    im.rect(3, 5, 5, 5, food[3]);
    im.set(6, 3, STONE[3]);
    im.set(7, 2, STONE[3]);
  });
}

function berries(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 6, 1, 6, 4, LEAF[2]);
    im.set(7, 2, LEAF[3]);
    disc(im, 4, 7, 2, c);
    disc(im, 8, 7, 2, c);
    disc(im, 6, 8, 2, c);
  });
}

function herb(name: string, leaf: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 6, 10, 6, 4, LEAF[1]);
    im.rect(3, 4, 5, 5, leaf[2]);
    im.rect(7, 3, 9, 4, leaf[3]);
    im.rect(4, 7, 5, 8, leaf[3]);
    im.rect(7, 6, 8, 7, leaf[2]);
    im.set(6, 2, leaf[3]);
  });
}

export const ITEM_ICONS: readonly SpriteDef[] = [
  sword('sword_rusty', RUST),
  sword('sword_iron', METAL),
  icon('spear_ash', (im) => {
    line(im, 2, 10, 8, 4, WOOD[2]);
    line(im, 3, 10, 9, 4, WOOD[1]);
    im.rect(8, 1, 10, 3, METAL[3]);
    im.set(10, 1, METAL[2]);
    im.set(8, 3, METAL[1]);
  }),
  icon('shield_wood', (im) => {
    im.rect(2, 2, 9, 8, WOOD[2]);
    im.rect(3, 9, 8, 9, WOOD[1]);
    im.rect(4, 10, 7, 10, WOOD[1]);
    im.rect(2, 2, 9, 2, METAL[2]);
    im.rect(5, 3, 6, 9, METAL[1]);
    im.rect(2, 2, 3, 6, WOOD[3]);
  }),
  tunic('outfit_wayfarer', WATER),
  tunic('outfit_leather', WOOD),
  icon('outfit_scholar', (im) => {
    im.rect(3, 2, 8, 10, VIOLET[2]);
    im.rect(3, 2, 4, 10, VIOLET[3]);
    im.rect(7, 4, 8, 10, VIOLET[1]);
    im.rect(1, 3, 2, 7, VIOLET[2]);
    im.rect(9, 3, 10, 7, VIOLET[1]);
    im.rect(5, 2, 6, 5, VIOLET[0]);
    im.rect(5, 8, 6, 8, GOLD[2]);
  }),
  icon('cap_wool', (im) => {
    disc(im, 6, 6, 4, ROSE);
    im.rect(1, 7, 10, 9, ROSE[1]);
    im.rect(2, 7, 4, 8, ROSE[3]);
    disc(im, 6, 1, 1, ROSE);
  }),
  icon('ring_copper', (im) => {
    disc(im, 6, 7, 3, FIRE);
    im.rect(5, 6, 7, 8, null);
    disc(im, 6, 3, 1, GOLD);
  }),
  herb('sunwort', GOLD),
  herb('dewmint', LEAF),
  berries('berry_red', FIRE),
  berries('berry_blue', WATER),
  icon('raw_meat', (im) => {
    disc(im, 6, 6, 3, ROSE);
    im.rect(3, 5, 8, 6, ROSE[2]);
    im.rect(4, 5, 5, 5, CREAM[3]);
    line(im, 8, 8, 10, 10, CREAM[3]);
    im.set(10, 9, CREAM[3]);
    im.set(9, 10, CREAM[3]);
  }),
  icon('moss_tuft', (im) => {
    im.rect(2, 6, 9, 9, LEAF[2]);
    im.rect(3, 4, 5, 6, LEAF[3]);
    im.rect(6, 3, 8, 6, LEAF[2]);
    im.rect(2, 9, 9, 9, LEAF[1]);
    im.set(4, 7, LEAF[3]);
  }),
  icon('seed_pod', (im) => {
    disc(im, 6, 6, 3, WOOD);
    im.rect(5, 3, 6, 9, WOOD[1]);
    im.set(6, 1, LEAF[2]);
    line(im, 6, 1, 6, 3, LEAF[1]);
  }),
  icon('boar_hide', (im) => {
    im.rect(2, 3, 9, 8, WOOD[1]);
    im.rect(2, 3, 5, 5, WOOD[2]);
    im.rect(1, 5, 1, 6, WOOD[1]);
    im.rect(10, 6, 10, 7, WOOD[1]);
    im.rect(4, 9, 7, 9, WOOD[1]);
    im.set(7, 5, WOOD[3]);
  }),
  dish('herb_tea', LEAF),
  dish('berry_compote', VIOLET),
  icon('herbed_skewer', (im) => {
    line(im, 1, 10, 10, 1, WOOD[3]);
    disc(im, 4, 7, 1, ROSE);
    disc(im, 6, 5, 1, LEAF);
    disc(im, 8, 3, 1, ROSE);
    im.rect(3, 7, 5, 8, ROSE[2]);
  }),
  dish('hearty_stew', FIRE),
  icon('dish_bread', (im) => {
    im.rect(2, 4, 9, 8, GOLD[2]);
    im.rect(3, 3, 8, 3, GOLD[2]);
    im.rect(2, 4, 5, 5, GOLD[3]);
    im.rect(2, 8, 9, 8, GOLD[1]);
    line(im, 4, 4, 5, 6, GOLD[1]);
    line(im, 7, 4, 8, 6, GOLD[1]);
  }),
  icon('honey_cake', (im) => {
    im.rect(2, 6, 9, 9, GOLD[1]);
    im.rect(2, 4, 9, 6, GOLD[3]);
    im.rect(2, 4, 4, 5, CREAM[3]);
    im.rect(5, 3, 6, 4, FIRE[2]);
    im.set(5, 2, GOLD[3]);
  }),
  icon('coin', (im) => {
    disc(im, 6, 6, 4, GOLD);
    im.rect(5, 4, 6, 8, GOLD[1]);
  }),
  icon('burnt_mess', (im) => {
    disc(im, 6, 7, 3, STONE);
    im.rect(3, 6, 8, 8, STONE[0]);
    im.rect(3, 6, 4, 6, STONE[1]);
    im.set(5, 3, STONE[2]);
    im.set(6, 2, STONE[3]);
  }),
  icon('old_key', (im) => {
    disc(im, 4, 4, 2, GOLD);
    im.set(4, 4, null);
    line(im, 5, 5, 10, 10, GOLD[2]);
    im.rect(8, 9, 9, 9, GOLD[2]);
    im.rect(10, 8, 10, 8, GOLD[2]);
  }),
  icon('river_pebble', (im) => {
    disc(im, 6, 7, 3, STONE);
    im.rect(3, 6, 8, 8, STONE[2]);
    im.rect(3, 6, 4, 6, STONE[3]);
  }),
  icon('crow_feather', (im) => {
    line(im, 2, 10, 9, 2, [0, 1, 17, 17][2] as number);
    line(im, 3, 10, 9, 3, [0, 1, 17, 17][1] as number);
    line(im, 4, 9, 8, 4, WATER[1]);
    im.rect(8, 1, 10, 3, [0, 1, 17, 17][2] as number);
    im.set(9, 2, WATER[1]);
  }),
  icon('bone_shard', (im) => {
    line(im, 2, 9, 9, 2, CREAM[3]);
    line(im, 3, 9, 9, 3, CREAM[2]);
    im.rect(1, 9, 3, 10, CREAM[3]);
    im.rect(8, 1, 10, 2, CREAM[3]);
  }),
  icon('lantern_oil', (im) => {
    im.rect(4, 2, 7, 3, WOOD[2]);
    im.rect(3, 4, 8, 9, WATER[2]);
    im.rect(3, 4, 4, 9, WATER[3]);
    im.rect(7, 4, 8, 9, WATER[1]);
    im.rect(4, 7, 7, 9, GOLD[2]);
  }),
  icon('worn_map', (im) => {
    im.rect(2, 2, 9, 9, CREAM[2]);
    im.rect(2, 2, 9, 2, CREAM[3]);
    im.rect(2, 9, 9, 9, CREAM[1]);
    line(im, 3, 7, 5, 4, FIRE[2]);
    line(im, 5, 4, 8, 6, FIRE[2]);
    im.set(8, 6, FIRE[1]);
  }),
];
