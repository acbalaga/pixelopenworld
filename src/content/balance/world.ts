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
  /** Interact needs the avatar idle. Waystones restore all pools. */
  waystoneHeals: true,
} as const;
