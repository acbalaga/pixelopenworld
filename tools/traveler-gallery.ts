/**
 * Contact sheet of generated Travelers (POW-M5-02, `npm run traveler-gallery`). The first 60
 * identities of a seed, each drawn as its doll with its handle under it, to
 * `docs/ops/evidence/pow-m5-02/gallery.png`. A dev tool, so the handles use the bitmap font.
 * Usage: `npm run traveler-gallery -- [seed] [count]`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { layersFor } from '../src/content/dolls/parts';
import { SMALL_GLYPHS } from '../src/content/fonts/small';
import { SPRITES } from '../src/content/sprites';
import { gridFromDef, TRANSPARENT } from '../src/content/sprites/grid';
import { PALETTE } from '../src/content/sprites/palette';
import { composeFrame } from '../src/render/doll';
import { identitiesOf } from '../src/sim/travelers';
import { encodePng, hex, newImage, put } from './bake-assets/png';

const seed = Number(process.argv[2] ?? 1);
const count = Number(process.argv[3] ?? 60);
const COLS = 10;
const SCALE = 3;
const CELL_W = 24 * SCALE + 18;
const CELL_H = 32 * SCALE + 14;
const BG = hex('#34374a');
const INK = hex('#e8e6df');

const defs = new Map(SPRITES.map((s) => [s.id, s]));
const provider = (id: string, frame: string): Uint8Array => gridFromDef(defs.get(id)!, frame);

const rows = Math.ceil(count / COLS);
const img = newImage(CELL_W * COLS, CELL_H * rows);
for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) put(img, x, y, BG);

function text(s: string, x0: number, y0: number): void {
  const scale = 1;
  const w = [...s].length * 6 * scale;
  let x = x0 + Math.floor((CELL_W - w) / 2);
  for (const ch of s) {
    const glyph = SMALL_GLYPHS[ch] ?? SMALL_GLYPHS['?'];
    if (glyph)
      glyph.forEach((row, gy) =>
        [...row].forEach((c, gx) => {
          if (c === '#') put(img, x + gx, y0 + gy, INK);
        }),
      );
    x += 6;
  }
}

identitiesOf(seed)
  .slice(0, count)
  .forEach((t, i) => {
    const cx = (i % COLS) * CELL_W;
    const cy = Math.floor(i / COLS) * CELL_H;
    const px = composeFrame(provider, layersFor(t.look), 'idle_down', t.look.height ?? 'mid');
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 24; x++) {
        const v = px[y * 24 + x] as number;
        if (v === TRANSPARENT) continue;
        const rgb = hex(PALETTE[v] as string);
        for (let dy = 0; dy < SCALE; dy++)
          for (let dx = 0; dx < SCALE; dx++)
            put(img, cx + 9 + x * SCALE + dx, cy + 2 + y * SCALE + dy, rgb);
      }
    text(t.handle.slice(0, 16), cx, cy + 32 * SCALE + 4);
  });

const OUT = 'docs/ops/evidence/pow-m5-02';
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/gallery.png`, encodePng(img));
console.log(`traveler-gallery: ${count} Travelers of seed ${seed} in ${OUT}/gallery.png`);
