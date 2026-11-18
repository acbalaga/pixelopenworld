import type { SpriteDef } from '../types';
import { Img, toSprite } from '../gen/img';

/**
 * Button icons, 12 x 12. Drawn light on a dark button: off-white and metal for blades, ember
 * colors for fire. One frame each, `base`.
 */
const SIZE = 12;

const W = 3;
const METAL = 30;
const METAL_DARK = 29;
const WOOD = 45;
const GUARD = 46;
const FIRE_DARK = 21;
const FIRE = 22;
const FIRE_LIGHT = 23;

/** A line of pixels from (x0, y0) to (x1, y1). */
function line(im: Img, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    im.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c);
  }
}

function icon(id: string, draw: (im: Img) => void): SpriteDef {
  const im = new Img(SIZE, SIZE);
  draw(im);
  return toSprite(id, 'ui', [0, 0], { base: im });
}

/** Attack: a sword on the diagonal. */
const attack = icon('ui.icon_attack', (im) => {
  line(im, 10, 1, 4, 7, W);
  line(im, 11, 2, 5, 8, METAL);
  line(im, 11, 0, 11, 1, METAL_DARK);
  line(im, 3, 5, 7, 9, GUARD);
  line(im, 3, 6, 6, 9, GUARD);
  line(im, 4, 8, 1, 11, WOOD);
  line(im, 3, 8, 1, 10, WOOD);
});

/** Lunge: a sword thrust forward with speed lines behind it. */
const lunge = icon('ui.icon_lunge', (im) => {
  im.rect(4, 5, 11, 5, W);
  im.rect(4, 6, 10, 6, METAL);
  im.set(11, 6, METAL_DARK);
  im.rect(3, 3, 3, 8, GUARD);
  im.rect(0, 5, 2, 6, WOOD);
  im.rect(0, 1, 3, 1, METAL_DARK);
  im.rect(0, 10, 2, 10, METAL_DARK);
  im.rect(5, 9, 8, 9, METAL_DARK);
});

/** Ember bolt: a fireball with a tail. */
const ember = icon('ui.icon_ember', (im) => {
  line(im, 0, 10, 5, 7, FIRE_DARK);
  line(im, 0, 8, 5, 6, FIRE_DARK);
  line(im, 1, 5, 5, 5, FIRE);
  for (let y = 2; y <= 9; y++) {
    for (let x = 5; x <= 11; x++) {
      const dx = x - 8;
      const dy = y - 5.5;
      if (dx * dx + dy * dy <= 11) im.set(x, y, FIRE);
      if (dx * dx + dy * dy <= 4) im.set(x, y, FIRE_LIGHT);
    }
  }
  im.set(9, 4, W);
});

/** Dodge: two chevrons showing a quick step. */
const dodge = icon('ui.icon_dodge', (im) => {
  for (const ox of [1, 6]) {
    line(im, ox, 2, ox + 4, 6, W);
    line(im, ox + 4, 6, ox, 10, W);
    line(im, ox + 1, 2, ox + 5, 6, METAL);
    line(im, ox + 5, 6, ox + 1, 10, METAL);
  }
});

/** Guard: a heater shield with a boss, the thing the button raises. */
const guard = icon('ui.icon_guard', (im) => {
  im.rect(2, 1, 9, 6, W);
  im.rect(3, 7, 8, 8, W);
  im.rect(4, 9, 7, 9, W);
  im.rect(5, 10, 6, 10, W);
  im.rect(3, 2, 8, 6, METAL);
  im.rect(4, 7, 7, 8, METAL);
  im.rect(5, 9, 6, 9, METAL_DARK);
  im.rect(5, 3, 6, 5, FIRE);
  im.rect(5, 3, 5, 4, FIRE_LIGHT);
});

/** Context: an exclamation mark, something here can be used. */
const context = icon('ui.icon_context', (im) => {
  im.rect(5, 1, 6, 7, FIRE_LIGHT);
  im.rect(5, 9, 6, 10, FIRE_LIGHT);
  im.rect(4, 2, 4, 6, FIRE);
  im.rect(7, 2, 7, 6, FIRE);
});

/** Menu: three bars. */
const menu = icon('ui.icon_menu', (im) => {
  for (const y of [2, 5, 8]) {
    im.rect(1, y, 10, y + 1, W);
    im.rect(1, y, 9, y, METAL);
  }
});

/** Bag: a satchel with a flap and a buckle. */
const bag = icon('ui.icon_bag', (im) => {
  im.rect(2, 4, 9, 10, WOOD);
  im.rect(2, 4, 9, 6, GUARD);
  im.rect(3, 1, 8, 3, WOOD);
  im.rect(4, 2, 7, 2, GUARD);
  im.rect(5, 6, 6, 8, METAL);
  im.rect(2, 10, 9, 10, METAL_DARK);
});

/** Winded: out of breath, a drop and two short puffs. */
const winded = icon('ui.status_winded', (im) => {
  im.rect(5, 1, 6, 2, METAL);
  im.rect(4, 3, 7, 6, METAL);
  im.rect(5, 7, 6, 7, METAL);
  im.rect(0, 4, 2, 4, METAL_DARK);
  im.rect(0, 7, 3, 7, METAL_DARK);
  im.rect(9, 4, 11, 4, METAL_DARK);
  im.rect(9, 7, 11, 7, METAL_DARK);
});

const WATER = [12, 13, 14, 15] as const;
const LEAF = [8, 9, 10, 11] as const;
const VIOLET = [24, 25, 26, 27] as const;
const BARK = [4, 5, 6, 7] as const;
const GOLD = [44, 45, 46, 47] as const;

/** A filled disc of `r` around (cx, cy), for bubbles and dots. */
function disc(im: Img, cx: number, cy: number, r: number, c: number): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 1) im.set(cx + x, cy + y, c);
}

/** Burning: a flame, a point on top and a bright core. */
const burning = icon('ui.status_burning', (im) => {
  im.rect(5, 0, 6, 1, FIRE);
  im.rect(4, 2, 7, 4, FIRE);
  im.rect(2, 5, 9, 8, FIRE_DARK);
  im.rect(3, 4, 8, 9, FIRE);
  im.rect(4, 9, 7, 11, FIRE_DARK);
  im.rect(5, 6, 6, 10, FIRE_LIGHT);
});

/** Wet: a drop, a point on top over a round belly. */
const wet = icon('ui.status_wet', (im) => {
  im.rect(5, 0, 6, 1, WATER[2]);
  im.rect(4, 2, 7, 3, WATER[2]);
  im.rect(3, 4, 8, 5, WATER[2]);
  disc(im, 5, 7, 4, WATER[2]);
  im.rect(3, 6, 4, 8, WATER[3]);
  im.rect(6, 9, 8, 10, WATER[1]);
});

/** Chilled: a six armed snowflake, drawn as a plus and two diagonals. */
const chilled = icon('ui.status_chilled', (im) => {
  im.rect(5, 0, 6, 11, WATER[3]);
  im.rect(0, 5, 11, 6, WATER[3]);
  line(im, 1, 1, 10, 10, WATER[2]);
  line(im, 10, 1, 1, 10, WATER[2]);
  im.rect(4, 4, 7, 7, WATER[3]);
});

/** Staggered: a lightning crack. */
const staggered = icon('ui.status_staggered', (im) => {
  im.rect(6, 0, 9, 1, GOLD[3]);
  im.rect(5, 2, 8, 3, GOLD[3]);
  im.rect(4, 4, 8, 5, GOLD[3]);
  im.rect(3, 6, 9, 7, GOLD[2]);
  im.rect(5, 8, 7, 9, GOLD[2]);
  im.rect(4, 10, 5, 11, GOLD[2]);
});

/** Poisoned: three bubbles of different sizes rising. */
const poisoned = icon('ui.status_poisoned', (im) => {
  disc(im, 4, 8, 3, LEAF[2]);
  disc(im, 8, 5, 2, LEAF[3]);
  disc(im, 5, 2, 1, LEAF[3]);
  im.set(3, 7, LEAF[1]);
  im.set(7, 4, LEAF[1]);
});

/** Hexed: an eye, an almond with a slit pupil. */
const hexed = icon('ui.status_hexed', (im) => {
  im.rect(2, 4, 9, 7, VIOLET[2]);
  im.rect(0, 5, 11, 6, VIOLET[2]);
  im.rect(3, 3, 8, 3, VIOLET[1]);
  im.rect(3, 8, 8, 8, VIOLET[1]);
  im.rect(5, 3, 6, 8, VIOLET[3]);
  im.rect(5, 4, 6, 7, W);
});

/** Rooted: a trunk that splits into roots gripping the ground. */
const rooted = icon('ui.status_rooted', (im) => {
  im.rect(5, 0, 6, 5, BARK[2]);
  line(im, 5, 5, 1, 9, BARK[2]);
  line(im, 6, 5, 10, 9, BARK[2]);
  line(im, 5, 6, 4, 11, BARK[1]);
  line(im, 6, 6, 7, 11, BARK[1]);
  im.rect(0, 10, 11, 11, BARK[0]);
});

/** Dazed: four dots orbiting an empty center. */
const dazed = icon('ui.status_dazed', (im) => {
  disc(im, 5, 1, 1, GOLD[3]);
  disc(im, 10, 5, 1, GOLD[3]);
  disc(im, 6, 10, 1, GOLD[3]);
  disc(im, 1, 6, 1, GOLD[3]);
  im.rect(4, 4, 7, 7, GOLD[1]);
  im.rect(5, 5, 6, 6, GOLD[2]);
});

/** Warded: a shield with a cross. */
const warded = icon('ui.status_warded', (im) => {
  im.rect(1, 0, 10, 6, METAL);
  im.rect(2, 7, 9, 8, METAL);
  im.rect(3, 9, 8, 9, METAL);
  im.rect(5, 10, 6, 11, METAL);
  im.rect(1, 0, 10, 0, METAL_DARK);
  im.rect(5, 1, 6, 9, W);
  im.rect(2, 3, 9, 4, W);
});

/** Rested: a crescent moon. */
const rested = icon('ui.status_rested', (im) => {
  disc(im, 6, 6, 5, GOLD[3]);
  disc(im, 8, 4, 4, 0);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) if (im.get(x, y) === 0) im.set(x, y, null);
  im.set(10, 9, GOLD[3]);
  im.set(10, 10, GOLD[3]);
});

export const UI_ICONS: readonly SpriteDef[] = [
  attack,
  lunge,
  ember,
  dodge,
  guard,
  context,
  menu,
  bag,
  winded,
  burning,
  wet,
  chilled,
  staggered,
  poisoned,
  hexed,
  rooted,
  dazed,
  warded,
  rested,
];

/** Icon sprite id for each on-screen button. Technique buttons take their icon from the technique. */
export const BUTTON_ICONS: Readonly<Record<string, string>> = {
  attack: 'ui.icon_attack',
  dodge: 'ui.icon_dodge',
  guard: 'ui.icon_guard',
  context: 'ui.icon_context',
  menu: 'ui.icon_menu',
  bag: 'ui.icon_bag',
};
