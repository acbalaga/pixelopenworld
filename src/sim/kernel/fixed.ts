/** Sub-pixel integer helpers. Positions and velocities are integers in 1/256 px units. */

/** Sub-pixel units per pixel. */
export const SUBPX = 256;

/** An integer vector in sub-pixel units. */
export interface Vec {
  x: number;
  y: number;
}

/** Converts whole pixels to sub-pixel units. */
export function px(pixels: number): number {
  return Math.round(pixels * SUBPX);
}

/** Converts sub-pixel units to (possibly fractional) pixels. For rendering only. */
export function toPx(fixed: number): number {
  return fixed / SUBPX;
}

/** Component-wise sum. */
export function vadd(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** Component-wise difference. */
export function vsub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** Multiplies by an integer factor. */
export function vscale(a: Vec, k: number): Vec {
  return { x: a.x * k, y: a.y * k };
}

/** Squared length. Integer in, integer out, so it is safe to compare across devices. */
export function vlen2(a: Vec): number {
  return a.x * a.x + a.y * a.y;
}

/** Eight compass directions, clockwise from north. */
export const Dir = {
  N: 0,
  NE: 1,
  E: 2,
  SE: 3,
  S: 4,
  SW: 5,
  W: 6,
  NW: 7,
} as const;

/** One of the eight directions in {@link Dir}. */
export type Direction = (typeof Dir)[keyof typeof Dir];

const UNIT: readonly Vec[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

/** Unit step (components -1, 0, 1) for a direction. Diagonals are not normalized. */
export function dirStep(d: Direction): Vec {
  const v = UNIT[d];
  if (!v) throw new Error(`bad direction ${d}`);
  return v;
}

/** True when n is an integer 0..7. */
export function isDirection(n: unknown): n is Direction {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 7;
}
