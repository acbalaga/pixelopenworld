/**
 * The login and logout shimmer of a Traveler (POW-M5-04): a short palette pulse. The doll fades in
 * (or out) while a column of light, in palette index `glow`, rises and thins. Data only: the
 * renderer reads `alpha` and `glow` by the shimmer's age in ticks, so the look is tuned here.
 */
export const TRAVELER_SHIMMER = {
  /** Ticks the shimmer lasts. Matches `ENTITY.shimmerTicks`. */
  ticks: 24,
  /** Palette index of the light (the off-white ink of the master palette). */
  glow: 3,
  /** Doll opacity by age in ticks, for a login. A logout plays it backward. */
  alpha: [0, 0, 0.2, 0.2, 0.4, 0.4, 0.6, 0.6, 0.8, 0.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /** Width of the light column in px by age, wide first and thinning. */
  column: [10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1],
} as const;
