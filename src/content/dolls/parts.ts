/** Paper doll parts. Data only. Layers are authored once and recolored through ramps. */

/** Four palette indices, dark to light. */
export type Ramp4 = readonly [number, number, number, number];

/** Body types. Same head, different torso, arms and legs. */
export const BODY_TYPES = ['a', 'b'] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const SKIN_TONES = {
  pale: [36, 37, 38, 39],
  light: [4, 5, 6, 7],
  deep: [32, 33, 34, 35],
} as const satisfies Record<string, Ramp4>;
export type SkinTone = keyof typeof SKIN_TONES;

export const HAIR_COLORS = {
  black: [0, 1, 16, 17],
  brown: [4, 5, 6, 7],
  auburn: [20, 21, 22, 23],
  blond: [44, 45, 46, 47],
  grey: [1, 2, 3, 3],
  blue: [12, 13, 14, 15],
  violet: [24, 25, 26, 27],
  rose: [40, 41, 42, 43],
  green: [8, 9, 10, 11],
} as const satisfies Record<string, Ramp4>;
export type HairColor = keyof typeof HAIR_COLORS;

export const CLOTH_COLORS = {
  blue: [12, 13, 14, 15],
  green: [8, 9, 10, 11],
  red: [20, 21, 22, 23],
  violet: [24, 25, 26, 27],
  ochre: [44, 45, 46, 47],
  rose: [40, 41, 42, 43],
  slate: [16, 17, 18, 19],
  brown: [4, 5, 6, 7],
} as const satisfies Record<string, Ramp4>;
export type ClothColor = keyof typeof CLOTH_COLORS;

export const HAIR_STYLES = ['none', 'short', 'long', 'ponytail', 'curly', 'bun'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const TOP_STYLES = ['tunic', 'vest'] as const;
export type TopStyle = (typeof TOP_STYLES)[number];
export const BOTTOM_STYLES = ['trousers', 'skirt'] as const;
export type BottomStyle = (typeof BOTTOM_STYLES)[number];

/** One character's look. */
export interface DollSpec {
  body: BodyType;
  skin: SkinTone;
  hair: HairStyle;
  hairColor: HairColor;
  top: TopStyle;
  topColor: ClothColor;
  bottom: BottomStyle;
  bottomColor: ClothColor;
}

/** A layer to draw, with the ramp its recolorable slots map to. Drawn first to last. */
export interface DollLayerRef {
  id: string;
  ramp: Ramp4;
  /** Slots 4 to 7 are recolored. Skin layers keep their own light/shade logic in the art. */
  kind: 'body' | 'bottom' | 'top' | 'hair';
}

/** The ordered layers for a spec. */
export function layersFor(spec: DollSpec): DollLayerRef[] {
  const out: DollLayerRef[] = [
    { id: `doll.body_${spec.body}`, ramp: SKIN_TONES[spec.skin], kind: 'body' },
    {
      id: `doll.bottom_${spec.bottom}_${spec.body}`,
      ramp: CLOTH_COLORS[spec.bottomColor],
      kind: 'bottom',
    },
    { id: `doll.top_${spec.top}_${spec.body}`, ramp: CLOTH_COLORS[spec.topColor], kind: 'top' },
  ];
  if (spec.hair !== 'none')
    out.push({ id: `doll.hair_${spec.hair}`, ramp: HAIR_COLORS[spec.hairColor], kind: 'hair' });
  return out;
}

function pickOf<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rand() * items.length))] as T;
}

/**
 * A random look. `rand` returns [0, 1) so callers pass a seeded generator and get repeatable
 * results. Hair never matches the top color exactly, which reads badly at small size.
 */
export function randomDoll(rand: () => number): DollSpec {
  const hairColor = pickOf(rand, Object.keys(HAIR_COLORS) as HairColor[]);
  let topColor = pickOf(rand, Object.keys(CLOTH_COLORS) as ClothColor[]);
  if (topColor === hairColor)
    topColor = pickOf(
      rand,
      (Object.keys(CLOTH_COLORS) as ClothColor[]).filter((c) => c !== hairColor),
    );
  return {
    body: pickOf(rand, BODY_TYPES),
    skin: pickOf(rand, Object.keys(SKIN_TONES) as SkinTone[]),
    hair: pickOf(rand, HAIR_STYLES),
    hairColor,
    top: pickOf(rand, TOP_STYLES),
    topColor,
    bottom: pickOf(rand, BOTTOM_STYLES),
    bottomColor: pickOf(rand, Object.keys(CLOTH_COLORS) as ClothColor[]),
  };
}

/** Frame names every layer provides. */
export const DOLL_FRAMES: readonly string[] = [
  ...(['down', 'up', 'right'] as const).flatMap((d) => [0, 1, 2, 3].map((n) => `walk_${d}_${n}`)),
  'idle_down',
  'idle_up',
  'idle_right',
];

export const DOLL_SIZE = [24, 32] as const;
export const DOLL_ORIGIN = [12, 28] as const;
