/**
 * Wake points (M4-14, playtest F4). A new character wakes at one of these, outside town, and
 * walks in. On the slice map they ring Hearthford's square at 25 to 31 tiles from the Waystone,
 * outside the fence and 12 or more tiles from any spawner. In Dawnmeadow (POW-M4-04) they are the
 * eight places the region doc names. The region spec reads its points from here, so the client
 * does not ship the spec.
 */
export const WAKE_IDS = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'] as const;
export type WakeId = (typeof WAKE_IDS)[number];

/** Tile coordinates of the slice map (tests and `?region=slice`). */
export const WAKE_POINTS: Readonly<Record<WakeId, { x: number; y: number }>> = {
  w1: { x: 22, y: 31 },
  w2: { x: 25, y: 25 },
  w3: { x: 54, y: 13 },
  w4: { x: 69, y: 25 },
  w5: { x: 78, y: 41 },
  w6: { x: 72, y: 54 },
  w7: { x: 37, y: 61 },
  w8: { x: 15, y: 47 },
};

/**
 * Things a waking character can see from far off: the Waystone and the four corners of the
 * square's fence. The character faces the nearest, so the first frame points at town.
 */
export const WAKE_LANDMARKS: readonly { id: string; x: number; y: number }[] = [
  { id: 'waystone', x: 47, y: 37 },
  { id: 'fence_nw', x: 34, y: 30 },
  { id: 'fence_ne', x: 59, y: 30 },
  { id: 'fence_sw', x: 34, y: 55 },
  { id: 'fence_se', x: 59, y: 55 },
];

/** Where a region wakes a new character, and what the character turns to face. */
export interface WakeTable {
  points: Readonly<Record<WakeId, { x: number; y: number }>>;
  landmarks: readonly { id: string; x: number; y: number }[];
}

/** Dawnmeadow's wake points, in tiles from the region's top left (regions/01 section 5). */
export const DAWNMEADOW_WAKE_POINTS: WakeTable['points'] = {
  w1: { x: 284, y: 127 },
  w2: { x: 258, y: 168 },
  w3: { x: 236, y: 198 },
  w4: { x: 78, y: 178 },
  w5: { x: 176, y: 270 },
  w6: { x: 292, y: 246 },
  w7: { x: 112, y: 238 },
  w8: { x: 190, y: 104 },
};

/** Hearthford's two tall marks, the bell tower and the Waystone. Both stand above the roofs. */
export const DAWNMEADOW_WAKE_LANDMARKS: WakeTable['landmarks'] = [
  { id: 'bell_tower', x: 185, y: 166 },
  { id: 'waystone', x: 185, y: 189 },
];

/** The wake tables by region id. A region with no entry wakes nobody (dev regions). */
export const WAKE_TABLES: Readonly<Record<string, WakeTable>> = {
  slice: { points: WAKE_POINTS, landmarks: WAKE_LANDMARKS },
  dawnmeadow: { points: DAWNMEADOW_WAKE_POINTS, landmarks: DAWNMEADOW_WAKE_LANDMARKS },
};
