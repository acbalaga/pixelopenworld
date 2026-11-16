/** Sprite and tile data types. Pure types so the client bundle never pulls in zod. */

/** Load groups. Each bakes to its own atlas. */
export type AtlasGroup = 'core' | 'ui' | `region-${number}`;

/** A named animation over a sprite's frames. */
export interface AnimDef {
  frames: readonly string[];
  fps: number;
  /** Draw mirrored horizontally (left produced from right). */
  flipX?: boolean;
}

/** A sprite authored as text grids. */
export interface SpriteDef {
  id: string;
  group: AtlasGroup;
  /** Width and height of every frame. */
  size: readonly [number, number];
  /** Anchor inside the frame (feet position for characters). */
  origin: readonly [number, number];
  /** Character to palette index, or null for transparent. */
  key: Readonly<Record<string, number | null>>;
  frames: Readonly<Record<string, readonly string[]>>;
  anims?: Readonly<Record<string, AnimDef>>;
}

/** Tile collision shapes. */
export type TileCollision = 'none' | 'full' | 'half_top' | 'half_bottom' | 'water' | 'ledge';
/** Tile draw layers. */
export type TileLayer = 'ground' | 'detail' | 'object' | 'overhead';

/** A tile definition. `sprite` names a SpriteDef. Animated tiles name an animation. */
export interface TileDef {
  id: string;
  sprite: string;
  /** Frame name, or animation name when `animated` is true. */
  frame: string;
  animated?: boolean;
  layer: TileLayer;
  /** Pixels to shift the sprite from the tile anchor (bottom center of the tile). */
  offset?: readonly [number, number];
  collision: TileCollision;
  tags: readonly ('flammable' | 'diggable' | 'climbable')[];
}
