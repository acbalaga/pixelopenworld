// CLI: `tsx tools/node-sheet/index.ts [out.png]`. Every plant node (ready and spent) next to every
// bush and flower decor prop, on grass, at 8x. The evidence sheet for POW-M4-22E.
import { writeFileSync } from 'node:fs';
import { SPRITES } from '../../src/content/sprites';
import { NODES } from '../../src/content/items/recipes';
import { PALETTE } from '../../src/content/sprites/palette';
import { encodePng, fill, hex, newImage } from '../bake-assets/png';
import { renderFrame, text } from '../bake-assets/sheets';

const SCALE = 8;
const CELL = 20;
const byId = new Map(SPRITES.map((s) => [s.id, s]));
const grass = byId.get('tile.grass_0');

function cell(
  img: ReturnType<typeof newImage>,
  id: string,
  col: number,
  row: number,
  label: string,
): void {
  const x0 = col * CELL * SCALE;
  const y0 = row * (CELL + 4) * SCALE;
  // Grass under the sprite.
  if (grass) {
    const g = renderFrame(grass, 'base');
    for (let ty = 0; ty < CELL; ty += g.height)
      for (let tx = 0; tx < CELL; tx += g.width)
        for (let j = 0; j < g.height; j++)
          for (let i = 0; i < g.width; i++) {
            const k = (j * g.width + i) * 4;
            fill(img, x0 + (tx + i) * SCALE, y0 + (ty + j) * SCALE, SCALE, SCALE, [
              g.data[k] as number,
              g.data[k + 1] as number,
              g.data[k + 2] as number,
            ]);
          }
  }
  const s = byId.get(id);
  if (s) {
    const f = renderFrame(s, 'base');
    // Feet at the same place the game puts them: centered, two px under the bottom edge.
    const ox = Math.floor((CELL - f.width) / 2);
    const oy = CELL - f.height - 2;
    for (let j = 0; j < f.height; j++)
      for (let i = 0; i < f.width; i++) {
        const k = (j * f.width + i) * 4;
        if (f.data[k + 3] === 0) continue;
        fill(img, x0 + (ox + i) * SCALE, y0 + (oy + j) * SCALE, SCALE, SCALE, [
          f.data[k] as number,
          f.data[k + 1] as number,
          f.data[k + 2] as number,
        ]);
      }
  }
  text(img, label, x0 + 4, y0 + CELL * SCALE + 4, 3, hex(PALETTE[3] as string));
}

const nodes = Object.values(NODES).filter((n) => !n.sprite.ready.startsWith('icon.node_'));
const decor = SPRITES.filter((s) => /^prop\.(bush|flower)_/.test(s.id) && /_0$/.test(s.id));
const COLS = 6;
const rows = Math.ceil((nodes.length * 2 + decor.length) / COLS);
const img = newImage(COLS * CELL * SCALE, rows * (CELL + 4) * SCALE);
fill(img, 0, 0, img.width, img.height, hex('#1a1614'));
let n = 0;
const next = (id: string, label: string): void => {
  cell(img, id, n % COLS, Math.floor(n / COLS), label);
  n++;
};
for (const d of nodes) {
  next(d.sprite.ready, d.id.replace('node.', '') + ' ready');
  next(d.sprite.spent, d.id.replace('node.', '') + ' spent');
}
for (const s of decor) next(s.id, s.id.replace('prop.', ''));
writeFileSync(process.argv[2] ?? 'docs/ops/evidence/pow-m4-22e/nodes.png', encodePng(img));
console.log('node-sheet: wrote', n, 'cells');
