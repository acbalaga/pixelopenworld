/**
 * Region spec format (POW-M4-02). A region is a grid of chunks described by coarse masks, a road
 * graph, river polylines, placements and spawn zones. `tools/bake-world` turns it into chunk files.
 * Coordinates are tiles from the region's top left unless a field says otherwise.
 */

/** Ground a road lays down. */
export type RoadSurface = 'dirt' | 'cobble' | 'planks';

export interface TilePoint {
  x: number;
  y: number;
}

/**
 * A placement. With `stamp` it places that stamp with its anchor on (x, y). Without it, it puts
 * one object of `kind` on that tile (a gathering node, a Waystone, a sign).
 */
export interface Placement {
  kind: string;
  x: number;
  y: number;
  stamp?: string;
  variant?: string;
  rotate?: 0 | 90 | 180 | 270 | 'mirror';
}

export interface RoadEdge {
  a: string;
  b: string;
  /** Tiles wide, 1 to 9. */
  width: number;
  surface: RoadSurface;
}

export interface River {
  id: string;
  points: readonly TilePoint[];
  /** Tiles wide, 1 to 9. */
  width: number;
}

/** A spawn zone: a polygon in tiles, and the roster that spawns inside it (design/04). */
export interface SpawnZone {
  id: string;
  roster: string;
  polygon: readonly TilePoint[];
}

/** A dungeon or cellar. M4-08 adds its room graph. Until then it is one stamp. */
export interface InteriorSpec {
  id: string;
  stamp: string;
}

export interface NamedPoint extends TilePoint {
  id: string;
}

export interface RegionSpec {
  id: string;
  /** Seeds every fill generator. */
  seed: number;
  /** Size in chunks. */
  chunks: { w: number; h: number };
  /** Biome character to biome id (see `FILL_BIOMES`). */
  biomeLegend: Readonly<Record<string, string>>;
  /** One character per 8 x 8 tiles: `chunks.h * 4` rows of `chunks.w * 4` characters. */
  biomes: readonly string[];
  /** Same grid, digits 0 to 9. A drop between neighbors becomes a cliff. */
  elevation: readonly string[];
  roads: {
    nodes: Readonly<Record<string, TilePoint>>;
    edges: readonly RoadEdge[];
  };
  rivers: readonly River[];
  placements: readonly Placement[];
  zones: readonly SpawnZone[];
  interiors: readonly InteriorSpec[];
  landmarks: readonly NamedPoint[];
  wakePoints: readonly NamedPoint[];
  waystones: readonly NamedPoint[];
}
