import type { SpriteDef } from '../types';
import { Img, toSprite } from './img';

/**
 * World sprites for gatherable plants (POW-M4-22E). A node is drawn as the plant it is, never as
 * the 12 x 12 bag icon of what it yields, and it is stripped when spent, never the moss tuft.
 * Each node has `node.<name>` (ready) and `node.<name>_spent`, 16 x 16, feet on row 13. Drawn as
 * text grids: one character per palette index.
 */
const KEY: Record<string, number> = {
  g: 8,
  G: 9,
  m: 10,
  l: 11,
  y: 23,
  Y: 22,
  r: 21,
  R: 22,
  b: 13,
  B: 14,
  c: 14,
  C: 15,
  u: 24,
  v: 25,
  V: 26,
  d: 4,
  k: 5,
  K: 6,
  J: 7,
  s: 18,
  S: 19,
  w: 3,
  x: 2,
  t: 1,
  o: 0,
};

function draw(rows: readonly string[], thin = false): Img {
  const im = new Img(16, 16);
  // Rows are centered, so a shape is drawn at its own width. Interior gaps are '.'.
  // The last row stands on row 13, so every plant has its feet in the same place.
  const top = 14 - rows.length;
  rows.forEach((raw, i) => {
    const y = top + i;
    if (raw.length > 14) throw new Error(`node sprite row ${y} is ${raw.length} wide (14 at most)`);
    const row = raw.padStart(raw.length + Math.floor((16 - raw.length) / 2), '.').padEnd(16, '.');
    for (let x = 0; x < 16; x++) {
      const ch = row[x] as string;
      if (ch === '.') continue;
      const idx = KEY[ch];
      if (idx === undefined) throw new Error(`node sprite: unknown key ${ch}`);
      // A stripped plant: berries gone, a few leaves gone with them, bare twigs showing.
      if (thin && 'rRbBuvV'.includes(ch)) im.set(x, y, KEY.G as number);
      else if (thin && (x * 7 + y * 13) % 5 === 0) im.set(x, y, y > 9 ? (KEY.k as number) : null);
      else im.set(x, y, idx);
    }
  });
  outline(im);
  return im;
}

/** A one pixel dark rim on the outside of the plant only, so it stands out from grass and decor. */
function outline(im: Img): void {
  // Flood the empty space that touches the frame edge; only that space can take the rim.
  const outside = new Set<number>();
  const stack: [number, number][] = [];
  for (let x = 0; x < im.w; x++) stack.push([x, 0], [x, im.h - 1]);
  for (let y = 0; y < im.h; y++) stack.push([0, y], [im.w - 1, y]);
  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    if (x < 0 || y < 0 || x >= im.w || y >= im.h || im.get(x, y) !== null) continue;
    const k = y * im.w + x;
    if (outside.has(k)) continue;
    outside.add(k);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const edge: [number, number][] = [];
  for (const k of outside) {
    const x = k % im.w;
    const y = Math.floor(k / im.w);
    if (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => im.get(x + dx!, y + dy!) !== null)
    )
      edge.push([x, y]);
  }
  for (const [x, y] of edge) im.set(x, y, 0);
}

interface Node {
  name: string;
  ready: readonly string[];
  /** `derive` strips the berries from the ready art and thins the leaves. */
  spent: readonly string[] | 'derive';
}

const NODE_ART: readonly Node[] = [
  {
    // Sunwort heads and pale dewmint sprigs in one low clump.
    name: 'herb_patch',
    ready: [
      '.yyy.....yyy.',
      '.yYy.....yYy.',
      '..G..ll...G..',
      '.lG.lGGl..GlG',
      'lGlGGGGGGlGGGl',
      'GmGmGGmGGmGGmG',
      'GmmGmmGmmGmmGm',
      '.GmmGmmmGmmmG.',
      '..GGmGGGmGGG..',
      '...gGGgGGgG...',
    ],
    spent: [
      '..G.....G..',
      '..G..G..G.G.',
      '.GmGGmGGmGmG.',
      '.GmGmGmGGmGG.',
      '..GGmGGGmGG..',
      '...gGGgGGgG...',
    ],
  },
  {
    // Round bush, red and blue berries in clusters of four.
    name: 'berry_bush',
    ready: [
      '..gGGGGg..',
      '.gGmmlmmGg.',
      'gGmmmmmmmmGg',
      'GmrRmmmmbBmG',
      'GmrrmlmmbbmG',
      'GmmmmmmmrRlG',
      'GbBmmmmmrrmG',
      'GbbmmlmmmmmG',
      'GmmmrRmmbBmG',
      '.GmmrrmmbbG.',
      '..gGGGmGGg..',
    ],
    spent: 'derive',
  },
  {
    // Darker and taller, purple berries hanging in strings.
    name: 'nightshade_bush',
    ready: [
      '....gGg....',
      '..gGGGGGg..',
      '.gGGuGGGGg.',
      'gGGGGGGuGGg',
      'GGuGGGGGGGG',
      'GGGGGuGGGuG',
      'GGvGGGvGGGG',
      'GGVuGGVGGvG',
      '.GvGGGvGGVG.',
      '..VgGGVggG..',
    ],
    spent: 'derive',
  },
  {
    // Two or three caps of different heights on pale stalks.
    name: 'glowcap_cluster',
    ready: [
      '....CCC.....',
      '...CcccC.CC.',
      '..CcbcbcCccC',
      '..bbbbbb.cbbb',
      '.CCC.wx..bbb.',
      'CcccC.wx..wx',
      'bbbbb.wx..wx',
      '..wx..wx..wx',
      '.gGwxGGwxGGg.',
    ],
    spent: ['....x....x..', '....wx...wx.', '..xxwxxxxwxx', '.gGGgxGGGGGg.'],
  },
  {
    // Tall thin stalks with small blue flowers.
    name: 'flax_patch',
    ready: [
      '.C..C...C..',
      'CbC.CbC.CbC',
      '.l..l.C..l.',
      '.m..m.bC.m.',
      '.lm.lm..lm.',
      '.lm.mm..ml.',
      '.mm.mm..mm.',
      '.mG.mG..mG.',
      '.GG.GGGGGG.',
      '.gGGGgGGGg.',
    ],
    spent: ['.l...l...l.', '.m.l.m.l.m.', '.mG..mG..mG', '.GG.GGGGGG.', '.gGGGgGGGg.'],
  },
  {
    // A thorny bramble with white wool caught on it.
    name: 'briar_tuft',
    ready: [
      '..d.....d...',
      '.dkd...dkd.d',
      'dkdkd.dkdkdk',
      '.kdwwkdkwwdk',
      'dkkwwwkdwwwd',
      '.kdkwdkdkwdk',
      'dkdkdkdkdkdk',
      '.kGkGGkGkGkd',
      '..GkGGGkGGG.',
      '...gGGGGGg..',
    ],
    spent: [
      '..d.....d...',
      '.dkd...dkd.d',
      'dkdkd.dkdkdk',
      '.kdkkdkdkkdk',
      'dkdkdkdkdkdk',
      '.kGkGGkGkGkd',
      '..gGGGGGGGg.',
    ],
  },
  {
    // A wet clay mound with two pebbles at its foot.
    name: 'river_bank',
    ready: [
      '..kkkk..',
      '.kKKJJKk.',
      'kKKbJJKKKk',
      'kKbbKKKJKKk',
      'kKKKKkKKKKKk',
      'kKJKKKKKbbKKk',
      'kKKKKKKKKKKKKk',
      'ssSkkkkkkkkSSs',
    ],
    spent: [
      '..kkkk..',
      '.kKKKKKk.',
      'kKKKKkKKKKk',
      'kKKKKKKKKKKKk',
      'kKKKKKKKKKKKKk',
      'ssSkkkkkkkkSSs',
    ],
  },
  {
    // A web strung between two twigs.
    name: 'silk_web',
    ready: [
      'd..........d',
      'kd........dk',
      'dkw..w..w.kd',
      'dkxwwwwwwxkd',
      'kdwxwxwwxwdk',
      '.dwwwxwwwwd.',
      '.kdwxwwwxdk.',
      '..dkwwxwkd..',
      '..kdwxxwdk..',
      '...dkwwkd...',
      '...kd..dk...',
      '...dk..kd...',
    ],
    spent: [
      'd..........d',
      'kd........dk',
      'dkw........d',
      'dk.x..x..xkd',
      'kd..x.....dk',
      '.d....x...d.',
      '.kd..x...k..',
      '..dk.....d..',
      '...kd..dk...',
      '...dk..kd...',
    ],
  },
];

/** `node.<name>` and `node.<name>_spent` for every plant node. */
export function nodeSprites(): SpriteDef[] {
  return NODE_ART.flatMap((n) => [
    toSprite(`node.${n.name}`, 'core', [8, 14], { base: draw(n.ready) }),
    toSprite(`node.${n.name}_spent`, 'core', [8, 14], {
      base: n.spent === 'derive' ? draw(n.ready, true) : draw(n.spent),
    }),
  ]);
}
