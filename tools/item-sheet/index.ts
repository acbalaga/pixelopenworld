// CLI: `tsx tools/item-sheet/index.ts [outDir]`. Every item icon at 4x with its name under it,
// grouped by category: the evidence sheets for POW-M4-22F.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEMS } from '../../src/content/items';
import { SPRITES } from '../../src/content/sprites';
import { PALETTE } from '../../src/content/sprites/palette';
import { ITEM_STRINGS } from '../../src/content/strings/items';
import { encodePng, fill, hex, newImage } from '../bake-assets/png';
import { renderFrame, text } from '../bake-assets/sheets';

const out = process.argv[2] ?? 'docs/ops/evidence/pow-m4-22f';
mkdirSync(out, { recursive: true });
const byId = new Map(SPRITES.map((s) => [s.id, s]));
const SCALE = 4;
const CELL_W = 88;
const CELL_H = 12 * SCALE + 14;
const COLS = 7;
const BG = hex('#2c3a47');

const groups = new Map<string, (typeof ITEMS)[string][]>();
for (const i of Object.values(ITEMS))
  groups.set(i.category, [...(groups.get(i.category) ?? []), i]);

for (const [cat, list] of groups) {
  list.sort((a, b) => a.id.localeCompare(b.id));
  const rows = Math.ceil(list.length / COLS);
  const img = newImage(COLS * CELL_W, rows * CELL_H);
  fill(img, 0, 0, img.width, img.height, BG);
  list.forEach((item, n) => {
    const x0 = (n % COLS) * CELL_W;
    const y0 = Math.floor(n / COLS) * CELL_H;
    const s = byId.get(item.icon);
    if (s) {
      const f = renderFrame(s, 'base');
      for (let j = 0; j < f.height; j++)
        for (let i = 0; i < f.width; i++) {
          const k = (j * f.width + i) * 4;
          if (f.data[k + 3] === 0) continue;
          fill(img, x0 + (CELL_W - 12 * SCALE) / 2 + i * SCALE, y0 + 2 + j * SCALE, SCALE, SCALE, [
            f.data[k] as number,
            f.data[k + 1] as number,
            f.data[k + 2] as number,
          ]);
        }
    }
    const name = (ITEM_STRINGS[item.nameKey] ?? item.id).slice(0, 21);
    text(img, name, x0 + 2, y0 + 12 * SCALE + 5, 1, hex(PALETTE[3] as string));
  });
  writeFileSync(join(out, `items-${cat}.png`), encodePng(img));
}
console.log('item-sheet: wrote', groups.size, 'sheets to', out);
