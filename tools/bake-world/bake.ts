import { createHash } from 'node:crypto';
import type { RegionSpec } from '../../src/content/world/regions/types';
import { BakeError } from '../../src/sim/world/bakeError';
import { encodeChunk } from '../../src/sim/world/chunk';
import { resolveStamp, type ResolvedStamp, type StampV2 } from '../../src/sim/world/stamp';
import { carveRivers, carveRoads } from './carve';
import { fillScatter } from './fill/scatter';
import { fillCliffs, fillTerrain } from './fill/terrain';
import { Grid, Protect } from './grid';
import { parseRegionSpec } from './schema';

export type StampLibrary = Readonly<Record<string, StampV2>>;
/** Baked files by path under `baked/world/`. */
export type WorldFiles = Map<string, Uint8Array | string>;

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex').slice(0, 16);
const fileName = (cx: number, cy: number): string => `chunk-${cx}-${cy}.bin`;

/** Looks a stamp up by id or fails naming the placement. */
function stampOf(
  lib: StampLibrary,
  id: string,
  src: string,
  layer: string,
  at: { x: number; y: number },
): StampV2 {
  const s = lib[id];
  if (!s) throw new BakeError(src, layer, `unknown stamp '${id}'`, { x: at.x, y: at.y });
  return s;
}

/** Writes a resolved stamp into a grid with its top left at (ox, oy). */
function writeStamp(
  g: Grid,
  r: ResolvedStamp,
  ox: number,
  oy: number,
  src: string,
  owner: Map<number, string> | null,
): void {
  if (ox < 0 || oy < 0 || ox + r.w > g.w || oy + r.h > g.h)
    throw new BakeError(
      src,
      'placements',
      `stamp ${r.id} (${r.w}x${r.h}) does not fit in the region (${g.w}x${g.h})`,
      { x: ox, y: oy },
    );
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const cell = r.cells[y * r.w + x];
      if (!cell) continue;
      const i = g.at(ox + x, oy + y);
      if (owner) {
        const prev = owner.get(i);
        if (prev !== undefined)
          throw new BakeError(src, 'placements', `stamp ${r.id} overlaps stamp ${prev}`, {
            x: ox + x,
            y: oy + y,
          });
        owner.set(i, r.id);
      }
      g.put(ox + x, oy + y, cell);
      g.mark(i, Protect.Stamp);
    }
  }
  for (const o of r.objects) g.objects.push({ x: ox + o.x, y: oy + o.y, kind: o.kind });
}

function inRegion(
  g: Grid,
  src: string,
  layer: string,
  p: { x: number; y: number },
  what: string,
): void {
  if (!g.inside(p.x, p.y))
    throw new BakeError(src, layer, `${what} is outside the region (${g.w}x${g.h})`, {
      x: p.x,
      y: p.y,
    });
}

/**
 * Bakes one region: chunk files, interior chunk files and `manifest.json`, all under the region's
 * folder. Deterministic: the same spec and stamps give the same bytes.
 */
export function bakeRegion(rawSpec: unknown, stamps: StampLibrary): WorldFiles {
  const spec: RegionSpec = parseRegionSpec(rawSpec);
  const src = `region ${spec.id} spec`;
  const g = new Grid(spec.chunks.w * 32, spec.chunks.h * 32);
  const owner = new Map<number, string>();
  const entrances: Record<string, { x: number; y: number }[]> = {};
  const interiorIds = new Set(spec.interiors.map((i) => i.id));

  // 1. Stamps first: they claim their tiles, and nothing else may overwrite them.
  for (const p of spec.placements) {
    if (!p.stamp) continue;
    const stamp = stampOf(stamps, p.stamp, src, 'placements', p);
    const r = resolveStamp(stamp, {
      ...(p.variant !== undefined ? { variant: p.variant } : {}),
      ...(p.rotate !== undefined ? { rotate: p.rotate } : {}),
    });
    const ox = p.x - r.anchor.x;
    const oy = p.y - r.anchor.y;
    writeStamp(g, r, ox, oy, src, owner);
    for (const d of r.doors) {
      if (!interiorIds.has(d.interior))
        throw new BakeError(
          `stamp ${r.id}`,
          'doors',
          `door leads to unknown interior '${d.interior}'`,
          { x: ox + d.x, y: oy + d.y },
        );
      g.objects.push({ x: ox + d.x, y: oy + d.y, kind: `door.${d.interior}` });
      (entrances[d.interior] ??= []).push({ x: ox + d.x, y: oy + d.y });
    }
  }
  // 2. Terrain, cliffs, rivers, roads. Each skips what an earlier step protected.
  fillTerrain(spec, g);
  fillCliffs(g);
  carveRivers(spec, g);
  const { bridgeTiles } = carveRoads(spec, g);
  // 3. Single objects, then scatter on what is left.
  for (const p of spec.placements) {
    if (p.stamp) continue;
    inRegion(g, src, 'placements', p, `object ${p.kind}`);
    g.objects.push({ x: p.x, y: p.y, kind: p.kind });
    g.mark(g.at(p.x, p.y), Protect.Stamp);
  }
  for (const [layer, list] of [
    ['landmarks', spec.landmarks],
    ['wakePoints', spec.wakePoints],
    ['waystones', spec.waystones],
  ] as const)
    for (const p of list) inRegion(g, src, layer, p, `${layer} ${p.id}`);
  for (const z of spec.zones)
    for (const p of z.polygon) inRegion(g, src, `zones ${z.id}`, p, 'a polygon point');
  fillScatter(spec, g);

  const out: WorldFiles = new Map();
  const dir = `${spec.id}/`;
  const chunkList: { file: string; cx: number; cy: number; hash: string }[] = [];
  for (const c of g.toChunks()) {
    const bytes = encodeChunk(c);
    out.set(`${dir}${fileName(c.cx, c.cy)}`, bytes);
    chunkList.push({ file: fileName(c.cx, c.cy), cx: c.cx, cy: c.cy, hash: sha(bytes) });
  }

  // 4. Interiors: their own chunk sets, numbered from (0, 0) in their own space.
  const interiors = spec.interiors.map((it) => {
    const stamp = stampOf(stamps, it.stamp, `${src}`, `interiors ${it.id}`, { x: 0, y: 0 });
    const r = resolveStamp(stamp);
    const ig = new Grid(r.w, r.h);
    writeStamp(ig, r, 0, 0, `interior ${it.id}`, null);
    const sub = `${dir}interior-${it.id}/`;
    const files: typeof chunkList = [];
    for (const c of ig.toChunks()) {
      const bytes = encodeChunk(c);
      out.set(`${sub}${fileName(c.cx, c.cy)}`, bytes);
      files.push({ file: fileName(c.cx, c.cy), cx: c.cx, cy: c.cy, hash: sha(bytes) });
    }
    return {
      id: `interior.${it.id}`,
      dir: `interior-${it.id}`,
      tiles: { w: r.w, h: r.h },
      entrances: entrances[it.id] ?? [],
      chunks: files,
    };
  });

  const manifest = {
    version: 1,
    region: spec.id,
    seed: spec.seed,
    chunks: { w: spec.chunks.w, h: spec.chunks.h },
    bridgeTiles,
    files: chunkList,
    interiors,
    landmarks: spec.landmarks,
    wakePoints: spec.wakePoints,
    waystones: spec.waystones,
    zones: spec.zones,
  };
  out.set(`${dir}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  return out;
}
