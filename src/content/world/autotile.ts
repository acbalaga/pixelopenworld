/**
 * Authored edge pieces for blob autotiling. Each piece is the top left 8x8 quadrant of a tile.
 * `#` overlay terrain (takes the overlay texture), `.` base terrain showing through (transparent),
 * `e` rim pixel in the terrain's rim color. The other quadrants are mirrors of these; the
 * `edge_v` piece is the transpose of `edge_h`, and `corner` is the overlap of the two.
 * The profile along the tile border is the same for both pieces, so neighbors line up.
 */
export const EDGE_H: readonly string[] = [
  '........',
  'ee..ee..',
  '..eeeeee',
  '########',
  '########',
  '########',
  '########',
  '########',
];

/**
 * A notch where two straight edges meet at an inside corner. Its left column and top row repeat
 * the straight edge profile, so it lines up with the edge pieces of both neighbors.
 */
export const INNER: readonly string[] = [
  '.e.#####',
  'e#######',
  '.#######',
  '########',
  '########',
  '########',
  '########',
  '########',
];

export const FULL: readonly string[] = Array(8).fill('########');
