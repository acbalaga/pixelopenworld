import { COOKBOOKS, DISHES, type DishDef } from '../../items/dishes';
import type { SpriteDef } from '../types';
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
 * Dish icons (POW-M6-04). Each dish is drawn from a template its name picks (a bowl for soup, a pie
 * for a tart, a loaf, a plate, a cup, a jar, a skewer), in the color of its main ingredient with
 * a garnish of the next. `v` turns small knobs (the bowl, the steam, the garnish, the shape) so two
 * dishes of one template and color still differ: `DISH_ICON_VARIANT` holds the first `v` for each
 * dish that passes the look-alike check against every other icon (found once by
 * `tools/dish-icon-variants.ts`, kept here as data).
 */

const PEACH: Ramp = [36, 37, 38, 39];
const DEEP: Ramp = [32, 33, 34, 35];
const PALE: Ramp = [16, 2, 3, 3];

/** The color each ingredient brings to a dish. */
const COLOR: Readonly<Record<string, Ramp>> = {
  'item.turnip': PALE,
  'item.radish': ROSE,
  'item.potato': WOOD,
  'item.pea_pod': LEAF,
  'item.leek': LEAF,
  'item.flour': CREAM,
  'item.fish_river': WATER,
  'item.fish_silver': METAL,
  'item.sunwort': GOLD,
  'item.dewmint': LEAF,
  'item.onion': DEEP,
  'item.carrot': FIRE,
  'item.corn': GOLD,
  'item.bean': LEAF,
  'item.tomato': FIRE,
  'item.cabbage': LEAF,
  'item.hops': LEAF,
  'item.berry_blue': VIOLET,
  'item.berry_red': ROSE,
  'item.barley': PEACH,
  'item.garlic': PALE,
  'item.raw_meat': [20, 4, 5, 41],
  'item.strawberry': ROSE,
  'item.pepper': FIRE,
  'item.beet': [24, 40, 41, 42],
  'item.pumpkin': FIRE,
  'item.glowcap': WATER,
  'item.woad_leaf': WATER,
  'item.saffron': GOLD,
  'item.honeygrape': GOLD,
  'item.melon': LEAF,
  'item.kale': WATER,
  'item.frostroot': PALE,
  'item.artichoke': LEAF,
  'item.egg': CREAM,
  'item.duck_egg': CREAM,
  'item.milk': PALE,
  'item.goat_milk': PALE,
  'item.truffle': DEEP,
  'item.salt': STONE,
  'item.dew_vial': WATER,
};

type Template = 'bowl' | 'pie' | 'loaf' | 'plate' | 'cup' | 'jar' | 'skewer';

/** The template a dish's name asks for. */
export function templateOf(d: DishDef): Template {
  const k = d.key;
  if (/pie|tart|custard|gratin/.test(k)) return 'pie';
  if (/bread|loaf|cake|flatbread|fritter|pancake/.test(k)) return 'loaf';
  if (/tea|water|ale|sorbet/.test(k)) return 'cup';
  if (/jelly|pickle/.test(k)) return 'jar';
  if (/skewer/.test(k)) return 'skewer';
  if (
    /roast|salad|platter|rolls|hearts|baked|fish$|boiled|vegetables|peppers|omelette|bowl/.test(k)
  )
    return 'plate';
  return 'bowl';
}

const CONTAINERS: readonly Ramp[] = [STONE, WOOD, METAL, CREAM];

/** Templates a dish may fall back to when its own is taken, in order. */
const FALLBACK: Readonly<Record<Template, readonly Template[]>> = {
  bowl: ['bowl', 'jar', 'cup', 'plate'],
  pie: ['pie', 'loaf', 'plate', 'bowl'],
  loaf: ['loaf', 'pie', 'plate', 'skewer'],
  plate: ['plate', 'bowl', 'skewer', 'pie'],
  cup: ['cup', 'jar', 'bowl', 'loaf'],
  jar: ['jar', 'cup', 'bowl', 'plate'],
  skewer: ['skewer', 'plate', 'bowl', 'loaf'],
};

/** The colors of a dish: its ingredients in order, without salt and flour, each a ramp. */
function colorsOf(d: DishDef): Ramp[] {
  const out: Ramp[] = [];
  for (const [i] of d.ingredients) {
    if (i === 'item.salt' || i === 'item.flour') continue;
    const c = COLOR[i];
    if (c && !out.includes(c)) out.push(c);
  }
  return out.length > 0 ? out : [GOLD];
}

/**
 * Variant `v` picks, from slowest to fastest changing: the template (its own, then its
 * fallbacks), which ingredient colors the food and which the garnish, a shape knob, and the
 * container. 4 x 3 x 3 x 4 = 144 variants.
 */
export const DISH_VARIANTS = 144;

function knobs(
  d: DishDef,
  v: number,
): { t: Template; food: Ramp; garnish: Ramp; box: Ramp; alt: number } {
  const box = CONTAINERS[v % 4] as Ramp;
  const alt = Math.floor(v / 4) % 3;
  const pick = Math.floor(v / 12) % 3;
  const t = FALLBACK[templateOf(d)][Math.floor(v / 36) % 4] as Template;
  const cs = colorsOf(d);
  const extra: readonly Ramp[] = [ROSE, VIOLET, WATER, GOLD, LEAF, FIRE];
  const food = cs[pick % cs.length] as Ramp;
  const g = cs.find((c) => c !== food) ?? (extra.find((c) => c !== food) as Ramp);
  const garnish = pick === 2 ? (extra[(cs.length + d.key.length) % extra.length] as Ramp) : g;
  return { t, food, garnish: garnish === food ? LEAF : garnish, box, alt };
}

/** One dish icon at variant `v`. */
export function dishIcon(d: DishDef, v: number): SpriteDef {
  const { t, food, garnish, box, alt } = knobs(d, v);
  const name = d.key;
  switch (t) {
    case 'bowl':
      return icon(name, (im) => {
        im.rect(1, 6, 10, 7, box[2]);
        im.rect(2, 8, 9, 9, box[1]);
        im.rect(3, 10, 8, 10, box[0]);
        im.rect(2, 4, 9, 6, food[2]);
        im.rect(3, 3, 8, 3, food[1]);
        im.rect(2, 4, 4, 4, food[3]);
        if (alt !== 1) for (const x of [4, 7]) im.set(x, 5 + (x % 2), garnish[2]);
        if (alt !== 2) {
          line(im, 4, 3, 5, 1, STONE[3]);
          line(im, 7, 3, 8, 1, STONE[3]);
        } else im.rect(5, 4, 6, 4, garnish[3]);
      });
    case 'pie':
      return icon(name, (im) => {
        const crust = alt === 2 ? CREAM : GOLD;
        im.rect(1, 6, 10, 9, crust[1]);
        im.rect(1, 5, 10, 6, crust[2]);
        im.rect(2, 4, 9, 5, food[2]);
        im.rect(2, 4, 4, 4, food[3]);
        if (alt === 1) for (const x of [3, 6, 9]) line(im, x, 3, x - 1, 6, crust[3]);
        else for (const x of [4, 7]) im.set(x, 5, garnish[2]);
        im.rect(2, 10, 9, 10, box[1]);
      });
    case 'loaf':
      return icon(name, (im) => {
        if (alt === 1) disc(im, 6, 6, 4, food);
        else {
          im.rect(1, 4, 10, 9, food[2]);
          im.rect(2, 3, 9, 3, food[3]);
          im.rect(1, 9, 10, 9, food[1]);
        }
        for (const x of [3, 6, 9]) line(im, x, 4, x + 1, 6, garnish[alt === 2 ? 3 : 1] as number);
        im.rect(0, 10, 11, 10, box[1]);
      });
    case 'plate':
      return icon(name, (im) => {
        im.rect(0, 8, 11, 9, box[3]);
        im.rect(1, 10, 10, 10, box[1]);
        disc(im, 5, 5, 3, food);
        if (alt !== 1) disc(im, 9, 6, 1, garnish);
        else im.rect(8, 3, 10, 7, garnish[2]);
        if (alt === 2) im.rect(2, 2, 3, 3, LEAF[3]);
      });
    case 'cup':
      return icon(name, (im) => {
        im.rect(2, 3, 8, 10, box[2]);
        im.rect(2, 3, 3, 10, box[3]);
        im.rect(9, 5, 10, 8, box[1]);
        im.rect(3, 3, 7, 4, food[alt === 1 ? 3 : 2] as number);
        if (alt !== 2) line(im, 5, 1, 6, 0, STONE[3]);
        im.set(5, 6, garnish[2]);
      });
    case 'jar':
      return icon(name, (im) => {
        im.rect(2, 3, 9, 10, WATER[3]);
        im.rect(3, 5, 8, 10, food[2]);
        im.rect(3, 5, 4, 7, food[3]);
        im.rect(2, 1, 9, 2, alt === 1 ? box[1] : garnish[1]);
        im.set(6, 7, garnish[3]);
      });
    case 'skewer':
      return icon(name, (im) => {
        line(im, 1, 11, 10, 1, WOOD[1]);
        for (let k = 0; k < 3; k++) {
          const c = k % 2 === 0 ? food : garnish;
          im.rect(3 + k * 2, 6 - k * 2, 4 + k * 2, 7 - k * 2, c[2]);
          im.set(3 + k * 2, 6 - k * 2, c[3]);
        }
        if (alt === 1) im.rect(9, 9, 10, 10, box[2]);
      });
  }
}

/**
 * The first variant of each dish whose icon passes the look-alike check. Data: regenerate with
 * `npx tsx tools/dish-icon-variants.ts` after adding or redrawing a dish. A dish not listed uses 0.
 */
export const DISH_ICON_VARIANT: Readonly<Record<string, number>> = {
  pea_soup: 1,
  leek_broth: 2,
  turnip_stew: 3,
  pea_mash: 8,
  onion_soup: 8,
  carrot_soup: 8,
  bean_broth: 11,
  tomato_soup: 9,
  hop_tea: 1,
  berry_porridge: 8,
  roast_vegetables: 1,
  wheat_loaf: 4,
  barley_stew: 8,
  strawberry_tart: 5,
  berry_pie: 8,
  tomato_stew: 10,
  corn_chowder: 9,
  beet_soup: 8,
  pumpkin_soup: 11,
  leek_pie: 36,
  cabbage_soup: 36,
  corn_bread: 73,
  glowcap_stew: 9,
  hop_bread: 4,
  woad_tea: 2,
  spiced_fish: 1,
  milk_bread: 4,
  goat_porridge: 9,
  pumpkin_pie: 40,
  garlic_roast: 1,
  saffron_stew: 8,
  silver_pie: 36,
  melon_salad: 1,
  kale_soup: 3,
  frostroot_mash: 10,
  artichoke_hearts: 2,
  glowcap_tart: 36,
  woad_bread: 4,
  hop_ale: 48,
  tomato_pie: 48,
  harvest_stew: 8,
  spiced_chowder: 9,
  melon_sorbet: 92,
  saffron_bread: 74,
  beet_salad: 1,
  frostroot_pie: 48,
  custard_tart: 40,
  duck_egg_pie: 73,
  creamed_kale: 48,
  pumpkin_custard: 73,
  feast_roast: 2,
  honeygrape_tart: 48,
  summer_bowl: 3,
  kale_pie: 52,
  frostroot_stew: 20,
  artichoke_gratin: 52,
  golden_bread: 75,
  glowcap_pie: 74,
  harvest_pie: 74,
  fire_stew: 32,
  winter_broth: 108,
  royal_platter: 1,
  truffle_risotto: 10,
};

/** The materials and books the cooking set adds. */
function extras(): SpriteDef[] {
  const sack = icon('flour', (im) => {
    im.rect(2, 3, 9, 10, CREAM[2]);
    im.rect(3, 2, 8, 2, CREAM[1]);
    im.rect(2, 3, 3, 10, CREAM[3]);
    im.rect(4, 5, 7, 7, GOLD[1]);
    im.rect(5, 1, 6, 1, WOOD[1]);
  });
  const egg = (name: string, c: Ramp, big: boolean): SpriteDef =>
    icon(name, (im) => {
      disc(im, 6, 6, big ? 4 : 3, c);
      im.rect(5, big ? 1 : 2, 6, big ? 1 : 2, c[2]);
      if (big) im.set(4, 5, WATER[2]);
    });
  const jug = (name: string, c: Ramp, cap: Ramp): SpriteDef =>
    icon(name, (im) => {
      im.rect(3, 4, 8, 10, c[2]);
      im.rect(3, 4, 4, 10, c[3]);
      im.rect(4, 2, 7, 3, cap[2]);
      im.rect(9, 5, 10, 8, c[1]);
    });
  const truffle = icon('truffle', (im) => {
    disc(im, 6, 7, 3, DEEP);
    for (const [x, y] of [
      [4, 6],
      [7, 8],
      [6, 5],
    ] as const)
      im.set(x, y, WOOD[0]);
    im.rect(2, 10, 9, 10, WOOD[1]);
  });
  const book = (id: string, cover: Ramp, band: Ramp): SpriteDef =>
    icon(id.replace(/^item\./, ''), (im) => {
      im.rect(2, 2, 9, 10, cover[2]);
      im.rect(2, 2, 3, 10, cover[1]);
      im.rect(4, 4, 8, 5, band[3]);
      im.rect(10, 3, 10, 10, STONE[3]);
      im.set(6, 8, band[2]);
    });
  return [
    sack,
    egg('egg', CREAM, false),
    egg('duck_egg', [12, 13, 15, 15], true),
    jug('milk', PALE, WATER),
    jug('goat_milk', PEACH, LEAF),
    truffle,
    book(COOKBOOKS.hearth, FIRE, GOLD),
    book(COOKBOOKS.market, LEAF, ROSE),
    book(COOKBOOKS.old, WOOD, STONE),
    book(COOKBOOKS.coast, WATER, PALE),
  ];
}

export function dishIcons(): SpriteDef[] {
  return [...DISHES.map((d) => dishIcon(d, DISH_ICON_VARIANT[d.key] ?? 0)), ...extras()];
}
