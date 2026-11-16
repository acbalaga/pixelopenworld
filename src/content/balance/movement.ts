/**
 * Movement tunables. Speeds are sub-pixel units (1/256 px) per sim tick at 30 Hz. Times are
 * sim ticks. Sizes are pixels.
 */
export const MOVEMENT = {
  /** Walk speed along an axis. 640 is 2.5 px per tick, 75 px per second. */
  walkSpeed: 640,
  /** Sprint speed as a fraction (out of 256) of walk speed. */
  sprintFactor256: 400,
  /** Ticks to go from standing to full speed. */
  accelTicks: 3,
  /** Ticks to go from full walk speed to standing. */
  decelTicks: 2,
  /** Diagonal components as a fraction (out of 256) of the cardinal speed. 181/256 is 1/sqrt(2). */
  diagonal256: 181,
  /** Ticks the stick must be held at full extent before sprint starts (0.5 s). */
  sprintHoldTicks: 15,
  /** Stamina drained per tick while sprinting (full bar lasts 5 s). */
  sprintDrain: 6,
  /** After running dry, sprint stays off until stamina reaches this. */
  sprintResume: 250,
  /** Avatar collision box, at the feet, in px. */
  bodyW: 10,
  bodyH: 8,
  /** How far in front of the feet an interactable may be, in px, and the half-width of the cone. */
  interactReach: 18,
  interactHalfWidth: 14,
} as const;
