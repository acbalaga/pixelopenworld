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
  /** How much of a bedroll's Rested a night at a rest point gives (POW-M5-25), as a share of its length. */
  campRestedShare: 0.5,
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
 * Spawn zones (POW-M4-05, regions/01-dawnmeadow section 3). Difficulty rises with distance from
 * Hearthford in three steps inside a tier. A zone creature's Health and Power are its data values
 * times its step's percent.
 */
export const SPAWNS = {
  steps: {
    a: { hpPct: 100, powerPct: 100 },
    b: { hpPct: 110, powerPct: 110 },
    c: { hpPct: 120, powerPct: 120 },
  },
  /** No hostile or territorial spawner within this many tiles of a wake point, road or wall. */
  clearTiles: 12,
  /** Creatures that never start a fight (skittish, curious, passive) may stand this close instead. */
  calmClearTiles: 4,
  /** Zone spawners stand on a lattice this many tiles apart, each nudged by up to `jitterTiles`. */
  spacingTiles: 24,
  jitterTiles: 5,
  /** A zone spawner keeps this many alive; a pack or flock creature keeps `packCap`. */
  cap: 2,
  packCap: 3,
  /** Ticks between respawns once below the cap. */
  respawn: 900,
  /** Spawns within this many px of the spawner. */
  radius: 48,
} as const;
