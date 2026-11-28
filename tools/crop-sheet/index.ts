// CLI: `tsx tools/crop-sheet/index.ts [out.png]`. Every crop at its four stages on tilled earth,
// then the two giants, the dry and wet plot, and the new item icons (crops, seeds, tools), at 4x.
// The evidence sheet for POW-M6-02.
import { writeFileSync } from 'node:fs';
import { CROP_LIST } from '../../src/content/farming/crops';
import { FARMING_ITEMS } from '../../src/content/items/farming';
import { SPRITES } from '../../src/content/sprites';
import { PALETTE } from '../../src/content/sprites/palette';
import type { SpriteDef } from '../../src/content/sprites/types';
import { encodePng, fill, hex, newImage } from '../bake-assets/png';
import { renderFrame, text } from '../bake-assets/sheets';

const SCALE = 4;
const byId = new Map(SPRITES.map((s) => [s.id, s]));
const soil = byId.get('plot.soil') as SpriteDef;
type Img = ReturnType<typeof newImage>;

function blit(img: Img, s: SpriteDef, frame: string, x: number, y: number): void {
  const f = renderFrame(s, frame);
  for (let j = 0; j < f.height; j++)
    for (let i = 0; i < f.width; i++) {
      const k = (j * f.width + i) * 4;
      if (f.data[k + 3] === 0) continue;
      fill(img, x + i * SCALE, y + j * SCALE, SCALE, SCALE, [
        f.data[k] as number,
        f.data[k + 1] as number,
        f.data[k + 2] as number,
      ]);
    }
}

const LABEL = 96;
const CELL = 20 * SCALE;
const ROW = 22 * SCALE;
const half = Math.ceil(CROP_LIST.length / 2);
const W = 2 * (LABEL + 4 * CELL) + 40;
const icons = FARMING_ITEMS.map((i) => byId.get(i.icon)).filter((s): s is SpriteDef => !!s);
const ICON = 16 * SCALE;
const iconCols = Math.floor(W / ICON);
const H = half * ROW + 48 * SCALE + Math.ceil(icons.length / iconCols) * ICON + 40;
const img = newImage(W, H);
fill(img, 0, 0, W, H, hex('#3f5a2c'));
const white = hex(PALETTE[3] as string);

CROP_LIST.forEach((c, n) => {
  const col = Math.floor(n / half);
  const row = n % half;
  const x0 = col * (LABEL + 4 * CELL + 40);
  const y0 = row * ROW;
  text(img, c.id.replace('crop.', ''), x0 + 2, y0 + 30, 2, white);
  const s = byId.get(c.id);
  if (!s) return;
  for (let k = 0; k < 4; k++) {
    const x = x0 + LABEL + k * CELL;
    fill(img, x + 2 * SCALE, y0 + 4 * SCALE, 16 * SCALE, 16 * SCALE, hex('#6b4130'));
    blit(img, s, `stage_${k}`, x + 2 * SCALE, y0 + 4 * SCALE);
  }
});

let y = half * ROW + 8;
let x = 8;
for (const id of ['crop.giant_pumpkin', 'crop.giant_melon']) {
  const s = byId.get(id);
  if (s) blit(img, s, 'base', x, y);
  x += 36 * SCALE;
}
blit(img, soil, 'dry', x, y);
blit(img, soil, 'wet', x + 36 * SCALE, y);
y += 48 * SCALE + 8;
icons.forEach((s, i) => {
  blit(img, s, 'base', (i % iconCols) * ICON + 8, y + Math.floor(i / iconCols) * ICON);
});
writeFileSync(process.argv[2] ?? 'docs/ops/evidence/pow-m6-02/crops.png', encodePng(img));
console.log('crop-sheet: wrote', CROP_LIST.length, 'crops and', icons.length, 'icons');
