import { describe, expect, it } from 'vitest';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { CELLS_PER_CHUNK, MapImage } from '../../src/render/mapImage';
import { PALETTE_RGB } from '../../src/content/world/mapStyle';
import { createChunk, decodeChunk, Solid } from '../../src/sim/world/chunk';
import { FULL_CHUNK, type Fog } from '../../src/sim/world/fog';
import { bakeRegion } from '../../tools/bake-world/bake';

const { w, h } = DAWNMEADOW.chunks;
const files = bakeRegion(DAWNMEADOW, STAMPS);
const chunks = [...files]
  .map(([name, v]) => ({ m: /^dawnmeadow\/chunk-(\d+)-(\d+)\.bin$/.exec(name), v }))
  .filter((x) => x.m)
  .map((x) => decodeChunk(x.v as Uint8Array));
const allFog = (): Fog => {
  const fog: Fog = {};
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) fog[`${cx},${cy}`] = FULL_CHUNK;
  return fog;
};
const alpha = (out: Uint8ClampedArray, i: number): number => out[i * 4 + 3] as number;

describe('the map image', () => {
  it('paints only uncovered ground', () => {
    const img = new MapImage(2, 2);
    const c = createChunk(0, 0);
    img.setChunk(c);
    const out = new Uint8ClampedArray(CELLS_PER_CHUNK * 2 * CELLS_PER_CHUNK * 2 * 4);
    // Block (0, 0) of chunk (0, 0) only: 2 x 2 cells.
    img.paint({ '0,0': '01' + '00'.repeat(7) }, 0, 0, 32, 32, out);
    const on: number[] = [];
    for (let i = 0; i < 32 * 32; i++) if (alpha(out, i) === 255) on.push(i);
    expect(on).toEqual([0, 1, 32, 33]);
  });

  it('draws water as water and a chunk not yet read as remembered ground', () => {
    const img = new MapImage(2, 1);
    const c = createChunk(0, 0);
    c.collision.fill(Solid.Water);
    img.setChunk(c);
    const out = new Uint8ClampedArray(32 * 16 * 4);
    img.paint({ '0,0': FULL_CHUNK, '1,0': FULL_CHUNK }, 0, 0, 32, 16, out);
    const px = (i: number): number[] => [out[i * 4], out[i * 4 + 1], out[i * 4 + 2]] as number[];
    const blue = PALETTE_RGB.map((c) => c.join());
    // Water interior is a water-ramp color. The unread chunk (right half) is the grey of ground not drawn yet.
    expect(blue).toContain(px(5 * 32 + 5).join());
    expect(px(5 * 32 + 5)).not.toEqual(px(5 * 32 + 20));
    expect(img.missing({ '1,0': FULL_CHUNK, '0,0': FULL_CHUNK })).toEqual([{ cx: 1, cy: 0 }]);
  });

  it('is the same picture every time', () => {
    const img = new MapImage(w, h);
    for (const c of chunks) img.setChunk(c);
    const a = new Uint8ClampedArray(img.cw * img.ch * 4);
    const b = new Uint8ClampedArray(img.cw * img.ch * 4);
    img.paint(allFog(), 0, 0, img.cw, img.ch, a);
    img.paint(allFog(), 0, 0, img.cw, img.ch, b);
    expect(a).toEqual(b);
  });

  it('opens a fully explored region in under 200 ms', () => {
    const img = new MapImage(w, h);
    const t0 = performance.now();
    for (const c of chunks) img.setChunk(c);
    const out = new Uint8ClampedArray(img.cw * img.ch * 4);
    img.paint(allFog(), 0, 0, img.cw, img.ch, out);
    const ms = performance.now() - t0;
    expect(chunks.length).toBe(w * h);
    expect(ms).toBeLessThan(200);
    // Every cell is drawn, and the region has more than one kind of ground.
    let drawn = 0;
    const colors = new Set<string>();
    for (let i = 0; i < img.cw * img.ch; i++) {
      if (alpha(out, i) === 255) drawn++;
      colors.add(`${out[i * 4]},${out[i * 4 + 1]},${out[i * 4 + 2]}`);
    }
    expect(drawn).toBe(img.cw * img.ch);
    expect(colors.size).toBeGreaterThan(6);
  });
});
