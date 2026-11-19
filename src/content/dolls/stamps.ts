/**
 * Doll stamps (M4-19): small pixel patterns placed on the head at compose time, so a face, a
 * beard, a new hairstyle or an accessory costs no atlas space. Coordinates are on the 24 x 32
 * doll canvas with the head at rest (the head is x 7 to 16, y 5 to 13 seen from the front). The
 * composer moves them with the head in every frame. Slots follow the doll layers: 4 to 7 are
 * recolored through the stamp's ramp, 0 to 3 are fixed neutrals, and anything above is a raw
 * palette index.
 */
export type Px = readonly [x: number, y: number, slot: number];

/** One pattern per way the head can face. The left view is the right one mirrored. */
export interface Stamp {
  down: readonly Px[];
  up: readonly Px[];
  right: readonly Px[];
}

/** A filled rectangle of one slot. */
function R(x0: number, y0: number, x1: number, y1: number, slot: number): Px[] {
  const out: Px[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y, slot]);
  return out;
}
const P = (...pts: [number, number, number][]): Px[] => pts;
const none: Stamp = { down: [], up: [], right: [] };
/** Mirrors a front-view pattern about the middle of the head (x 11.5). */
const mirror = (px: readonly Px[]): Px[] => px.map(([x, y, s]) => [23 - x, y, s]);
/** Both eyes (or brows) from one side's pixels. */
const pair = (left: readonly Px[]): Px[] => [...left, ...mirror(left)];

// The body layers already draw the default eyes at (9, 9) and (14, 9) and the default mouth at
// (11, 11) and (12, 11). A different shape paints skin over the default first. Slot 7 is the
// skin's main tone and 5 its deep tone, under the face stamp's skin ramp.
const CLEAR_EYES: Px[] = P([9, 9, 7], [14, 9, 7]);
const CLEAR_EYE_PROFILE: Px[] = P([14, 9, 7]);
const CLEAR_MOUTH: Px[] = P([11, 11, 7], [12, 11, 7]);

/** Eyes: the default (index 0 draws nothing over the body) and seven more. */
export const EYES: readonly Stamp[] = [
  none,
  // tall
  {
    down: [...CLEAR_EYES, ...pair(P([9, 9, 0], [9, 10, 0]))],
    up: [],
    right: [...CLEAR_EYE_PROFILE, ...P([14, 9, 0], [14, 10, 0])],
  },
  // wide
  {
    down: [...CLEAR_EYES, ...pair(P([9, 9, 0], [10, 9, 0]))],
    up: [],
    right: [...CLEAR_EYE_PROFILE, ...P([14, 9, 0], [13, 9, 0])],
  },
  // sleepy: a heavy lid over the eye
  {
    down: [...CLEAR_EYES, ...pair(P([9, 9, 0], [10, 9, 0], [9, 8, 6], [10, 8, 6]))],
    up: [],
    right: [...CLEAR_EYE_PROFILE, ...P([14, 9, 0], [13, 9, 0], [14, 8, 6], [13, 8, 6])],
  },
  // bright: a spark beside the pupil
  {
    down: [...CLEAR_EYES, ...pair(P([9, 9, 0], [10, 9, 3]))],
    up: [],
    right: [...CLEAR_EYE_PROFILE, ...P([14, 9, 0], [13, 9, 3])],
  },
  // round
  {
    down: [...CLEAR_EYES, ...pair(P([9, 9, 0], [10, 9, 0], [9, 10, 0], [10, 10, 0]))],
    up: [],
    right: [...CLEAR_EYE_PROFILE, ...P([14, 9, 0], [13, 9, 0], [14, 10, 0], [13, 10, 0])],
  },
  // narrow, slanting outward
  {
    down: [...CLEAR_EYES, ...pair(P([8, 9, 0], [9, 9, 0]))],
    up: [],
    right: [...CLEAR_EYE_PROFILE, ...P([14, 9, 0], [15, 9, 0])],
  },
  // low and small
  {
    down: [...CLEAR_EYES, ...pair(P([9, 10, 0]))],
    up: [],
    right: [...CLEAR_EYE_PROFILE, ...P([14, 10, 0])],
  },
];

/** Brows, in the hair's color: none, then five. */
export const BROWS: readonly Stamp[] = [
  none,
  { down: pair(R(9, 8, 10, 8, 4)), up: [], right: R(13, 8, 15, 8, 4) },
  // raised and arched
  {
    down: pair(P([9, 8, 4], [10, 7, 4])),
    up: [],
    right: P([13, 8, 4], [14, 7, 4], [15, 8, 4]),
  },
  // stern: the inner end low
  {
    down: pair(P([9, 7, 4], [10, 8, 4])),
    up: [],
    right: P([13, 7, 4], [14, 8, 4], [15, 8, 4]),
  },
  // worried: the inner end high
  {
    down: pair(P([9, 8, 4], [10, 7, 4])),
    up: [],
    right: P([13, 7, 4], [14, 8, 4]),
  },
  // thick
  { down: pair(R(9, 8, 10, 8, 4).concat(R(9, 7, 9, 7, 4))), up: [], right: R(13, 7, 15, 8, 4) },
];

/** Mouths: the default and four more. */
export const MOUTHS: readonly Stamp[] = [
  none,
  // smile
  {
    down: [...CLEAR_MOUTH, ...P([11, 11, 5], [12, 11, 5], [10, 10, 5], [13, 10, 5])],
    up: [],
    right: P([16, 11, 5], [16, 10, 5]),
  },
  // open
  {
    down: [...CLEAR_MOUTH, ...R(11, 11, 12, 12, 0)],
    up: [],
    right: P([16, 11, 0], [16, 12, 0]),
  },
  // frown
  {
    down: [...CLEAR_MOUTH, ...P([11, 11, 5], [12, 11, 5], [10, 12, 5], [13, 12, 5])],
    up: [],
    right: P([16, 12, 5], [16, 11, 5]),
  },
  // grin
  {
    down: [...CLEAR_MOUTH, ...R(10, 11, 13, 11, 0), ...P([9, 10, 5], [14, 10, 5])],
    up: [],
    right: P([16, 11, 0], [15, 11, 0]),
  },
];

/** Face marks, in the mark's own color: none, freckles, a scar, a birthmark, war paint. */
export const MARKS: readonly Stamp[] = [
  none,
  {
    down: P([8, 10, 5], [10, 10, 5], [13, 10, 5], [15, 10, 5], [9, 11, 5], [14, 11, 5]),
    up: [],
    right: P([15, 10, 5], [14, 11, 5], [16, 10, 5]),
  },
  {
    down: P([8, 9, 6], [9, 10, 6], [9, 11, 6], [10, 12, 6]),
    up: [],
    right: P([15, 9, 6], [15, 10, 6], [16, 11, 6]),
  },
  { down: R(14, 10, 15, 11, 5), up: [], right: R(15, 10, 16, 11, 5) },
  { down: [...R(8, 10, 10, 10, 5), ...R(13, 10, 15, 10, 5)], up: [], right: R(14, 10, 16, 10, 5) },
];

/** Facial hair, in the hair's color: none, stubble, short, full. */
export const FACIAL: readonly Stamp[] = [
  none,
  {
    down: P(
      [8, 11, 4],
      [9, 12, 4],
      [11, 12, 4],
      [12, 12, 4],
      [14, 12, 4],
      [15, 11, 4],
      [10, 11, 4],
      [13, 11, 4],
    ),
    up: [],
    right: P([14, 12, 4], [16, 12, 4], [15, 11, 4]),
  },
  {
    down: [
      ...R(9, 12, 14, 12, 5),
      ...R(8, 11, 9, 11, 5),
      ...R(14, 11, 15, 11, 5),
      ...R(10, 10, 13, 10, 5),
    ],
    up: [],
    right: [...R(12, 12, 16, 12, 5), ...R(15, 11, 16, 11, 5), ...R(14, 10, 16, 10, 5)],
  },
  {
    down: [
      ...R(8, 11, 15, 13, 5),
      ...R(9, 14, 14, 14, 4),
      ...R(10, 15, 13, 15, 4),
      ...R(10, 10, 13, 10, 5),
    ],
    up: [],
    right: [...R(11, 11, 16, 13, 5), ...R(11, 14, 15, 14, 4), ...R(14, 10, 16, 10, 5)],
  },
];

/** Hair that is more than a cap, drawn as stamps. The six new hairstyles. */
export const HAIR_STAMPS: Readonly<Record<string, Stamp>> = {
  // A strip of hair down the middle, the sides bare.
  mohawk: {
    down: [...R(10, 3, 13, 8, 5), ...R(10, 3, 13, 3, 6), ...R(13, 4, 13, 8, 4)],
    up: [...R(10, 3, 13, 12, 5), ...R(10, 3, 13, 3, 6), ...R(13, 4, 13, 12, 4)],
    right: [...R(10, 3, 15, 7, 5), ...R(10, 3, 15, 3, 6), ...R(14, 4, 15, 7, 4)],
  },
  // A cap with a tail hanging at each side.
  pigtails: {
    down: [
      ...R(7, 5, 16, 7, 5),
      ...R(7, 5, 16, 5, 6),
      ...R(5, 8, 6, 14, 5),
      ...R(17, 8, 18, 14, 4),
      ...R(5, 8, 6, 8, 6),
    ],
    up: [...R(7, 5, 16, 12, 5), ...R(7, 5, 16, 5, 6), ...R(5, 8, 6, 14, 5), ...R(17, 8, 18, 14, 4)],
    right: [
      ...R(8, 5, 16, 7, 5),
      ...R(8, 5, 16, 5, 6),
      ...R(8, 5, 10, 12, 5),
      ...R(6, 8, 7, 14, 4),
    ],
  },
  // A cap with one long braid down the back, which shows over the shoulder from the front.
  braid: {
    down: [
      ...R(7, 5, 16, 7, 5),
      ...R(7, 5, 16, 5, 6),
      ...R(17, 9, 18, 18, 4),
      ...P([17, 11, 6], [17, 14, 6], [17, 17, 6]),
    ],
    up: [
      ...R(7, 5, 16, 12, 5),
      ...R(7, 5, 16, 5, 6),
      ...R(11, 13, 12, 21, 4),
      ...P([11, 15, 6], [11, 18, 6]),
    ],
    right: [
      ...R(8, 5, 16, 7, 5),
      ...R(8, 5, 16, 5, 6),
      ...R(8, 5, 10, 11, 5),
      ...R(6, 9, 7, 20, 4),
      ...P([6, 12, 6], [6, 16, 6]),
    ],
  },
  // A great round cloud of hair.
  afro: {
    down: [
      ...R(5, 4, 18, 10, 5),
      ...R(6, 3, 17, 3, 5),
      ...R(5, 4, 18, 4, 6),
      ...R(17, 5, 18, 10, 4),
      ...P([8, 5, 6], [12, 4, 6], [15, 6, 6]),
    ],
    up: [
      ...R(5, 4, 18, 14, 5),
      ...R(6, 3, 17, 3, 5),
      ...R(5, 4, 18, 4, 6),
      ...R(17, 5, 18, 14, 4),
      ...P([8, 6, 6], [12, 5, 6], [14, 9, 6]),
    ],
    right: [
      ...R(5, 4, 17, 11, 5),
      ...R(6, 3, 16, 3, 5),
      ...R(5, 4, 17, 4, 6),
      ...R(5, 5, 6, 11, 4),
      ...P([9, 5, 6], [13, 4, 6]),
    ],
  },
  // A cap with a ragged fringe over the brow and wisps past the ears.
  shaggy: {
    down: [
      ...R(7, 5, 16, 7, 5),
      ...R(7, 5, 16, 5, 6),
      ...P([7, 8, 5], [9, 8, 5], [11, 8, 5], [12, 8, 5], [14, 8, 5], [16, 8, 5]),
      ...R(6, 7, 6, 12, 5),
      ...R(17, 7, 17, 12, 4),
    ],
    up: [...R(7, 5, 16, 13, 5), ...R(7, 5, 16, 5, 6), ...R(6, 7, 6, 14, 5), ...R(17, 7, 17, 14, 4)],
    right: [
      ...R(8, 5, 16, 7, 5),
      ...R(8, 5, 16, 5, 6),
      ...R(8, 5, 10, 13, 5),
      ...P([13, 8, 5], [15, 8, 5], [16, 8, 5]),
      ...R(7, 9, 7, 13, 4),
    ],
  },
  // A cap with the hair gathered into a knot on top.
  topknot: {
    down: [
      ...R(7, 5, 16, 7, 5),
      ...R(7, 5, 16, 5, 6),
      ...R(10, 3, 13, 4, 5),
      ...R(10, 3, 11, 3, 6),
      ...P([13, 4, 4]),
    ],
    up: [
      ...R(7, 5, 16, 12, 5),
      ...R(7, 5, 16, 5, 6),
      ...R(10, 3, 13, 4, 5),
      ...R(10, 3, 11, 3, 6),
      ...P([13, 4, 4]),
    ],
    right: [
      ...R(8, 5, 16, 7, 5),
      ...R(8, 5, 16, 5, 6),
      ...R(8, 5, 10, 11, 5),
      ...R(10, 3, 13, 4, 5),
      ...R(10, 3, 11, 3, 6),
    ],
  },
};

/** Accessories. Cloth ones take the character's second own color, the rest are fixed. */
export const ACCESSORIES: Readonly<Record<string, Stamp>> = {
  headband: {
    down: [...R(7, 6, 16, 6, 5), ...P([16, 7, 4], [17, 7, 5], [17, 8, 4])],
    up: [...R(7, 6, 16, 6, 5), ...P([16, 7, 4], [17, 7, 5], [17, 8, 4])],
    right: [...R(8, 6, 16, 6, 5), ...P([7, 7, 5], [6, 8, 4])],
  },
  scarf: {
    down: [...R(8, 14, 15, 14, 5), ...R(9, 15, 14, 15, 4), ...R(14, 16, 15, 17, 5)],
    up: [...R(8, 14, 15, 14, 5), ...R(9, 15, 14, 15, 4), ...R(14, 16, 15, 17, 5)],
    right: [...R(10, 14, 15, 14, 5), ...R(10, 15, 14, 15, 4), ...R(9, 16, 10, 18, 5)],
  },
  // A small gold ring at each ear.
  earring: {
    down: P([7, 10, 47], [16, 10, 47]),
    up: P([7, 10, 47], [16, 10, 47]),
    right: P([12, 10, 47]),
  },
  // A patch over the left eye with its strap across the brow.
  eyepatch: {
    down: [
      ...R(9, 9, 10, 10, 1),
      ...P(
        [7, 8, 1],
        [8, 8, 1],
        [9, 8, 1],
        [10, 8, 1],
        [11, 8, 1],
        [12, 8, 1],
        [13, 8, 1],
        [14, 8, 1],
        [15, 8, 1],
        [16, 8, 1],
      ),
    ],
    up: R(7, 8, 16, 8, 1),
    right: [...R(13, 9, 14, 10, 1), ...R(8, 8, 15, 8, 1)],
  },
  // A small blossom tucked behind the ear.
  flower: {
    down: P([8, 5, 42], [7, 6, 42], [9, 6, 42], [8, 7, 42], [8, 6, 46]),
    up: P([8, 5, 42], [7, 6, 42], [9, 6, 42], [8, 7, 42], [8, 6, 46]),
    right: P([11, 5, 42], [10, 6, 42], [12, 6, 42], [11, 7, 42], [11, 6, 46]),
  },
};
