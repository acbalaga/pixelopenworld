import type { CollisionGrid } from '../systems/collision';
import { blocks } from '../systems/collision';

/**
 * A small A* over the tile collision grid for Travelers (POW-M5-04). Four-way moves, a bounded
 * search, and a path of tile coordinates from start to goal (both included). Returns null when the
 * goal cannot be reached inside the bound, and the caller then stands where it is. Pure.
 */

export interface Tile {
  x: number;
  y: number;
}

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Most tiles one search may open. A trip across Hearthford is well under this. */
export const PATH_BUDGET = 3000;

export function findPath(
  grid: CollisionGrid,
  from: Tile,
  to: Tile,
  budget = PATH_BUDGET,
): Tile[] | null {
  if (from.x === to.x && from.y === to.y) return [from];
  const key = (x: number, y: number): string => `${x},${y}`;
  const open: { x: number; y: number; g: number; f: number }[] = [];
  const best = new Map<string, number>();
  const parent = new Map<string, string>();
  const h = (x: number, y: number): number => Math.abs(x - to.x) + Math.abs(y - to.y);
  open.push({ x: from.x, y: from.y, g: 0, f: h(from.x, from.y) });
  best.set(key(from.x, from.y), 0);
  let opened = 0;
  while (open.length > 0 && opened < budget) {
    // The lowest f, ties to the lowest g then the first found: stable, so paths repeat.
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i]!;
      const b = open[bi]!;
      if (a.f < b.f || (a.f === b.f && a.g > b.g)) bi = i;
    }
    const cur = open.splice(bi, 1)[0]!;
    opened++;
    if (cur.x === to.x && cur.y === to.y) {
      const out: Tile[] = [];
      let k: string | undefined = key(cur.x, cur.y);
      while (k !== undefined) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        out.push({ x, y });
        k = parent.get(k);
      }
      return out.reverse();
    }
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const goal = nx === to.x && ny === to.y;
      if (!goal && blocks(grid.solidAt(nx, ny))) continue;
      const g = cur.g + 1;
      const k = key(nx, ny);
      if (g >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g);
      parent.set(k, key(cur.x, cur.y));
      open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
    }
  }
  return null;
}
