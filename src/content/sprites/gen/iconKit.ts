import type { SpriteDef } from '../types';
import { Img, toSprite } from './img';

/**
 * Shared pieces of the item icon generators (12 x 12, light from the top left, a 1 px outline in
 * the darkest neutral). `items.ts` and `itemsDistinct.ts` both draw with these.
 */
export const SIZE = 12;
export const OUT = 0;

export type Ramp = readonly [number, number, number, number];

export const METAL: Ramp = [28, 29, 30, 31];
export const RUST: Ramp = [20, 4, 5, 6];
export const WOOD: Ramp = [4, 5, 6, 7];
export const LEAF: Ramp = [8, 9, 10, 11];
export const FIRE: Ramp = [20, 21, 22, 23];
export const WATER: Ramp = [12, 13, 14, 15];
export const VIOLET: Ramp = [24, 25, 26, 27];
export const STONE: Ramp = [16, 17, 18, 19];
export const GOLD: Ramp = [44, 45, 46, 47];
export const ROSE: Ramp = [40, 41, 42, 43];
export const CREAM: Ramp = [4, 44, 45, 46];
export const COPPER: Ramp = [4, 21, 22, 23];
export const STEEL: Ramp = [28, 30, 31, 3];
export const BRONZE: Ramp = [44, 5, 45, 46];
export const LEATHER: Ramp = [4, 5, 6, 7];
export const SILK: Ramp = [40, 41, 42, 43];

export function line(im: Img, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    im.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c);
  }
}

/** A shaded disc: shadow bottom right, highlight top left. */
export function disc(im: Img, cx: number, cy: number, r: number, ramp: Ramp): void {
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
export function outline(im: Img): Img {
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

export function icon(name: string, draw: (im: Img) => void): SpriteDef {
  const im = new Img(SIZE, SIZE);
  draw(im);
  return toSprite(`icon.${name}`, 'ui', [0, 0], { base: outline(im) });
}
