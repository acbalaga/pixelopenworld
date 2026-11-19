/**
 * Contact sheets of the doll parts (POW-M4-19, `npm run doll-sheet`). Every new part is drawn on
 * both bodies and all three heights, so a bad pixel shows. One PNG per group goes to
 * `docs/ops/doll-sheets/`, each row a variant, left to right: body a short, mid, tall, then body
 * b short, mid, tall. The legend below says which row is which.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  ACCESSORIES,
  BROWS,
  EYES,
  FACIAL,
  HAIR_COLORS,
  HAIR_STAMPS,
  MARKS,
  MOUTHS,
  SKIN_TONES,
  layersFor,
  type DollSpec,
  type Height,
} from '../../src/content/dolls/parts';
import { SPRITES } from '../../src/content/sprites';
import { gridFromDef, TRANSPARENT } from '../../src/content/sprites/grid';
import { PALETTE } from '../../src/content/sprites/palette';
import { composeFrame } from '../../src/render/doll';
import { encodePng, hex, newImage, put } from '../bake-assets/png';

const defs = new Map(SPRITES.map((s) => [s.id, s]));
const provider = (id: string, frame: string): Uint8Array => gridFromDef(defs.get(id)!, frame);

const BASE: DollSpec = {
  body: 'a',
  skin: 'light',
  hair: 'short',
  hairColor: 'brown',
  top: 'tunic',
  topColor: 'blue',
  bottom: 'trousers',
  bottomColor: 'brown',
  mainHand: 'none',
  offHand: 'none',
  markColor: 'red',
};
const HEIGHTS: Height[] = ['short', 'mid', 'tall'];
const SCALE = 4;
const BG = hex('#34374a');

interface Group {
  name: string;
  rows: { label: string; patch: Partial<DollSpec> }[];
}

const idx = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const groups: Group[] = [
  {
    name: 'eyes',
    rows: idx(EYES.length).map((i) => ({ label: `eyes ${i}`, patch: { eyes: i } })),
  },
  {
    name: 'brows',
    rows: idx(BROWS.length).map((i) => ({ label: `brows ${i}`, patch: { brows: i } })),
  },
  {
    name: 'mouths',
    rows: idx(MOUTHS.length).map((i) => ({ label: `mouth ${i}`, patch: { mouth: i } })),
  },
  {
    name: 'marks',
    rows: idx(MARKS.length).map((i) => ({ label: `mark ${i}`, patch: { mark: i } })),
  },
  {
    name: 'facial-hair',
    rows: FACIAL.map((_, i) => ({
      label: `facial ${i}`,
      patch: { facial: (['none', 'stubble', 'short', 'full'] as const)[i] ?? 'none' },
    })),
  },
  {
    name: 'accessories',
    rows: ['none', ...Object.keys(ACCESSORIES)].map((a) => ({
      label: a,
      patch: { accessory: a as NonNullable<DollSpec['accessory']> },
    })),
  },
  {
    name: 'hair-styles',
    rows: [...['short', 'long', 'ponytail', 'curly', 'bun'], ...Object.keys(HAIR_STAMPS)].map(
      (h) => ({ label: h, patch: { hair: h as DollSpec['hair'] } }),
    ),
  },
  {
    name: 'colors',
    rows: [
      ...Object.keys(SKIN_TONES).map((k) => ({
        label: `skin ${k}`,
        patch: { skin: k as DollSpec['skin'] },
      })),
      ...Object.keys(HAIR_COLORS).map((k) => ({
        label: `hair ${k}`,
        patch: { hairColor: k as DollSpec['hairColor'] },
      })),
      { label: 'tips', patch: { hairStyle2Color: 'rose' } },
    ],
  },
];

const OUT = 'docs/ops/doll-sheets';
mkdirSync(OUT, { recursive: true });
const legend: string[] = [];
for (const g of groups) {
  const cellW = 24 * SCALE + 4;
  const cellH = 32 * SCALE + 4;
  const img = newImage(cellW * 6, cellH * g.rows.length);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) put(img, x, y, BG);
  g.rows.forEach((row, r) => {
    legend.push(`${g.name} row ${r + 1}: ${row.label}`);
    let col = 0;
    for (const body of ['a', 'b'] as const) {
      for (const height of HEIGHTS) {
        const spec: DollSpec = { ...BASE, ...row.patch, body, height };
        // Idle down is the pose a setup screen shows. The face parts need a face.
        const px = composeFrame(provider, layersFor(spec), 'idle_down', height);
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 24; x++) {
            const v = px[y * 24 + x] as number;
            if (v === TRANSPARENT) continue;
            const rgb = hex(PALETTE[v] as string);
            for (let dy = 0; dy < SCALE; dy++)
              for (let dx = 0; dx < SCALE; dx++)
                put(img, col * cellW + 2 + x * SCALE + dx, r * cellH + 2 + y * SCALE + dy, rgb);
          }
        col++;
      }
    }
  });
  writeFileSync(`${OUT}/${g.name}.png`, encodePng(img));
}
writeFileSync(
  `${OUT}/README.md`,
  `# Doll part contact sheets\n\nMade by \`npm run doll-sheet\`. Each row is a variant. Left to right: body a short, mid, tall, then body b short, mid, tall.\n\n${legend.map((l) => `- ${l}`).join('\n')}\n`,
);
console.log(`doll-sheet: ${groups.length} sheets in ${OUT}`);
