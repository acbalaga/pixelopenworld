import { Solid } from '../world/chunk';
import { floorDiv } from '../world/world';

/** Tile edge in sub-pixel units (16 px at 1/256 px). */
export const TILE_FX = 16 * 256;

/** What collision needs from a world. */
export interface CollisionGrid {
  /** Collision value of a tile: 0 none, 1 full, 2 water. */
  solidAt(tx: number, ty: number): number;
}

/** An axis aligned box in sub-pixel units. `x`, `y` is the top left corner. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** True for collision values that block walking. */
export function blocks(v: number): boolean {
  return v === Solid.Full || v === Solid.Water;
}

/** True if the box overlaps any blocking tile. Edges are half open, so touching is not overlapping. */
export function overlapsSolid(grid: CollisionGrid, b: Box): boolean {
  const x0 = floorDiv(b.x, TILE_FX);
  const x1 = floorDiv(b.x + b.w - 1, TILE_FX);
  const y0 = floorDiv(b.y, TILE_FX);
  const y1 = floorDiv(b.y + b.h - 1, TILE_FX);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) if (blocks(grid.solidAt(tx, ty))) return true;
  return false;
}

/**
 * Moves the box by (dx, dy) in whole sub-pixel units, one axis at a time, stopping flush against
 * the first blocking tile on the way. Because it jumps to tile edges instead of stepping, a box
 * cannot tunnel at any speed, and sliding along a wall never snags on seams between tiles.
 * X is resolved first, then Y, so a diagonal push into a wall slides along it. Returns a new box.
 */
export function moveBox(grid: CollisionGrid, box: Box, dx: number, dy: number): Box {
  let { x, y } = box;
  const { w, h } = box;

  if (dx !== 0) {
    const y0 = floorDiv(y, TILE_FX);
    const y1 = floorDiv(y + h - 1, TILE_FX);
    if (dx > 0) {
      const from = floorDiv(x + w - 1, TILE_FX) + 1;
      const to = floorDiv(x + w - 1 + dx, TILE_FX);
      let limit = x + dx;
      scan: for (let tx = from; tx <= to; tx++) {
        for (let ty = y0; ty <= y1; ty++) {
          if (blocks(grid.solidAt(tx, ty))) {
            limit = tx * TILE_FX - w;
            break scan;
          }
        }
      }
      x = Math.max(x, Math.min(x + dx, limit));
    } else {
      const from = floorDiv(x, TILE_FX) - 1;
      const to = floorDiv(x + dx, TILE_FX);
      let limit = x + dx;
      scan: for (let tx = from; tx >= to; tx--) {
        for (let ty = y0; ty <= y1; ty++) {
          if (blocks(grid.solidAt(tx, ty))) {
            limit = (tx + 1) * TILE_FX;
            break scan;
          }
        }
      }
      x = Math.min(x, Math.max(x + dx, limit));
    }
  }

  if (dy !== 0) {
    const x0 = floorDiv(x, TILE_FX);
    const x1 = floorDiv(x + w - 1, TILE_FX);
    if (dy > 0) {
      const from = floorDiv(y + h - 1, TILE_FX) + 1;
      const to = floorDiv(y + h - 1 + dy, TILE_FX);
      let limit = y + dy;
      scan: for (let ty = from; ty <= to; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (blocks(grid.solidAt(tx, ty))) {
            limit = ty * TILE_FX - h;
            break scan;
          }
        }
      }
      y = Math.max(y, Math.min(y + dy, limit));
    } else {
      const from = floorDiv(y, TILE_FX) - 1;
      const to = floorDiv(y + dy, TILE_FX);
      let limit = y + dy;
      scan: for (let ty = from; ty >= to; ty--) {
        for (let tx = x0; tx <= x1; tx++) {
          if (blocks(grid.solidAt(tx, ty))) {
            limit = (ty + 1) * TILE_FX;
            break scan;
          }
        }
      }
      y = Math.min(y, Math.max(y + dy, limit));
    }
  }
  return { x, y, w, h };
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Like {@link moveBox}, and also stops flush against `others` (solid entity boxes). A box that
 * already overlaps another at the start can walk out of it, so nothing gets trapped by a spawn
 * or a push. Axes resolve X then Y, as in moveBox.
 */
export function moveBoxSolid(
  grid: CollisionGrid,
  box: Box,
  dx: number,
  dy: number,
  others: readonly Box[],
): Box {
  const free = others.filter((o) => !boxesOverlap(box, o));
  let b = moveBox(grid, box, dx, 0);
  for (const o of free) {
    if (!boxesOverlap(b, o)) continue;
    b = { ...b, x: dx > 0 ? o.x - b.w : o.x + o.w };
  }
  const afterX = b;
  b = moveBox(grid, b, 0, dy);
  for (const o of free) {
    if (!boxesOverlap(b, o)) continue;
    b = { ...b, y: dy > 0 ? o.y - b.h : o.y + o.h };
  }
  // Pushing back out of an entity must not leave the box inside a tile on the other axis.
  return overlapsSolid(grid, b) ? afterX : b;
}
