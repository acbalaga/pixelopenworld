/**
 * How the map is drawn (POW-M4-06). The map is made from chunk data, one pixel for each 2 x 2
 * tiles, in the master palette only. Each cell gets one kind. When a cell holds more than one,
 * the highest priority shows, so a roof hides the grass under it and a pond reads as a pond.
 */
import { PALETTE } from '../sprites/palette';
import { Terrain, TILESET } from './tileset';

/** Kinds of map cell. 0 means the chunk has not been seen yet. */
export const Cell = {
  Unknown: 0,
  Grass: 1,
  Dirt: 2,
  Water: 3,
  Cobble: 4,
  Planks: 5,
  Cave: 6,
  Tree: 7,
  Rock: 8,
  Roof: 9,
  Wall: 10,
  Crop: 11,
} as const;

/** Higher wins when a cell holds several kinds. */
export const CELL_PRIORITY: Readonly<Record<number, number>> = {
  [Cell.Unknown]: 0,
  [Cell.Grass]: 1,
  [Cell.Cave]: 2,
  [Cell.Dirt]: 3,
  [Cell.Crop]: 4,
  [Cell.Cobble]: 5,
  [Cell.Planks]: 5,
  [Cell.Water]: 6,
  [Cell.Tree]: 7,
  [Cell.Rock]: 8,
  [Cell.Wall]: 9,
  [Cell.Roof]: 10,
};

/** Palette index of each kind: the body color, and the darker ink used for edges. */
export const CELL_COLOR: Readonly<Record<number, { fill: number; ink: number; alt?: number }>> = {
  [Cell.Grass]: { fill: 10, ink: 9, alt: 11 },
  [Cell.Dirt]: { fill: 6, ink: 5 },
  [Cell.Water]: { fill: 13, ink: 12, alt: 14 },
  [Cell.Cobble]: { fill: 18, ink: 17 },
  [Cell.Planks]: { fill: 6, ink: 4 },
  [Cell.Cave]: { fill: 17, ink: 16 },
  [Cell.Tree]: { fill: 9, ink: 8, alt: 10 },
  [Cell.Rock]: { fill: 18, ink: 16 },
  [Cell.Roof]: { fill: 5, ink: 4 },
  [Cell.Wall]: { fill: 2, ink: 1 },
  [Cell.Crop]: { fill: 11, ink: 10 },
};

/** Parchment behind the map and under fog (palette index), and the mark for ground seen but not yet drawn. */
export const MAP_PAPER = 7;
export const MAP_UNDRAWN = 2;
/** Palette indices of the map's marks. */
export const MAP_MARK = {
  player: 3,
  landmark: 47,
  waystone: 14,
  note: 21,
  rumor: 38,
  ink: 0,
} as const;

/** What an object or overhead tile does to a map cell, by tile definition id. */
function kindOfTile(def: string): number {
  if (/^tile\.(tree_|bush_)/.test(def)) return Cell.Tree;
  if (/^tile\.roof_/.test(def)) return Cell.Roof;
  if (/^tile\.(wall_|fence_)/.test(def)) return Cell.Wall;
  if (/^tile\.(rock|cave_wall)/.test(def)) return Cell.Rock;
  if (/^tile\.(crop_|hay_|reeds_)/.test(def)) return Cell.Crop;
  return Cell.Unknown;
}

/** Cell kind by tileset id (index 0 is the empty tile). */
export const TILE_CELL: Uint8Array = Uint8Array.from([
  Cell.Unknown,
  ...TILESET.map((d) => kindOfTile(d)),
]);

/** Cell kind of a ground terrain id. */
export function terrainCell(id: number): number {
  switch (id) {
    case Terrain.Dirt:
      return Cell.Dirt;
    case Terrain.Water:
      return Cell.Water;
    case Terrain.Cobble:
      return Cell.Cobble;
    case Terrain.Planks:
      return Cell.Planks;
    case Terrain.Cave:
      return Cell.Cave;
    default:
      return Cell.Grass;
  }
}

/** The palette as [r, g, b] bytes. */
export const PALETTE_RGB: readonly (readonly [number, number, number])[] = PALETTE.map((hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]);
