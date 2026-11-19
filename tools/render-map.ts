// CLI: `tsx tools/render-map.ts [out.png] [x0,y0,x1,y1] [--region <id>]`. Stitches the baked chunks
// of the slice map (or of a baked region under baked/world/<id>) into one PNG, with the same layers and tile art the game draws (no entities). Optional
// rectangle in tiles crops the render.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { GRASS_VARIANTS, TERRAINS, TILESET } from '../src/content/world/tileset';
import { blobIndex } from '../src/shared/autotile';
import { CHUNK_TILES, decodeChunk, tileIndex } from '../src/sim/world/chunk';
import { TileWorld } from '../src/sim/world/world';
import { readdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baked = join(root, 'baked');
const manifest = JSON.parse(readFileSync(join(baked, 'manifest.json'), 'utf8')) as {
  sprites: Record<
    string,
    {
      origin: number[];
      frames: Record<string, { x: number; y: number; w: number; h: number }>;
      anims: Record<string, { frames: string[] }>;
    }
  >;
  tiles: Record<string, { sprite: string; frame: string; animated?: boolean; offset?: number[] }>;
};
const atlas = PNG.sync.read(readFileSync(join(baked, 'atlas-core.png')));

const argv = process.argv.slice(2);
const ri = argv.indexOf('--region');
const region = ri >= 0 ? (argv[ri + 1] as string) : 'slice';
if (ri >= 0) argv.splice(ri, 2);
const chunkDir = join(baked, 'world', region);
const files = readdirSync(chunkDir).filter((n) => /^chunk-\d+-\d+\.bin$/.test(n));
const world = new TileWorld(
  files.map((f) => decodeChunk(new Uint8Array(readFileSync(join(chunkDir, f))))),
);
const b = world.bounds();
if (!b) throw new Error('no slice chunks baked');

const crop = argv[1]?.split(',').map(Number);
const [cx0, cy0, cx1, cy1] =
  crop && crop.length === 4 ? (crop as [number, number, number, number]) : [b.x0, b.y0, b.x1, b.y1];
const out = new PNG({ width: (cx1 - cx0) * 16, height: (cy1 - cy0) * 16 });

/** Draws a frame with its top left at (dx, dy), alpha blended. */
function blit(sprite: string, frame: string, dx: number, dy: number): void {
  const s = manifest.sprites[sprite];
  const f = s?.frames[frame];
  if (!s || !f) throw new Error(`missing ${sprite}/${frame}`);
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const ox = dx + x;
      const oy = dy + y;
      if (ox < 0 || oy < 0 || ox >= out.width || oy >= out.height) continue;
      const si = ((f.y + y) * atlas.width + f.x + x) * 4;
      const a = (atlas.data[si + 3] as number) / 255;
      if (a === 0) continue;
      const di = (oy * out.width + ox) * 4;
      for (let k = 0; k < 3; k++)
        out.data[di + k] = Math.round(
          (atlas.data[si + k] as number) * a + (out.data[di + k] as number) * (1 - a),
        );
      out.data[di + 3] = 255;
    }
  }
}

/** A tile sprite anchored like the game: bottom center of the tile is (8, 14) of its cell. */
function tileSprite(id: string, tx: number, ty: number): void {
  const t = manifest.tiles[id];
  if (!t) throw new Error(`tile ${id} missing`);
  const s = manifest.sprites[t.sprite];
  if (!s) throw new Error(`sprite ${t.sprite} missing`);
  const frame = t.animated ? (s.anims[t.frame]?.frames[0] as string) : t.frame;
  const off = (t.offset ?? [0, 0]) as [number, number];
  blit(
    t.sprite,
    frame,
    (tx - cx0) * 16 + 8 - (s.origin[0] as number) + off[0],
    (ty - cy0) * 16 + 14 - (s.origin[1] as number) + off[1],
  );
}

const info = new Map(TERRAINS.map((t) => [t.id, t]));
for (let ty = cy0; ty < cy1; ty++) {
  for (let tx = cx0; tx < cx1; tx++) {
    const t = world.terrainAt(tx, ty);
    if (t === 0) continue;
    const hash = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 7;
    const ti = info.get(t);
    const bases = ti?.bases ?? GRASS_VARIANTS;
    blit(bases[hash % bases.length] as string, 'base', (tx - cx0) * 16, (ty - cy0) * 16);
    if (ti?.overlay) {
      const idx = blobIndex(world.neighborMask(tx, ty, t));
      blit(
        ti.overlay.sprite,
        `b${String(idx).padStart(2, '0')}_0`,
        (tx - cx0) * 16,
        (ty - cy0) * 16,
      );
    }
  }
}
const layers = ['detail', 'object', 'overhead'] as const;
for (const layer of layers) {
  for (let ty = cy0 - 2; ty < cy1 + 4; ty++) {
    for (let tx = cx0 - 2; tx < cx1 + 2; tx++) {
      const c = world.chunk(Math.floor(tx / CHUNK_TILES), Math.floor(ty / CHUNK_TILES));
      if (!c) continue;
      const v = c[layer][tileIndex(tx - c.cx * CHUNK_TILES, ty - c.cy * CHUNK_TILES)] as number;
      if (v !== 0) tileSprite(TILESET[v - 1] as string, tx, ty);
    }
  }
}
const target = argv[0] ?? join(root, region ? `map-${region}.png` : 'map-slice.png');
writeFileSync(target, PNG.sync.write(out, { colorType: 2, deflateLevel: 9, filterType: 4 }));
console.log(`render-map: ${out.width}x${out.height} -> ${target}`);
