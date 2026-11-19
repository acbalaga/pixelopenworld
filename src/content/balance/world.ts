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
