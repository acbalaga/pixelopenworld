import { CROP_LIST, type CropDef } from '../../farming/crops';
import type { SpriteDef } from '../types';
import { Img, outlined, rng, toSprite } from './img';
import { SEED_TOP } from './farmIcons';
import { LEAF, WOOD, disc, line, type Ramp } from './iconKit';

/**
 * Crops in the ground (POW-M6-02). Each crop has `crop.<name>` with four 16 x 16 frames, one per
 * stage (`stage_0` seed, `stage_1` sprout, `stage_2` young, `stage_3` ripe), feet on the bottom
 * row. A plot draws one plant on each of its six tiles. The form comes from the crop's family and
 * the ripe color from the crop. Pumpkin and sweet melon have a 32 x 32 giant. `plot.soil` is the
 * tilled earth of a 2 x 3 tile plot, dry and wet.
 */

const ORIGIN: readonly [number, number] = [8, 15];
const GREEN: Ramp = LEAF;
const PALE: Ramp = [16, 2, 3, 3];

/** A small mound of turned earth with the seed showing. */
function seedStage(): Img {
  const im = new Img(16, 16);
  im.rect(5, 13, 10, 14, WOOD[1]);
  im.rect(6, 12, 9, 12, WOOD[2]);
  im.set(7, 12, WOOD[3]);
  return im;
}

/** Two leaves on a short stem. */
function sproutStage(r: () => number): Img {
  const im = new Img(16, 16);
  line(im, 8, 14, 8, 11, GREEN[1]);
  im.rect(5, 10, 7, 11, GREEN[2]);
  im.rect(9, 9, 11, 10, GREEN[3]);
  if (r() < 0.5) im.set(6, 9, GREEN[3]);
  return im;
}

/** The plant's form at `stage` 2 (green) or 3 (ripe, in the crop's color). */
function grown(c: CropDef, ripe: boolean, r: () => number): Img {
  const im = new Img(16, 16);
  const col = SEED_TOP[c.id] ?? GREEN;
  switch (c.family) {
    case 'root': {
      for (let k = -2; k <= 2; k++)
        line(im, 8, 12, 8 + k * 2, 5 + Math.abs(k), GREEN[2 + (k & 1)] as number);
      if (ripe) {
        im.rect(6, 12, 10, 14, col[2]);
        im.rect(6, 12, 7, 12, col[3]);
      } else im.rect(7, 13, 9, 14, GREEN[1]);
      break;
    }
    case 'leaf': {
      if (c.id === 'crop.leek') {
        // Leeks stand as white stalks under green flags.
        for (const x of [5, 8, 11]) {
          im.rect(x, 9, x + 1, 14, ripe ? PALE[3] : GREEN[3]);
          line(im, x, 9, x - 1, 4, GREEN[2]);
          line(im, x + 1, 9, x + 2, 4, GREEN[1]);
        }
        break;
      }
      // A rosette: blades from the heart, the crop's color when ripe.
      const leafC = ripe ? col : GREEN;
      const n = ripe ? 3 : 2;
      for (let k = -n; k <= n; k++) {
        const tx = 8 + k * 2;
        const ty = 7 + Math.abs(k);
        line(im, 8, 13, tx, ty, leafC[2]);
        line(im, 8, 14, tx + (k < 0 ? 1 : -1), ty + 1, leafC[k % 2 === 0 ? 3 : 1] as number);
      }
      if (ripe) im.rect(7, 10, 9, 13, leafC[3]);
      break;
    }
    case 'grain': {
      for (const x of [5, 8, 11]) {
        line(im, x, 14, x, ripe ? 4 : 7, GREEN[1]);
        if (ripe) im.rect(x - 1, 3 + (x % 2), x, 6 + (x % 2), col[2]);
        else im.rect(x, 6, x + 1, 7, GREEN[3]);
      }
      break;
    }
    case 'fruit': {
      disc(im, 8, 10, 4, GREEN);
      if (ripe)
        for (const [x, y] of [
          [6, 9],
          [10, 10],
          [8, 12],
        ] as const) {
          im.rect(x - 1, y - 1, x, y, col[2]);
          im.set(x - 1, y - 1, col[3]);
        }
      break;
    }
    case 'herb': {
      for (const x of [4, 8, 12]) {
        line(im, 8, 14, x, 5, GREEN[2]);
        const mx = Math.round((8 + x) / 2);
        const ly = 9 + (r() < 0.5 ? 0 : 1);
        im.rect(mx - 1, ly, mx, ly, GREEN[3]);
        if (ripe) {
          im.rect(x - 1, 3, x, 4, col[2]);
          im.set(x - 1, 3, col[3]);
        } else im.set(x, 4, GREEN[3]);
      }
      break;
    }
  }
  return im;
}

function cropSprite(c: CropDef, i: number): SpriteDef {
  const r = rng(6200 + i);
  return toSprite(c.id, 'core', ORIGIN, {
    stage_0: outlined(seedStage()),
    stage_1: outlined(sproutStage(r)),
    stage_2: outlined(grown(c, false, r)),
    stage_3: outlined(grown(c, true, r)),
  });
}

/** A giant crop: one fruit two tiles across, with ribs or stripes. */
function giant(id: string, c: Ramp, mark: 'ribs' | 'stripes'): SpriteDef {
  const im = new Img(32, 32);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const dx = (x - 16) / 14;
      const dy = (y - 18) / 12;
      if (dx * dx + dy * dy > 1) continue;
      const lit = dx + dy;
      im.set(x, y, lit < -0.6 ? c[3] : lit > 0.5 ? c[1] : c[2]);
    }
  if (mark === 'ribs') for (const x of [8, 13, 19, 24]) line(im, x, 8, x, 29, c[1]);
  else for (let k = -2; k <= 2; k++) line(im, 10 + k * 5, 7, 14 + k * 5, 29, LEAF[1]);
  im.rect(15, 3, 16, 7, WOOD[1]);
  im.rect(17, 4, 20, 5, LEAF[2]);
  return toSprite(id, 'core', [16, 31], { base: outlined(im) });
}

/** The tilled earth of one plot (2 x 3 tiles): furrows, dry and wet. Drawn from its top left. */
function soil(): SpriteDef {
  const frame = (wet: boolean): Img => {
    const im = new Img(32, 48);
    const dark = wet ? 32 : WOOD[0];
    const mid = wet ? 4 : WOOD[1];
    im.rect(1, 1, 30, 46, mid);
    for (let y = 3; y < 46; y += 4) im.rect(2, y, 29, y, dark);
    for (let y = 4; y < 46; y += 4) im.rect(2, y, 29, y, wet ? 5 : WOOD[2]);
    return im;
  };
  return toSprite('plot.soil', 'core', [0, 0], { dry: frame(false), wet: frame(true) });
}

export function cropSprites(): SpriteDef[] {
  return [
    ...CROP_LIST.map(cropSprite),
    giant('crop.giant_pumpkin', [20, 21, 22, 23], 'ribs'),
    giant('crop.giant_melon', [8, 10, 11, 11], 'stripes'),
    soil(),
  ];
}
