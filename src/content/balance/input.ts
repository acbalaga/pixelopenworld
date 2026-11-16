/** Input tunables. Distances are CSS px, times are ms. */
export const INPUT_TUNABLES = {
  /** Stick output is zero inside this radius. */
  stickDeadZonePx: 8,
  /** Stick output reaches 1.0 at this radius. */
  stickMaxRadiusPx: 56,
  /** A pointer that ends within this distance and time is a tap. */
  tapMaxDistPx: 10,
  tapMaxMs: 250,
  /** A fast short swipe: at least this far, at most this long. */
  flickMinDistPx: 24,
  flickMaxDistPx: 110,
  flickMaxMs: 180,
  /** Still pointer for this long is a hold. */
  holdMs: 400,
  /** Heading is kept this long after the stick thumb lifts (design/04). */
  coastMs: 200,
  /** Minimum touch target edge. */
  minTargetPx: 44,
  /** Fraction of screen height, from the bottom, where a stick may start. */
  stickZoneFraction: 0.55,
  /** Gamepad stick dead zone, 0 to 1. */
  gamepadDeadZone: 0.25,
  /** Analog magnitude above which the 8-way direction is active. */
  directionThreshold: 0.35,
} as const;

/** Type of the tunables record. */
export type InputTunables = typeof INPUT_TUNABLES;
