import type { SpriteDef } from '../types';
import { Img, toSprite } from './img';
import {
  BRONZE,
  COPPER,
  CREAM,
  FIRE,
  GOLD,
  LEAF,
  METAL,
  ROSE,
  RUST,
  SIZE,
  STONE,
  VIOLET,
  WATER,
  WOOD,
  disc,
  icon,
  line,
  outline,
  type Ramp,
} from './iconKit';

/**
 * Item icons drawn to be told apart (POW-M4-22F). Every item has its own icon. Where a family
 * shares a silhouette (a tier line), the metal or wood differs and so does one detail. Drawn as
 * 12 x 12 text grids, one character per palette index, with the outline added after.
 */

/** Steel for tools and weapons: a cool grey that is not the metal ramp iron uses. */
const STEELB: Ramp = [16, 18, 19, 3];
const TAN: Ramp = GOLD;

const KEY: Record<string, number> = {
  o: 0,
  t: 1,
  x: 2,
  w: 3,
  d: 4,
  k: 5,
  K: 6,
  J: 7,
  g: 8,
  G: 9,
  m: 10,
  l: 11,
  a: 12,
  b: 13,
  c: 14,
  C: 15,
  p: 16,
  q: 17,
  s: 18,
  S: 19,
  e: 20,
  r: 21,
  R: 22,
  y: 23,
  u: 24,
  v: 25,
  V: 26,
  W: 27,
  h: 28,
  i: 29,
  j: 30,
  H: 31,
  n: 40,
  N: 41,
  M: 42,
  P: 43,
  '1': 44,
  '2': 45,
  '3': 46,
  '4': 47,
};

/** An icon from a 12 x 12 text grid. `.` is empty. Rows are padded; a row that is too wide throws. */
function art(name: string, rows: readonly string[]): SpriteDef {
  const im = new Img(SIZE, SIZE);
  rows.forEach((row, y) => {
    if (row.length > SIZE) throw new Error(`icon ${name} row ${y} is ${row.length} wide`);
    [...row.padEnd(SIZE, '.')].forEach((ch, x) => {
      if (ch === '.') return;
      const c = KEY[ch];
      if (c === undefined) throw new Error(`icon ${name}: unknown key ${ch}`);
      im.set(x, y, c);
    });
  });
  return toSprite(`icon.${name}`, 'ui', [0, 0], { base: outline(im) });
}

/** A pixel set, for details a tier adds. */
type Dots = readonly (readonly [number, number, number])[];
function dots(im: Img, d: Dots): void {
  for (const [x, y, c] of d) im.set(x, y, c);
}

// ---- Tier lines: same silhouette, different metal or wood, one detail each ----

function sword(name: string, blade: Ramp, extra: Dots): SpriteDef {
  return icon(name, (im) => {
    line(im, 9, 2, 4, 7, blade[2]);
    line(im, 10, 3, 5, 8, blade[1]);
    line(im, 8, 2, 4, 6, blade[3]);
    line(im, 3, 6, 6, 9, WOOD[2]);
    line(im, 4, 8, 2, 10, WOOD[1]);
    dots(im, extra);
  });
}

function spear(name: string, shaft: Ramp, head: Ramp, extra: Dots): SpriteDef {
  return icon(name, (im) => {
    line(im, 2, 10, 8, 4, shaft[2]);
    line(im, 3, 10, 9, 4, shaft[1]);
    im.rect(8, 1, 10, 3, head[3]);
    im.set(10, 1, head[2]);
    im.set(8, 3, head[1]);
    dots(im, extra);
  });
}

function pick(name: string, head: Ramp, bind: number): SpriteDef {
  return icon(name, (im) => {
    line(im, 3, 10, 8, 3, WOOD[2]);
    line(im, 4, 10, 9, 3, WOOD[1]);
    line(im, 2, 3, 6, 1, head[2]);
    line(im, 6, 1, 10, 4, head[2]);
    line(im, 2, 4, 6, 2, head[3]);
    im.set(2, 4, head[1]);
    im.set(10, 5, head[1]);
    dots(im, [
      [6, 7, bind],
      [5, 8, bind],
      [7, 5, bind],
    ]);
  });
}

function axe(name: string, head: Ramp, bind: number): SpriteDef {
  return icon(name, (im) => {
    line(im, 2, 10, 8, 2, WOOD[2]);
    line(im, 3, 10, 9, 2, WOOD[1]);
    im.rect(5, 1, 9, 4, head[2]);
    im.rect(4, 2, 4, 5, head[3]);
    im.rect(8, 4, 10, 5, head[1]);
    im.rect(5, 1, 7, 2, head[3]);
    dots(im, [
      [4, 8, bind],
      [5, 7, bind],
    ]);
  });
}

function sickle(name: string, blade: Ramp, bind: number): SpriteDef {
  return icon(name, (im) => {
    line(im, 2, 10, 5, 6, WOOD[2]);
    line(im, 3, 10, 6, 6, WOOD[1]);
    line(im, 5, 5, 6, 2, blade[2]);
    line(im, 6, 2, 9, 1, blade[3]);
    line(im, 9, 1, 10, 4, blade[2]);
    line(im, 9, 2, 8, 4, blade[1]);
    dots(im, [
      [3, 8, bind],
      [4, 7, bind],
      [10, 5, blade[1]],
    ]);
  });
}

function hammer(name: string, head: Ramp, bind: number): SpriteDef {
  return icon(name, (im) => {
    line(im, 3, 10, 8, 4, WOOD[2]);
    line(im, 4, 10, 9, 4, WOOD[1]);
    im.rect(5, 1, 10, 4, head[2]);
    im.rect(5, 1, 10, 1, head[3]);
    im.rect(9, 3, 10, 4, head[1]);
    dots(im, [
      [5, 8, bind],
      [6, 7, bind],
    ]);
  });
}

/** A maul: a heavy block head with a spike each end. It reads bigger than a hammer. */
function maul(name: string, head: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 3, 11, 8, 5, WOOD[2]);
    line(im, 4, 11, 9, 5, WOOD[1]);
    im.rect(3, 1, 11, 4, head[2]);
    im.rect(3, 1, 11, 1, head[3]);
    im.rect(3, 4, 11, 4, head[1]);
    im.rect(1, 2, 2, 3, head[1]);
    im.rect(5, 2, 6, 3, head[3]);
  });
}

function rod(name: string, c: Ramp, reel: Dots): SpriteDef {
  return icon(name, (im) => {
    line(im, 1, 10, 9, 1, c[2]);
    line(im, 2, 10, 10, 1, c[1]);
    line(im, 10, 1, 10, 7, STONE[3]);
    disc(im, 10, 8, 1, FIRE);
    im.rect(2, 8, 3, 9, c[3]);
    dots(im, reel);
  });
}

// ---- Flasks and bottles: one silhouette per effect family ----

/** A round flask: bulb and short neck. `big` makes the full strength version. */
function roundFlask(name: string, c: Ramp, big: boolean): SpriteDef {
  return icon(name, (im) => {
    if (big) {
      im.rect(5, 1, 6, 3, STONE[3]);
      disc(im, 6, 7, 4, c);
      im.rect(5, 2, 6, 2, WOOD[2]);
    } else {
      im.rect(5, 3, 6, 4, STONE[3]);
      disc(im, 6, 7, 3, c);
      im.rect(5, 3, 6, 3, WOOD[2]);
    }
  });
}

/** A tall narrow vial. */
function tallVial(name: string, c: Ramp, big: boolean): SpriteDef {
  return icon(name, (im) => {
    const top = big ? 0 : 2;
    const x0 = big ? 3 : 4;
    const x1 = big ? 8 : 7;
    im.rect(5, top, 6, top + 1, WOOD[2]);
    im.rect(x0, top + 2, x1, 10, c[2]);
    im.rect(x0, top + 2, x0 + 1, 10, c[3]);
    im.rect(x1, top + 3, x1, 10, c[1]);
    im.rect(5, top + 2, 6, top + 2, STONE[3]);
  });
}

/** A square bottle with a flat shoulder. */
function squareBottle(name: string, c: Ramp, big: boolean): SpriteDef {
  return icon(name, (im) => {
    const w = big ? 9 : 8;
    const x0 = big ? 1 : 2;
    im.rect(5, 1, 6, 2, STONE[3]);
    im.rect(x0, 3, x0 + w - 1, 3, STONE[3]);
    im.rect(x0, 4, x0 + w - 1, 10, c[2]);
    im.rect(x0, 4, x0 + 1, 10, c[3]);
    im.rect(x0 + w - 2, 4, x0 + w - 1, 10, c[1]);
    if (big) im.rect(4, 6, 7, 8, c[3]);
  });
}

/** A stoppered jar: wide, with a cork and a belt of wax. */
function jar(name: string, c: Ramp, wax: number): SpriteDef {
  return icon(name, (im) => {
    im.rect(4, 1, 7, 2, WOOD[2]);
    im.rect(3, 3, 8, 3, wax);
    im.rect(2, 4, 9, 10, c[2]);
    im.rect(2, 4, 3, 10, c[3]);
    im.rect(8, 4, 9, 10, c[1]);
    im.rect(2, 10, 9, 10, c[1]);
  });
}

/** A flat tin with a lid. */
function tin(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(1, 5, 10, 6, STONE[3]);
    im.rect(1, 7, 10, 9, c[2]);
    im.rect(1, 7, 10, 7, c[3]);
    im.rect(1, 9, 10, 9, c[1]);
    im.rect(3, 4, 8, 4, STONE[2]);
    im.set(5, 8, c[3]);
  });
}

/** A cruet with a spout. */
function cruet(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(8, 1, 10, 2, STONE[3]);
    im.rect(6, 2, 8, 3, STONE[3]);
    im.rect(3, 4, 8, 10, c[2]);
    im.rect(3, 4, 4, 10, c[3]);
    im.rect(7, 5, 8, 10, c[1]);
    im.rect(9, 5, 10, 8, WOOD[2]);
    im.rect(9, 6, 9, 7, null);
  });
}

/** A conical flask with a wide base. */
function conical(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(5, 1, 6, 4, STONE[3]);
    im.rect(4, 5, 7, 6, c[2]);
    im.rect(3, 7, 8, 8, c[2]);
    im.rect(2, 9, 9, 10, c[2]);
    im.rect(4, 5, 4, 10, c[3]);
    im.rect(2, 10, 9, 10, c[1]);
    im.set(6, 0, WOOD[2]);
  });
}

/** A diamond bottle, a shield of glass. */
function diamond(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(5, 1, 6, 2, WOOD[2]);
    im.rect(5, 3, 6, 3, c[3]);
    im.rect(4, 4, 7, 4, c[2]);
    im.rect(3, 5, 8, 6, c[2]);
    im.rect(4, 7, 7, 8, c[1]);
    im.rect(5, 9, 6, 9, c[1]);
    im.set(4, 5, c[3]);
  });
}

/** A long-necked bulb with a round glass stopper. */
function longNeck(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    disc(im, 6, 1, 1, STONE);
    im.rect(5, 3, 6, 6, STONE[3]);
    disc(im, 6, 8, 3, c);
    im.set(5, 7, c[3]);
  });
}

/** A gourd: two lobes, one above the other. */
function gourd(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(5, 0, 6, 1, WOOD[2]);
    disc(im, 6, 4, 2, c);
    im.rect(5, 5, 6, 6, c[1]);
    disc(im, 6, 8, 3, c);
  });
}

// ---- Bowls and cups ----

function bowl(name: string, body: Ramp, food: Ramp, top: (im: Img) => void, lit = true): SpriteDef {
  return icon(name, (im) => {
    im.rect(1, 7, 10, 8, body[2]);
    im.rect(2, 9, 9, 9, body[1]);
    im.rect(3, 10, 8, 10, body[1]);
    if (lit) im.rect(1, 7, 3, 7, body[3]);
    im.rect(2, 6, 9, 6, food[2]);
    im.rect(2, 6, 4, 6, food[3]);
    top(im);
  });
}

// ---- Books ----

/** A book with a cover color and an emblem. The emblem says what it is about, not what it says. */
function book(
  name: string,
  cover: readonly [number, number],
  emblem: readonly string[],
): SpriteDef {
  return icon(name, (im) => {
    im.rect(2, 1, 9, 10, cover[1]);
    im.rect(2, 1, 3, 10, cover[0]);
    im.rect(9, 2, 9, 9, KEY.w as number);
    im.rect(2, 10, 9, 10, cover[0]);
    emblem.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '#') im.set(4 + x, 3 + y, KEY['3'] as number);
      }),
    );
  });
}

const MANUAL_BOOKS: readonly [string, readonly [number, number], readonly string[]][] = [
  ['manual_lunge', [28, 29], ['..##', '.##.', '##..', '#..#']],
  ['manual_palm', [4, 5], ['#.#.', '####', '####', '.##.']],
  ['manual_light_feet', [8, 9], ['#...', '##..', '..#.', '..##']],
  ['manual_kindling', [20, 21], ['..#.', '.##.', '####', '.##.']],
  ['manual_splash', [12, 13], ['....', '##.#', '.###', '####']],
  ['manual_gust', [14, 15], ['###.', '#..#', '..#.', '...#']],
  ['manual_stone_fist', [16, 17], ['..##', '.###', '####', '####']],
  ['manual_mend', [40, 41], ['#.#.', '.#.#', '#.#.', '.#.#']],
  ['manual_road_songs', [44, 45], ['.#..', '##..', '####', '###.']],
  ['manual_hide', [1, 2], ['....', '####', '.##.', '....']],
  ['manual_hex', [24, 25], ['####', '#..#', '#..#', '####']],
];

// ---- Everything that was a borrowed or look-alike icon ----

export const DISTINCT_ICONS: readonly SpriteDef[] = [
  // Swords, spears and tools: tier lines (see ICON_VARIANT_GROUPS).
  sword('sword_rusty', RUST, [[5, 4, 20]]),
  sword('sword_bronze', BRONZE, [[4, 5, 46]]),
  sword('sword_iron', METAL, [[6, 7, 31]]),
  sword('sword_steel', STEELB, [[3, 5, 3]]),
  spear('spear_ash', WOOD, METAL, []),
  spear('spear_hunter', TAN, METAL, [
    [7, 3, 30],
    [7, 4, 30],
  ]),
  spear('spear_iron', METAL, METAL, [
    [8, 4, 31],
    [9, 4, 31],
    [10, 4, 31],
  ]),
  spear('spear_steel', STONE, STEELB, [
    [7, 0, 3],
    [11, 2, 3],
  ]),
  pick('pick_copper', COPPER, COPPER[1]),
  pick('pick_iron', METAL, METAL[1]),
  axe('axe_copper', COPPER, COPPER[1]),
  axe('axe_iron', METAL, METAL[1]),
  sickle('sickle_copper', COPPER, COPPER[1]),
  sickle('sickle_iron', METAL, METAL[1]),
  hammer('hammer_copper', COPPER, COPPER[1]),
  hammer('hammer_iron', METAL, METAL[1]),
  maul('maul_oak', WOOD),
  maul('maul_iron', STEELB),
  rod('rod_ash', WOOD, [[5, 6, 3]]),
  rod('rod_yew', GOLD, [[6, 5, 6]]),

  // Potions: health a round flask, stamina a tall vial, focus a square bottle, cures a jar, a
  // salve a tin, an oil a cruet, and the four buffs each their own shape. Minor and full share a
  // shape and differ in size.
  roundFlask('potion_health_s', ROSE, false),
  roundFlask('potion_health_m', FIRE, true),
  tallVial('potion_stamina', LEAF, false),
  tallVial('potion_stamina_m', LEAF, true),
  squareBottle('potion_focus', WATER, false),
  squareBottle('potion_focus_m', WATER, true),
  jar('antidote', LEAF, 46),
  jar('warming_draught', ROSE, 22),
  tin('fire_salve', FIRE),
  cruet('oil_keenness', GOLD),
  conical('potion_swift', GOLD),
  diamond('potion_ward', STONE),
  longNeck('potion_clarity', VIOLET),
  gourd('potion_vigor', FIRE),
  // The dew vial hangs a drop; the water flask is a strapped canteen.
  art('dew_vial', [
    '............',
    '.....oo.....',
    '.....ww.....',
    '....wbbw....',
    '....wbBw....'.replace('B', 'c'),
    '.....bc.....',
    '....bcCb....',
    '...bcCCcb...',
    '...bccCcb...',
    '....bbbb....',
    '............',
    '............',
  ]),
  art('water_flask', [
    '............',
    '...k.kk.k...',
    '...kkddkk...',
    '....kddk....',
    '..sssSSsss..',
    '.ssSSSSSSss.',
    '.ssSbbbbSss.',
    '.ssSbcCbSss.',
    '.ssSbbbbSss.',
    '.ssSSSSSSss.',
    '..ssssssss..',
    '............',
  ]),

  // Keys: brass with a round bow, iron with a square one, a wooden grip, a twist of root.
  art('foreman_key', [
    '............',
    '...hhhhhh...',
    '...hjjjjh...',
    '...hj..jh...',
    '...hj..jh...',
    '...hjjjjh...',
    '...hhjjhh...',
    '.....hj.....',
    '.....hjhh...',
    '.....hj.....',
    '.....hjhhh..',
    '............',
  ]),
  art('mill_key', [
    '............',
    '....kkkk....',
    '...kKKKKk...',
    '...kKJJKk...',
    '...kKJJKk...',
    '...kKKKKk...',
    '....kkkk....',
    '.....hj.....',
    '.....hjhh...',
    '.....hj.....',
    '.....hjh....',
    '............',
  ]),
  art('root_key', [
    '............',
    '...kkdkk....',
    '..kd...dk...',
    '..k.....k...',
    '..kd...dk...',
    '...kkdkk....',
    '....kdk.....',
    '.....kd.....',
    '....dk......',
    '.....kdk....',
    '......dk....',
    '.....kdkk...',
  ]),

  // Letters and manuals.
  art('pilgrim_letter', [
    '............',
    '..wwwwwwww..',
    '..wxxxxxxw..',
    '..wwxxxxww..',
    '..wxwxxwxw..',
    '..wxxrrxxw..',
    '..wxxrRxxw..',
    '..wxwxxwxw..',
    '..wwxxxxww..',
    '..wxxxxxxw..',
    '..wwwwwwww..',
    '............',
  ]),
  art('wren_page', [
    '............',
    '..wwwwwww...',
    '..wxxxxxxw..',
    '..wxtttxxw..',
    '..wxxxxxxw..',
    '..wxtttttw..',
    '..wxxxxxw...',
    '..wxttxxw...',
    '...wxxxxxw..',
    '....wxxxw...',
    '......wxw...',
    '............',
  ]),
  ...MANUAL_BOOKS.map(([n, cover, emblem]) => book(n, cover, emblem)),

  // Things that were borrowing an icon.
  art('fishing_net', [
    '............',
    '.2222222222.',
    '.2.2.2.2.2..',
    '..2.2.2.2.2.',
    '.2222222222.',
    '.2.2.2.2.2..',
    '..2.2.2.2.2.',
    '.2222222222.',
    '.2.2.2.2.2..',
    '..2.2.2.2.2.',
    '.2222222222.',
    '............',
  ]),
  icon('cart_wheel', (im) => {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const d = Math.hypot(x - 5.5, y - 5.5);
        if (d <= 5.2 && d >= 3.6) im.set(x, y, WOOD[2]);
        else if (d < 3.6 && (x === 5 || x === 6 || y === 5 || y === 6)) im.set(x, y, WOOD[1]);
        if (d < 1.6) im.set(x, y, WOOD[3]);
      }
  }),
  art('firebrick', [
    '............',
    '............',
    '............',
    '.yyyyyyyyyy.',
    '.RRRRRRRRRR.',
    '.RrRRrRRRRr.',
    '.rrRrrRrrRr.',
    '.rerrrrerrr.',
    '.eeeeeeeeee.',
    '............',
    '............',
    '............',
  ]),
  icon('bakers_loaf', (im) => {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const d = ((x - 5.5) / 5) ** 2 + ((y - 6.5) / 3.6) ** 2;
        if (d > 1) continue;
        im.set(x, y, y < 5 ? 47 : y < 8 ? 46 : 45);
      }
    for (const [x, y] of [
      [3, 5],
      [4, 6],
      [6, 5],
      [7, 6],
      [8, 5],
    ] as const)
      im.set(x, y, 44);
  }),
  icon('bakers_peel', (im) => {
    line(im, 1, 10, 6, 5, WOOD[2]);
    line(im, 2, 10, 7, 5, WOOD[1]);
    im.rect(6, 1, 10, 5, WOOD[3]);
    im.rect(6, 1, 10, 1, CREAM[3]);
    im.rect(10, 2, 10, 5, WOOD[2]);
  }),
  icon('crow_feather_charm', (im) => {
    im.rect(4, 0, 7, 0, 1);
    im.rect(4, 1, 4, 2, 1);
    im.rect(7, 1, 7, 2, 1);
    line(im, 5, 11, 7, 3, 17);
    line(im, 6, 11, 8, 3, 16);
    line(im, 5, 10, 7, 5, WATER[1]);
    im.rect(6, 2, 8, 3, 17);
    im.set(5, 3, 45);
  }),
  icon('wayfarers_cloak', (im) => {
    disc(im, 5.5 | 0, 3, 2, WATER);
    for (let y = 4; y <= 10; y++) {
      const half = 2 + Math.floor((y - 4) * 0.6);
      im.rect(6 - half, y, 5 + half, y, y < 7 ? WATER[2] : WATER[1]);
      im.set(6 - half, y, WATER[3]);
    }
    im.set(5, 5, 46);
    im.set(6, 5, 47);
  }),

  // Ores: a grey lump flecked with orange, a dark one flecked with rust, black faceted coal in two
  // pieces, and a smooth orb of stone essence.
  art('copper_ore', [
    '............',
    '............',
    '....sss.....',
    '..sssSSss...',
    '.ssSrSssSs..',
    '.sSsssRsss..',
    'ssSssSsrsSs.',
    'ssrssSssssp.',
    '.ssSsssrspp.',
    '..ssspppp...',
    '...pppp.....',
    '............',
  ]),
  art('iron_ore', [
    '............',
    '............',
    '...qqqqq....',
    '..qpqqpqq...',
    '.qpkqqpqqq..',
    '.qqqqkqppq..',
    'qpqkqqqqqpq.',
    'qqqqpqkqqq..',
    '.qpqqqqpq...',
    '..pppppp....',
    '............',
    '............',
  ]),
  art('coal', [
    '............',
    '............',
    '....tt......',
    '...tttt.xx..',
    '..ttxtt.tttt',
    '..tttttttxtt',
    '..ttttt.tttt',
    '.tttxt...tt.',
    '.ttttt......',
    '..tt........',
    '............',
    '............',
  ]),
  icon('essence_stone', (im) => {
    disc(im, 6, 6, 4, STONE);
    im.rect(4, 4, 5, 5, 3);
    im.set(8, 8, 17);
  }),

  // Food in bowls, each with something on top: berries, chunks, a fish tail, a cap, a flower.
  art('herb_tea', [
    '............',
    '.....l......',
    '....l.......',
    '..wwwwww....',
    '.wGGGGGGww..',
    '.wwwwwwww.w.',
    '.wwwwwwww.w.',
    '..wwwwwwww..',
    '...wwwww....',
    '............',
    '............',
    '............',
  ]),
  bowl('berry_compote', STONE, VIOLET, (im) => {
    disc(im, 4, 4, 1, VIOLET);
    disc(im, 7, 4, 1, VIOLET);
    disc(im, 6, 5, 1, ROSE);
  }),
  bowl('hearty_stew', WOOD, FIRE, (im) => {
    im.set(4, 5, 7);
    im.set(6, 5, 23);
    im.set(8, 5, 7);
    im.set(5, 4, 22);
  }),
  bowl('silver_chowder', METAL, CREAM, (im) => {
    im.rect(7, 2, 8, 3, WATER[2]);
    im.set(9, 1, WATER[3]);
    im.set(9, 3, WATER[3]);
    im.set(6, 4, WATER[2]);
  }),
  bowl('mushroom_soup', [4, 40, 41, 42], WOOD, (im) => {
    im.rect(4, 4, 7, 5, 6);
    im.rect(5, 3, 6, 3, 6);
    im.set(5, 4, 3);
    im.set(7, 5, 3);
  }),
  bowl('sunwort_porridge', GOLD, CREAM, (im) => {
    im.rect(5, 3, 6, 4, 23);
    im.set(5, 2, 23);
    im.set(6, 2, 23);
    im.set(4, 3, 23);
    im.set(7, 4, 23);
    im.set(5, 3, 22);
  }),
  art('trail_biscuit', [
    '............',
    '............',
    '..xxxxxxxx..',
    '.xwwwwwwwwx.',
    '.xwtwwwwtwx.',
    '.xwwwwtwwwx.',
    '.xwtwwwwtwx.',
    '.xwwwwwwwwx.',
    '..xxxxxxxx..',
    '............',
    '............',
    '............',
  ]),

  // Plants and small things that looked like each other.
  art('sunwort', [
    '............',
    '....yyy.....',
    '...yyRyy....',
    '....yyy.....',
    '.....G......',
    '..l..G..l...',
    '...lGG.l....',
    '.....GGl....',
    '.....G......',
    '.....G......',
    '............',
    '............',
  ]),
  art('dewmint', [
    '............',
    '......l.....',
    '....l.lm....',
    '...lmlGm....',
    '....mGmG....',
    '..l.GmG.l...',
    '.lmGmGmGml..',
    '..mGmGmGm...',
    '....GmG.....',
    '.....G......',
    '.....G......',
    '............',
  ]),
  art('hide_rough', [
    '............',
    '..d.kkk.d...',
    '.dkkKKkkkd..',
    '.kKKkKKKkk..',
    'dkKkKKkkKkd.',
    '.kkKKkKKkk..',
    '.dkkKKkkKkd.',
    '..kKkkKkk...',
    '...dkkkd....',
    '............',
    '............',
    '............',
  ]),
  art('leather_strip', [
    '............',
    '............',
    '.kkkkkkkkk..',
    '.KKKKKKKKKk.',
    '.KJJJJJJJKk.',
    '.KKKKKKKKKk.',
    '.kkkkkkkkk..',
    '.k.k.k.k.k..',
    '............',
    '............',
    '............',
    '............',
  ]),
  art('worn_map', [
    '............',
    '..2222.222..',
    '.233323.32..',
    '.2332..2332.',
    '.23.RR..332.',
    '.2..R.R..32.',
    '.2332..R.32.',
    '.233323RR32.',
    '.2222222222.',
    '............',
    '............',
    '............',
  ]),
  art('burnt_mess', [
    '............',
    '.....t......',
    '....t.t.....',
    '..ttttt.....',
    '.tttootttt..',
    '.toottttott.',
    '.tttttootttt',
    '..ttoottttt.',
    '...tttttt...',
    '............',
    '............',
    '............',
  ]),
  art('river_pebble', [
    '............',
    '............',
    '............',
    '....SSSSS...',
    '...SsssssS..',
    '..SssssssqS.',
    '..SsssssqqS.',
    '...SsqqqqS..',
    '....SSSSS...',
    '............',
    '............',
    '............',
  ]),
];
