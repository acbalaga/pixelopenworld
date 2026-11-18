import type { RegionSpec } from '../../../src/content/world/regions/types';
import { FILL_BIOMES, CLIFF_TILES } from '../../../src/content/world/fill';
import { tilesetId } from '../../../src/content/world/tileset';
import { BakeError } from '../../../src/sim/world/bakeError';
import { Grid, Protect } from '../grid';

/** Cells are 8 x 8 tiles. */
export const MASK_CELL = 8;

/** Checks a mask grid has the size the region asks for. Names the first bad row. */
function checkMask(spec: RegionSpec, name: 'biomes' | 'elevation', rows: readonly string[]): void {
  const src = `region ${spec.id} spec`;
  const wantW = spec.chunks.w * 4;
  const wantH = spec.chunks.h * 4;
  if (rows.length !== wantH)
    throw new BakeError(src, name, `has ${rows.length} rows, expected ${wantH}`);
  rows.forEach((r, y) => {
    if (r.length !== wantW)
      throw new BakeError(src, name, `row has width ${r.length}, expected ${wantW}`, {
        x: r.length,
        y,
      });
  });
}

/** Ground from the biome mask, and the elevation band of every tile. Cells under a stamp keep the stamp's ground. */
export function fillTerrain(spec: RegionSpec, g: Grid): void {
  checkMask(spec, 'biomes', spec.biomes);
  checkMask(spec, 'elevation', spec.elevation);
  const src = `region ${spec.id} spec`;
  for (let cy = 0; cy < spec.biomes.length; cy++) {
    const row = spec.biomes[cy] as string;
    for (let cx = 0; cx < row.length; cx++) {
      const ch = row[cx] as string;
      const id = spec.biomeLegend[ch];
      const biome = id ? FILL_BIOMES[id] : undefined;
      if (!id)
        throw new BakeError(src, 'biomes', `unknown biome character '${ch}'`, { x: cx, y: cy });
      if (!biome)
        throw new BakeError(src, 'biomes', `biome '${id}' has no fill table`, { x: cx, y: cy });
      const e = (spec.elevation[cy] as string)[cx] as string;
      if (!/^[0-9]$/.test(e))
        throw new BakeError(src, 'elevation', `'${e}' is not a digit`, { x: cx, y: cy });
      for (let y = cy * MASK_CELL; y < (cy + 1) * MASK_CELL; y++)
        for (let x = cx * MASK_CELL; x < (cx + 1) * MASK_CELL; x++) {
          const i = g.at(x, y);
          g.elevation[i] = Number(e);
          if (g.ground[i] === 0) g.ground[i] = biome.ground;
        }
    }
  }
}

/**
 * Cliffs from elevation. A tile higher than a neighbor becomes the cliff: a face where the lower
 * tile is to the south, a top piece for any other side. Stamps and roads are never touched (a
 * road is how you climb).
 */
export function fillCliffs(g: Grid): void {
  const face = tilesetId(CLIFF_TILES.face);
  const top = tilesetId(CLIFF_TILES.top);
  const marks: { x: number; y: number; tile: number }[] = [];
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const e = g.elevation[g.at(x, y)] as number;
      const lower = (dx: number, dy: number): boolean =>
        g.inside(x + dx, y + dy) && (g.elevation[g.at(x + dx, y + dy)] as number) < e;
      if (lower(0, 1)) marks.push({ x, y, tile: face });
      else if (lower(1, 0) || lower(-1, 0) || lower(0, -1)) marks.push({ x, y, tile: top });
    }
  for (const m of marks) {
    const i = g.at(m.x, m.y);
    if (g.has(i, Protect.Stamp | Protect.Road)) continue;
    g.object[i] = m.tile;
    g.detail[i] = 0;
    g.overhead[i] = 0;
    g.mark(i, Protect.Cliff);
  }
}
