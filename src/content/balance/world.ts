/** World fixture tunables (px unless noted). */
export const WORLD_TUNABLES = {
  /** An avatar whose center is this close to a portal's tile center takes it. */
  portalRadius: 10,
  /** An avatar or block whose center is this close to a plate's center presses it. */
  plateRadius: 7,
  /** A push moves a block one tile. */
  blockStep: 16,
  /** A block may not be pushed this close to a portal or arrival, so it cannot seal an exit. */
  blockPortalClear: 20,
  /** The avatar must be this close to a bed (px) to sleep or change Paths. */
  bedReachPx: 40,
  /** Terrain painting spends at most this many ms of a frame on offscreen chunk layers (M4-03). */
  paintBudgetMs: 2,
  /** Painting only uses what is left of this much frame time (ms) after the previous frame's own work, so a heavy frame is never made heavier. */
  paintFrameCapMs: 9,
  /** Fetches in flight at once while streaming chunks. */
  fetchesInFlight: 4,
  /** Chunks farther than this many chunks from the avatar are dropped from memory (the loaded window plus one for hysteresis). */
  evictRadius: 3,
  /** Arena doors within this many px of the trigger shut with it. */
  arenaDoorReachPx: 200,
  /** Interact needs the avatar idle. Waystones restore all pools. */
  waystoneHeals: true,
} as const;

/**
 * Zone steps inside tier 1 (regions/01-dawnmeadow section 3): percent of a creature's base Health,
 * defense and power. Step a is the base. Difficulty rises with distance from Hearthford.
 */
export const SPAWN_STEPS = {
  a: { hp: 100, defense: 100, power: 100 },
  b: { hp: 125, defense: 115, power: 115 },
  c: { hp: 155, defense: 130, power: 135 },
} as const;
export type SpawnStep = keyof typeof SPAWN_STEPS;

/** A creature of the wrong phase leaves only when the avatar is at least this far away, px. */
export const PHASE_DESPAWN_PX = 240;
