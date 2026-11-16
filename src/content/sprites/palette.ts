/**
 * The master palette. 48 colors, defined once. Sprites and tiles use only these indices.
 * Indices 0 to 31 were approved first and never change. 32 to 47 extend it (more skin tones,
 * rose, ochre) for characters, blossoms and autumn.
 */

/** One named ramp of four steps, dark to light. */
export interface Ramp {
  name: string;
  /** Palette indices of the four steps, dark to light. */
  indices: readonly [number, number, number, number];
  /** Intended use. */
  use: string;
}

/** Hex colors by palette index. Shadows lean cool (blue-violet), highlights lean warm. */
export const PALETTE: readonly string[] = [
  // 0-3 neutrals, near-black to off-white, slightly warm
  '#1a1614',
  '#4a423e',
  '#a89f94',
  '#f1ebdf',
  // 4-7 skin and wood
  '#4a2a2c',
  '#8a5a3b',
  '#c68a58',
  '#efc08c',
  // 8-11 foliage
  '#1f3d3a',
  '#2f6b3a',
  '#5c9a3f',
  '#a6c75a',
  // 12-15 water
  '#1f2f6b',
  '#2f5fa8',
  '#4f95d0',
  '#9fd4ea',
  // 16-19 stone
  '#34374a',
  '#5b5f73',
  '#8c8d96',
  '#c4c0b6',
  // 20-23 fire
  '#6e1f2a',
  '#c2402a',
  '#ef8a2e',
  '#ffd96a',
  // 24-27 magic violet
  '#3b1f5e',
  '#6d3fa8',
  '#a56bdb',
  '#dcb4f5',
  // 28-31 metal
  '#2c3a47',
  '#5f7a8a',
  '#9db8c4',
  '#e4f0f2',
  // 32-35 deep skin
  '#3b2220',
  '#6b4130',
  '#9a6a48',
  '#c8946a',
  // 36-39 pale skin
  '#5a3a3c',
  '#b57a62',
  '#e0a888',
  '#f8d6b8',
  // 40-43 rose
  '#5e1f4a',
  '#a33a6e',
  '#d9689a',
  '#f5b0c8',
  // 44-47 ochre (gold: blond hair, autumn leaves, sand, wheat)
  '#6b4a14',
  '#b8861e',
  '#e8b83a',
  '#fbe58a',
];

/** The neutral ramp, for the swatch sheet. */
export const NEUTRALS: Ramp = {
  name: 'neutral',
  indices: [0, 1, 2, 3],
  use: 'Outlines (index 0 is the darkest neutral), UI text and panels, highlights of last resort.',
};

/** The eleven hue ramps. */
export const RAMPS: readonly Ramp[] = [
  { name: 'skin_wood', indices: [4, 5, 6, 7], use: 'Skin tones, hair, wood, dirt, leather.' },
  {
    name: 'foliage',
    indices: [8, 9, 10, 11],
    use: 'Grass, leaves, moss, anything alive and green.',
  },
  { name: 'water', indices: [12, 13, 14, 15], use: 'Water, ice, sky glints, blue cloth.' },
  { name: 'stone', indices: [16, 17, 18, 19], use: 'Rock, walls, roads, ruins.' },
  { name: 'fire', indices: [20, 21, 22, 23], use: 'Fire, embers, warm cloth, danger marks.' },
  {
    name: 'magic_violet',
    indices: [24, 25, 26, 27],
    use: 'Magic, Undercroft, night tint, rare items.',
  },
  { name: 'metal', indices: [28, 29, 30, 31], use: 'Weapons, armor, tools, Waystones.' },
  { name: 'skin_deep', indices: [32, 33, 34, 35], use: 'Deep skin tones. Step 3 is the lit base.' },
  { name: 'skin_pale', indices: [36, 37, 38, 39], use: 'Pale skin tones. Step 3 is the lit base.' },
  { name: 'rose', indices: [40, 41, 42, 43], use: 'Blossoms, rose dyes, pink hair, berries.' },
  {
    name: 'ochre',
    indices: [44, 45, 46, 47],
    use: 'Blond hair, autumn leaves, gold dyes, sand, wheat.',
  },
];

/** The ramp in which every palette index sits, for review tooling. */
export const ALL_RAMPS: readonly Ramp[] = [NEUTRALS, ...RAMPS];
