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

/**
 * A named part of a hub or settlement, in region tiles: what the bake checks read. A `square` may
 * hold civic things only (no station, bed or counter). A `street` must be at least 3 tiles wide
 * and clear of anything solid.
 */
export interface District {
  id: string;
  kind:
    | 'square'
    | 'street'
    | 'craft_row'
    | 'rune_house'
    | 'inn'
    | 'guard_yard'
    | 'market'
    | 'home'
    | 'gate';
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A point of interest, as the bake checks see it (POW-M4-11). */
export interface PoiPoint extends TilePoint {
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
  /** Hub districts and streets, for the bake checks (optional). */
  districts?: readonly District[];
  /** Points of interest, for the discoverable checks (optional). */
  pois?: readonly PoiPoint[];
  /**
   * Land chunks, as `cx,cy`, that hold no discoverable yet. The bake fails for a chunk that has
   * none and is not listed, and for a listed chunk that has one, so the list only shrinks. It is
   * empty when POW-M4-11 is done.
   */
  pendingDiscoverables?: readonly string[];
  /**
   * Secrets, with the skill that reaches each if its route is a skill route. The bake fails if
   * fewer than a fifth of them list a non-combat skill (not an arms or magic skill).
   */
  secrets?: readonly { id: string; skill?: string }[];
  /** Landmarks tall enough to see from afar, with their height in tiles. Checked by the bake. */
  landmarkHeights?: Readonly<Record<string, number>>;
}
