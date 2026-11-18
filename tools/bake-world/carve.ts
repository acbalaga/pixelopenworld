import type { RegionSpec, RoadSurface, TilePoint } from '../../src/content/world/regions/types';
import { Terrain } from '../../src/content/world/tileset';
import { BakeError } from '../../src/sim/world/bakeError';
import { Grid, Protect } from './grid';

const SURFACE: Record<RoadSurface, number> = {
  dirt: Terrain.Dirt,
  cobble: Terrain.Cobble,
  planks: Terrain.Planks,
};

/** Tiles on the straight line between two points, in order (integer Bresenham). */
export function lineTiles(a: TilePoint, b: TilePoint): TilePoint[] {
  const out: TilePoint[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

/** The tiles a brush of `width` covers around (x, y). Width 1 is the tile itself. */
function brush(x: number, y: number, width: number): TilePoint[] {
  const lo = -Math.floor((width - 1) / 2);
  const hi = Math.floor(width / 2);
  const out: TilePoint[] = [];
  for (let dy = lo; dy <= hi; dy++)
    for (let dx = lo; dx <= hi; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

function checkPoint(g: Grid, src: string, layer: string, p: TilePoint, what: string): void {
  if (!g.inside(p.x, p.y))
    throw new BakeError(src, layer, `${what} is outside the region (${g.w}x${g.h})`, p);
}

/**
 * Rivers: water along each polyline. Stamps keep their cells. The tiles around the water are
 * banks: scatter stays off them so the edge reads clean.
 */
export function carveRivers(spec: RegionSpec, g: Grid): void {
  const src = `region ${spec.id} spec`;
  for (const r of spec.rivers) {
    for (const p of r.points) checkPoint(g, src, `rivers ${r.id}`, p, 'a river point');
    for (let s = 1; s < r.points.length; s++) {
      for (const t of lineTiles(r.points[s - 1] as TilePoint, r.points[s] as TilePoint)) {
        for (const c of brush(t.x, t.y, r.width)) {
          if (!g.inside(c.x, c.y)) continue;
          const i = g.at(c.x, c.y);
          if (g.has(i, Protect.Stamp)) continue;
          g.ground[i] = Terrain.Water;
          g.clearAbove(c.x, c.y);
          g.mark(i, Protect.River);
        }
      }
    }
  }
  // Banks: the ring one tile out from the water.
  const water: number[] = [];
  for (let i = 0; i < g.ground.length; i++) if (g.has(i, Protect.River)) water.push(i);
  for (const i of water) {
    const x = i % g.w;
    const y = Math.floor(i / g.w);
    for (const c of brush(x, y, 3)) {
      if (!g.inside(c.x, c.y)) continue;
      const j = g.at(c.x, c.y);
      if (!g.has(j, Protect.Stamp | Protect.River)) g.mark(j, Protect.Bank);
    }
  }
}

/** Roads along each edge of the graph. Where one crosses water it becomes a bridge of planks. */
export function carveRoads(spec: RegionSpec, g: Grid): { bridgeTiles: number } {
  const src = `region ${spec.id} spec`;
  let bridgeTiles = 0;
  for (const [id, n] of Object.entries(spec.roads.nodes))
    checkPoint(g, src, `roads node ${id}`, n, 'node');
  for (const e of spec.roads.edges) {
    const a = spec.roads.nodes[e.a];
    const b = spec.roads.nodes[e.b];
    if (!a) throw new BakeError(src, 'roads', `edge ${e.a} to ${e.b}: no node '${e.a}'`);
    if (!b) throw new BakeError(src, 'roads', `edge ${e.a} to ${e.b}: no node '${e.b}'`);
    for (const t of lineTiles(a, b)) {
      for (const c of brush(t.x, t.y, e.width)) {
        if (!g.inside(c.x, c.y)) continue;
        const i = g.at(c.x, c.y);
        if (g.has(i, Protect.Stamp)) continue;
        if (g.has(i, Protect.River)) {
          if (g.ground[i] === Terrain.Water) bridgeTiles++;
          g.ground[i] = Terrain.Planks;
        } else g.ground[i] = SURFACE[e.surface];
        g.clearAbove(c.x, c.y);
        g.protect[i] = ((g.protect[i] ?? 0) & ~Protect.Cliff & ~Protect.Bank) | Protect.Road;
      }
    }
  }
  return { bridgeTiles };
}
