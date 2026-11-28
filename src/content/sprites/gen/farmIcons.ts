import { CROP_LIST } from '../../farming/crops';
import type { SpriteDef } from '../types';
import type { Img } from './img';
import {
  CREAM,
  FIRE,
  GOLD,
  LEAF,
  METAL,
  ROSE,
  STONE,
  VIOLET,
  WATER,
  WOOD,
  disc,
  icon,
  line,
  type Ramp,
} from './iconKit';

/**
 * Farming icons (POW-M6-02): every new crop, every seed, compost, the hoe and the watering can.
 * 12 x 12, light from the top left, outlined after. Crops are drawn by shape (bulb, root, pod,
 * head, ear, fruit, cluster) and told apart by shape and color. A seed is a paper packet in two
 * colors: the crop's above, a band below, so no two packets share both.
 */

const PALE: Ramp = [16, 2, 3, 3];
const PEACH: Ramp = [36, 37, 38, 39];
const DEEP: Ramp = [32, 33, 34, 35];
const OCHRE: Ramp = GOLD;

const name = (item: string): string => item.replace(/^item\./, '');

/** Leaves on top of a root: a fan of three blades. */
function tops(im: Img, x: number, y: number, c: Ramp = LEAF): void {
  line(im, x, y, x - 2, y - 3, c[2]);
  line(im, x, y, x, y - 4, c[3]);
  line(im, x, y, x + 2, y - 3, c[1]);
}

/** A round root with tops: turnip, radish, beet, onion. `tip` draws the tail. */
function bulb(item: string, body: Ramp, crown: Ramp | null, tip: boolean, top: Ramp = LEAF) {
  return icon(name(item), (im) => {
    disc(im, 6, 7, 3, body);
    if (crown) im.rect(4, 4, 8, 5, crown[2]);
    if (tip) line(im, 6, 10, 6, 11, body[1]);
    tops(im, 6, 4, top);
  });
}

/** Radish: a small round root high up with a long thin tail. */
function radish(item: string, body: Ramp) {
  return icon(name(item), (im) => {
    disc(im, 5, 6, 2, body);
    im.rect(3, 5, 7, 7, body[2]);
    im.rect(3, 5, 4, 5, body[3]);
    line(im, 6, 8, 9, 11, PALE[2]);
    tops(im, 5, 3);
    im.rect(8, 1, 10, 2, LEAF[3]);
  });
}

/** A long root pointing down: carrot, frostroot. */
function taper(item: string, body: Ramp, top: Ramp = LEAF) {
  return icon(name(item), (im) => {
    for (let k = 0; k < 7; k++) {
      const w = Math.max(0, 2 - Math.floor(k / 3));
      im.rect(6 - w, 4 + k, 6 + w - (k > 4 ? 1 : 0), 4 + k, body[2]);
      im.set(6 - w, 4 + k, body[3]);
    }
    im.set(7, 7, body[1]);
    im.set(5, 9, body[1]);
    tops(im, 6, 3, top);
  });
}

/** A lumpy tuber with eyes: potato. */
function tuber(item: string, c: Ramp) {
  return icon(name(item), (im) => {
    im.rect(2, 4, 9, 8, c[2]);
    im.rect(3, 3, 8, 3, c[2]);
    im.rect(3, 9, 8, 9, c[1]);
    im.rect(3, 4, 5, 5, c[3]);
    for (const [x, y] of [
      [6, 5],
      [8, 7],
      [4, 7],
    ] as const)
      im.set(x, y, c[0]);
  });
}

/** A pod lying across: pea, bean, pepper. `beads` shows what is inside. */
function pod(item: string, c: Ramp, long: boolean, beads: Ramp | null) {
  return icon(name(item), (im) => {
    const x0 = long ? 1 : 2;
    const x1 = long ? 10 : 9;
    line(im, x0, 8, x1, 3, c[2]);
    line(im, x0, 9, x1, 4, c[1]);
    line(im, x0 + 1, 8, x1, 2, c[3]);
    if (!long) line(im, x0 + 1, 9, x1 - 1, 5, c[2]);
    if (beads) for (let k = 0; k < 3; k++) im.set(x0 + 2 + k * 2, 7 - k, beads[3]);
    im.rect(x1 + 1, 1, x1 + 1, 2, LEAF[2]);
  });
}

/** A hot pepper: a curved fat pod hanging from a stalk. */
function pepper(item: string, c: Ramp) {
  return icon(name(item), (im) => {
    im.rect(5, 1, 6, 2, LEAF[2]);
    im.rect(4, 3, 7, 3, LEAF[1]);
    im.rect(3, 4, 8, 6, c[2]);
    im.rect(4, 7, 8, 8, c[2]);
    im.rect(6, 9, 8, 9, c[2]);
    im.rect(8, 10, 8, 10, c[1]);
    im.rect(3, 4, 4, 6, c[3]);
    im.rect(8, 5, 8, 8, c[1]);
  });
}

/** A head of leaves: cabbage, kale, artichoke. `style` picks the leaf pattern. */
function head(item: string, c: Ramp, style: 'round' | 'frill' | 'scale') {
  return icon(name(item), (im) => {
    if (style === 'round') {
      disc(im, 6, 6, 4, c);
      line(im, 6, 3, 6, 9, c[1]);
      line(im, 3, 5, 6, 8, c[3]);
      line(im, 9, 5, 6, 8, c[1]);
    } else if (style === 'frill') {
      for (let k = 0; k < 4; k++) {
        const x = 2 + k * 2;
        line(im, 6, 11, x, 2 + (k % 2), c[1 + (k % 3)] as number);
        im.rect(x - 1, 1 + (k % 2), x + 1, 3 + (k % 2), c[2 + (k % 2)] as number);
      }
      line(im, 6, 11, 10, 3, c[2]);
    } else {
      for (let y = 2; y <= 9; y++) {
        const w = y < 6 ? y - 2 : 9 - y;
        im.rect(6 - w, y, 6 + w, y, c[(y % 2) + 1] as number);
      }
      for (let y = 3; y <= 8; y += 2) im.set(6, y, c[3]);
      im.rect(6, 10, 6, 11, LEAF[1]);
    }
  });
}

/** An ear of grain on a stalk: wheat, barley. `awns` gives barley its whiskers. */
function ear(item: string, c: Ramp, awns: boolean) {
  return icon(name(item), (im) => {
    line(im, 3, 11, 6, 6, LEAF[1]);
    for (let k = 0; k < 4; k++) {
      im.rect(5 + k, 5 - k, 6 + k, 6 - k, c[2]);
      im.set(5 + k, 4 - k, c[3]);
      im.set(7 + k, 6 - k, c[1]);
      if (awns) line(im, 5 + k, 4 - k, 3 + k, 2 - k, c[3]);
    }
    if (!awns) im.rect(9, 1, 10, 2, c[3]);
  });
}

/** A cob in its husk: corn. */
function cob(item: string, c: Ramp) {
  return icon(name(item), (im) => {
    im.rect(4, 2, 7, 9, c[2]);
    for (let y = 2; y <= 9; y += 2) im.rect(4, y, 7, y, c[3]);
    im.rect(4, 2, 4, 9, c[1]);
    line(im, 3, 4, 3, 10, LEAF[2]);
    line(im, 8, 4, 8, 10, LEAF[1]);
    line(im, 3, 10, 5, 11, LEAF[2]);
    line(im, 8, 10, 6, 11, LEAF[1]);
    im.rect(5, 0, 6, 1, OCHRE[3]);
  });
}

/** A round fruit: tomato, pumpkin, melon. `ribs` and `stripes` mark the skin. */
function fruit(item: string, c: Ramp, r: number, mark: 'star' | 'ribs' | 'stripes') {
  return icon(name(item), (im) => {
    if (mark === 'ribs') {
      im.rect(1, 5, 10, 9, c[2]);
      im.rect(2, 4, 9, 10, c[2]);
      im.rect(2, 4, 4, 6, c[3]);
      im.rect(2, 10, 9, 10, c[1]);
    } else disc(im, 6, 7, r, c);
    if (mark === 'ribs') for (const x of [4, 6, 8]) line(im, x, 4, x, 10, c[1]);
    if (mark === 'stripes')
      for (let k = -1; k <= 1; k++) line(im, 3 + k * 3, 4, 7 + k * 3, 10, LEAF[1]);
    if (mark === 'star') {
      im.rect(3, 4, 9, 4, LEAF[2]);
      im.rect(5, 3, 7, 5, LEAF[1]);
      im.rect(6, 1, 6, 2, LEAF[3]);
    } else im.rect(6, 2, 6, 3, WOOD[1]);
  });
}

/** A strawberry: a heart shape with seeds and a green cap. */
function berry(item: string, c: Ramp) {
  return icon(name(item), (im) => {
    for (let y = 4; y <= 10; y++) {
      const w = y < 7 ? 3 : 10 - y;
      im.rect(6 - w, y, 5 + w, y, c[2]);
    }
    im.rect(3, 4, 4, 6, c[3]);
    for (const [x, y] of [
      [4, 5],
      [7, 5],
      [5, 7],
      [7, 8],
    ] as const)
      im.set(x, y, OCHRE[3]);
    im.rect(4, 3, 7, 3, LEAF[2]);
    im.rect(5, 2, 6, 2, LEAF[3]);
  });
}

/** A cluster of small rounds on a vine: hops cones, honeygrapes. */
function cluster(item: string, c: Ramp, cones: boolean) {
  return icon(name(item), (im) => {
    line(im, 2, 1, 6, 3, WOOD[2]);
    const spots = [
      [5, 5],
      [8, 5],
      [4, 8],
      [7, 8],
      [6, 10],
    ] as const;
    for (const [x, y] of spots) {
      if (cones) {
        im.rect(x - 1, y - 1, x, y + 1, c[2]);
        im.set(x - 1, y - 1, c[3]);
        im.set(x, y + 1, c[1]);
      } else disc(im, x, y, 1, c);
    }
    im.rect(8, 1, 10, 2, LEAF[2]);
  });
}

/** Saffron: a violet crocus with red threads. */
function crocus(item: string) {
  return icon(name(item), (im) => {
    line(im, 6, 11, 6, 7, LEAF[2]);
    im.rect(3, 3, 9, 6, VIOLET[2]);
    im.rect(4, 2, 4, 2, VIOLET[3]);
    im.rect(8, 2, 8, 2, VIOLET[3]);
    im.rect(3, 3, 4, 5, VIOLET[3]);
    for (const x of [5, 6, 7]) line(im, x, 4, x - 1 + (x - 5), 0, FIRE[1]);
  });
}

/** A broad leaf on its stem: woad. */
function leaf(item: string, c: Ramp) {
  return icon(name(item), (im) => {
    for (let k = 0; k < 8; k++) {
      const w = k < 4 ? k : 7 - k;
      im.rect(5 - w, 2 + k, 6 + w, 2 + k, c[2]);
      im.set(5 - w, 2 + k, c[3]);
    }
    line(im, 6, 2, 6, 11, c[1]);
    im.set(4, 5, c[1]);
    im.set(8, 6, c[1]);
  });
}

/** Leek: a long white stem under green flags. */
function stalk(item: string) {
  return icon(name(item), (im) => {
    im.rect(5, 5, 7, 10, PALE[2]);
    im.rect(5, 5, 5, 10, PALE[3]);
    im.rect(7, 5, 7, 10, PALE[1]);
    line(im, 5, 11, 7, 11, WOOD[2]);
    line(im, 5, 5, 2, 0, LEAF[2]);
    line(im, 6, 5, 6, 0, LEAF[3]);
    line(im, 7, 5, 10, 1, LEAF[1]);
  });
}

/** Garlic: a teardrop bulb with clove lines. */
function garlic(item: string) {
  return icon(name(item), (im) => {
    disc(im, 6, 7, 3, CREAM);
    im.rect(5, 3, 7, 4, CREAM[2]);
    im.rect(6, 1, 6, 2, CREAM[1]);
    line(im, 5, 5, 4, 9, CREAM[1]);
    line(im, 7, 5, 8, 9, CREAM[1]);
    im.rect(4, 11, 8, 11, WOOD[1]);
  });
}

/** Each new crop item and how it is drawn. */
const CROP_ICONS: Readonly<Record<string, () => SpriteDef>> = {
  'item.turnip': () => bulb('item.turnip', PALE, VIOLET, true),
  'item.radish': () => radish('item.radish', ROSE),
  'item.beet': () => bulb('item.beet', [24, 40, 41, 42], null, true, FIRE),
  'item.onion': () => bulb('item.onion', DEEP, null, false, [8, 9, 9, 10]),
  'item.potato': () => tuber('item.potato', WOOD),
  'item.carrot': () => taper('item.carrot', FIRE),
  'item.frostroot': () => taper('item.frostroot', WATER, [16, 17, 18, 19]),
  'item.leek': () => stalk('item.leek'),
  'item.pea_pod': () => pod('item.pea_pod', LEAF, false, LEAF),
  'item.bean': () => pod('item.bean', [8, 9, 10, 10], true, null),
  'item.pepper': () => pepper('item.pepper', FIRE),
  'item.cabbage': () => head('item.cabbage', LEAF, 'round'),
  'item.kale': () => head('item.kale', [12, 8, 9, 15], 'frill'),
  'item.artichoke': () => head('item.artichoke', [8, 9, 10, 11], 'scale'),
  'item.wheat': () => ear('item.wheat', OCHRE, false),
  'item.barley': () => ear('item.barley', PEACH, true),
  'item.corn': () => cob('item.corn', OCHRE),
  'item.tomato': () => fruit('item.tomato', FIRE, 3, 'star'),
  'item.pumpkin': () => fruit('item.pumpkin', [20, 21, 22, 23], 4, 'ribs'),
  'item.melon': () => fruit('item.melon', [8, 10, 11, 11], 4, 'stripes'),
  'item.strawberry': () => berry('item.strawberry', [20, 21, 21, 40]),
  'item.hops': () => cluster('item.hops', LEAF, true),
  'item.honeygrape': () => cluster('item.honeygrape', OCHRE, false),
  'item.saffron': () => crocus('item.saffron'),
  'item.woad_leaf': () => leaf('item.woad_leaf', [12, 13, 9, 10]),
  'item.garlic': () => garlic('item.garlic'),
};

/** Ramps for a packet's lower band, taken in turn so no two packets share both halves. */
const BANDS: readonly Ramp[] = [WOOD, STONE, WATER, ROSE, VIOLET, METAL, OCHRE, FIRE, LEAF, PEACH];

/** The main color of each crop, for the top of its packet. */
export const SEED_TOP: Readonly<Record<string, Ramp>> = {
  'crop.turnip': VIOLET,
  'crop.radish': ROSE,
  'crop.potato': WOOD,
  'crop.pea': LEAF,
  'crop.leek': STONE,
  'crop.flax': WATER,
  'crop.sunwort': OCHRE,
  'crop.dewmint': LEAF,
  'crop.wheat': OCHRE,
  'crop.barley': PEACH,
  'crop.onion': DEEP,
  'crop.carrot': FIRE,
  'crop.cabbage': LEAF,
  'crop.tomato': FIRE,
  'crop.runner_bean': LEAF,
  'crop.strawberry': ROSE,
  'crop.corn': OCHRE,
  'crop.pumpkin': FIRE,
  'crop.pepper': FIRE,
  'crop.garlic': STONE,
  'crop.beet': ROSE,
  'crop.hops': LEAF,
  'crop.glowcap': WATER,
  'crop.woad': WATER,
  'crop.melon': LEAF,
  'crop.saffron': VIOLET,
  'crop.frost_kale': WATER,
  'crop.frostroot': STONE,
  'crop.artichoke': LEAF,
  'crop.honeyvine': OCHRE,
};

/** A seed packet: a folded top, the crop's color above, a band below, seeds spilling out. */
function packet(item: string, top: Ramp, band: Ramp): SpriteDef {
  return icon(name(item), (im) => {
    im.rect(2, 1, 9, 5, top[2]);
    im.rect(2, 1, 9, 1, top[3]);
    im.rect(2, 1, 2, 5, top[3]);
    im.rect(2, 6, 9, 10, band[2]);
    im.rect(9, 6, 9, 10, band[1]);
    im.rect(2, 10, 9, 10, band[1]);
    im.rect(4, 3, 7, 3, top[1]);
    im.rect(4, 8, 7, 8, band[3]);
  });
}

function seedIcons(): SpriteDef[] {
  const used = new Set<string>();
  return CROP_LIST.map((c, i) => {
    const top = SEED_TOP[c.id] ?? LEAF;
    let band = BANDS[i % BANDS.length] as Ramp;
    for (let k = 0; used.has(`${top[2]}|${band[2]}`) || band[2] === top[2]; k++)
      band = BANDS[(i + k + 1) % BANDS.length] as Ramp;
    used.add(`${top[2]}|${band[2]}`);
    return packet(c.seed, top, band);
  });
}

/** Compost: a heap of dark earth with scraps in it. */
function compost(): SpriteDef {
  return icon('compost', (im) => {
    for (let y = 4; y <= 10; y++) {
      const w = Math.min(5, y - 2);
      im.rect(6 - w, y, 5 + w, y, WOOD[1]);
    }
    im.rect(4, 4, 6, 5, WOOD[2]);
    for (const [x, y, c] of [
      [3, 8, LEAF[2]],
      [7, 6, LEAF[3]],
      [8, 9, OCHRE[2]],
      [5, 7, WOOD[3]],
    ] as const)
      im.set(x, y, c);
  });
}

/** The hoe: a long handle and a flat blade turned down. */
function hoe(): SpriteDef {
  return icon('hoe', (im) => {
    line(im, 2, 11, 9, 2, WOOD[2]);
    line(im, 3, 11, 10, 2, WOOD[1]);
    im.rect(7, 1, 10, 1, METAL[2]);
    im.rect(6, 2, 7, 4, METAL[3]);
    im.rect(6, 4, 6, 4, METAL[1]);
  });
}

/** The watering can: a round body, a handle on top and a spout to the right. */
function wateringCan(): SpriteDef {
  return icon('watering_can', (im) => {
    im.rect(2, 5, 7, 10, METAL[2]);
    im.rect(2, 5, 3, 10, METAL[3]);
    im.rect(2, 10, 7, 10, METAL[1]);
    line(im, 3, 4, 6, 2, METAL[2]);
    line(im, 6, 2, 7, 4, METAL[1]);
    line(im, 8, 8, 10, 4, METAL[2]);
    im.rect(10, 3, 11, 4, WATER[3]);
  });
}

export function farmIcons(): SpriteDef[] {
  const crops = CROP_LIST.filter((c) => c.value !== undefined).map((c) => {
    const make = CROP_ICONS[c.result];
    if (!make) throw new Error(`no icon for ${c.result}`);
    return make();
  });
  return [...crops, ...seedIcons(), compost(), hoe(), wateringCan()];
}
