/** Paper doll parts. Data only. Layers are authored once and recolored through ramps. */
import type { AnimDef } from '../sprites/types';
import { ACCESSORIES, BROWS, EYES, FACIAL, HAIR_STAMPS, MARKS, MOUTHS, type Stamp } from './stamps';

export { ACCESSORIES, BROWS, EYES, FACIAL, HAIR_STAMPS, MARKS, MOUTHS, type Stamp };

/** Four palette indices, dark to light. */
export type Ramp4 = readonly [number, number, number, number];

/** Body types. Same head, different torso, arms and legs. */
export const BODY_TYPES = ['a', 'b'] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const SKIN_TONES = {
  pale: [36, 37, 38, 39],
  light: [4, 5, 6, 7],
  deep: [32, 33, 34, 35],
  // M4-19: three more tones, a warmer light one and two darker than `deep`.
  peach: [36, 36, 37, 38],
  bronze: [32, 32, 33, 34],
  umber: [0, 0, 32, 33],
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
  // M4-19: two more, white and ginger.
  white: [2, 3, 3, 3],
  ginger: [21, 22, 23, 23],
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

export const HAIR_STYLES = [
  'none',
  'short',
  'long',
  'ponytail',
  'curly',
  'bun',
  // M4-19: six more. These are drawn from stamps, so they add nothing to the atlas.
  'mohawk',
  'pigtails',
  'braid',
  'afro',
  'shaggy',
  'topknot',
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
/** The hairstyles that have a baked layer. The others are stamps. */
export const BAKED_HAIR: readonly HairStyle[] = ['short', 'long', 'ponytail', 'curly', 'bun'];

/** Height changes the legs by one pixel either way. The body box in the sim does not change. */
export const HEIGHTS = ['short', 'mid', 'tall'] as const;
export type Height = (typeof HEIGHTS)[number];
export const FACIALS = ['none', 'stubble', 'short', 'full'] as const;
export type Facial = (typeof FACIALS)[number];
export const ACCESSORY_IDS = [
  'none',
  'headband',
  'scarf',
  'earring',
  'eyepatch',
  'flower',
] as const;
export type Accessory = (typeof ACCESSORY_IDS)[number];
/** Counts of the face parts, by index. Index 0 of each is the neutral entry old saves get. */
export const EYE_COUNT = EYES.length;
export const BROW_COUNT = BROWS.length;
export const MOUTH_COUNT = MOUTHS.length;
export const MARK_COUNT = MARKS.length;
export const TOP_STYLES = ['tunic', 'vest', 'robe'] as const;
export type TopStyle = (typeof TOP_STYLES)[number];
export const BOTTOM_STYLES = ['trousers', 'skirt'] as const;
export type BottomStyle = (typeof BOTTOM_STYLES)[number];

/** Held items. They have fixed colors (metal, wood), so they are not recolored. */
export const MAIN_HANDS = [
  'none',
  'sword',
  'dagger',
  'staff',
  'spear',
  'maul',
  'bow',
  'wraps',
] as const;
export type MainHand = (typeof MAIN_HANDS)[number];
/** What a new look may start with. */
const START_HANDS: readonly MainHand[] = ['none', 'sword', 'staff'];
export const OFF_HANDS = ['none', 'shield'] as const;
export type OffHand = (typeof OFF_HANDS)[number];

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
  mainHand: MainHand;
  offHand: OffHand;
  // ---- M4-19. Every one is optional, and absent means the neutral entry, so a look saved before
  // this existed draws exactly as it did. `normalizeDoll` fills them in. ----
  height?: Height;
  /** Eye shape, brow shape, mouth and mark, as an index into the stamp tables. 0 is the default. */
  eyes?: number;
  brows?: number;
  mouth?: number;
  mark?: number;
  markColor?: ClothColor;
  /** A second hair color for tips or streaks. */
  hairStyle2Color?: HairColor;
  facial?: Facial;
  accessory?: Accessory;
  /** The two clothing colors chosen at setup, offered as the default dye on crafted gear. */
  ownColors?: readonly [ClothColor, ClothColor];
}

/** A look with every M4-19 field present. Absent fields take their neutral entry. */
export function normalizeDoll(
  spec: DollSpec,
): DollSpec &
  Required<
    Pick<
      DollSpec,
      | 'height'
      | 'eyes'
      | 'brows'
      | 'mouth'
      | 'mark'
      | 'markColor'
      | 'facial'
      | 'accessory'
      | 'ownColors'
    >
  > {
  return {
    ...spec,
    height: spec.height ?? 'mid',
    eyes: spec.eyes ?? 0,
    brows: spec.brows ?? 0,
    mouth: spec.mouth ?? 0,
    mark: spec.mark ?? 0,
    markColor: spec.markColor ?? 'brown',
    facial: spec.facial ?? 'none',
    accessory: spec.accessory ?? 'none',
    ownColors: spec.ownColors ?? [spec.topColor, spec.bottomColor],
  };
}

/** A layer to draw, with the ramp its recolorable slots map to. Drawn first to last. */
export interface DollLayerRef {
  id: string;
  ramp: Ramp4;
  /** Slots 4 to 7 are recolored. Skin layers keep their own light/shade logic in the art. */
  kind: 'body' | 'bottom' | 'top' | 'hair' | 'main' | 'off' | 'stamp';
  /** A pattern drawn on the head at compose time instead of a baked layer (M4-19). */
  stamp?: Stamp;
  /** Hair only: the ramp the lit and highlight steps use, for tips and streaks. */
  tip?: Ramp4;
}

const ITEM_RAMP: Ramp4 = [28, 29, 30, 31];

/** The ordered layers for a spec. */
export function layersFor(input: DollSpec): DollLayerRef[] {
  const spec = normalizeDoll(input);
  const skin = SKIN_TONES[spec.skin];
  const hairRamp = HAIR_COLORS[spec.hairColor];
  const tip = spec.hairStyle2Color ? HAIR_COLORS[spec.hairStyle2Color] : undefined;
  const out: DollLayerRef[] = [
    { id: `doll.body_${spec.body}`, ramp: skin, kind: 'body' },
    {
      id: `doll.bottom_${spec.bottom}_${spec.body}`,
      ramp: CLOTH_COLORS[spec.bottomColor],
      kind: 'bottom',
    },
    { id: `doll.top_${spec.top}_${spec.body}`, ramp: CLOTH_COLORS[spec.topColor], kind: 'top' },
  ];
  const stamp = (id: string, st: Stamp | undefined, ramp: Ramp4): void => {
    // The neutral entry of each table is empty and adds no layer.
    if (st && st.down.length + st.up.length + st.right.length > 0)
      out.push({ id, ramp, kind: 'stamp', stamp: st });
  };
  if (spec.hair !== 'none') {
    const baked = BAKED_HAIR.includes(spec.hair);
    if (baked)
      out.push({
        id: `doll.hair_${spec.hair}`,
        ramp: hairRamp,
        kind: 'hair',
        ...(tip ? { tip } : {}),
      });
    else {
      const st = HAIR_STAMPS[spec.hair];
      if (st)
        out.push({
          id: `stamp.hair_${spec.hair}`,
          ramp: hairRamp,
          kind: 'stamp',
          stamp: st,
          ...(tip ? { tip } : {}),
        });
    }
  }
  // The face, then what is worn over it. Each is a stamp, so none costs atlas space.
  stamp('stamp.eyes', EYES[spec.eyes], skin);
  stamp('stamp.mouth', MOUTHS[spec.mouth], skin);
  stamp('stamp.facial', FACIAL[FACIALS.indexOf(spec.facial)], hairRamp);
  stamp('stamp.brows', BROWS[spec.brows], hairRamp);
  stamp('stamp.mark', MARKS[spec.mark], CLOTH_COLORS[spec.markColor]);
  if (spec.accessory !== 'none')
    stamp(
      `stamp.acc_${spec.accessory}`,
      ACCESSORIES[spec.accessory],
      CLOTH_COLORS[spec.ownColors[1]],
    );
  // Items use fixed colors; the ramp is unused but keeps the layer shape uniform.
  if (spec.offHand !== 'none')
    out.push({ id: `doll.off_${spec.offHand}_${spec.body}`, ramp: ITEM_RAMP, kind: 'off' });
  if (spec.mainHand !== 'none')
    out.push({ id: `doll.main_${spec.mainHand}_${spec.body}`, ramp: ITEM_RAMP, kind: 'main' });
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
    // A new look starts with something a fresh character could hold. The rest come from gear.
    mainHand: pickOf(rand, START_HANDS),
    offHand: pickOf(rand, OFF_HANDS),
    ...randomFace(rand),
  };
}

/** The M4-19 look fields, drawn after the rest so a seed's older choices keep their order. */
export function randomFace(
  rand: () => number,
): Pick<
  DollSpec,
  | 'height'
  | 'eyes'
  | 'brows'
  | 'mouth'
  | 'mark'
  | 'markColor'
  | 'facial'
  | 'accessory'
  | 'hairStyle2Color'
> {
  const colors = Object.keys(HAIR_COLORS) as HairColor[];
  const cloth = Object.keys(CLOTH_COLORS) as ClothColor[];
  return {
    height: pickOf(rand, HEIGHTS),
    eyes: Math.floor(rand() * EYE_COUNT),
    brows: Math.floor(rand() * BROW_COUNT),
    mouth: Math.floor(rand() * MOUTH_COUNT),
    // Most looks have no mark, beard or accessory: a quarter do.
    mark: rand() < 0.25 ? 1 + Math.floor(rand() * (MARK_COUNT - 1)) : 0,
    markColor: pickOf(rand, cloth),
    facial: rand() < 0.25 ? pickOf(rand, FACIALS.slice(1)) : 'none',
    accessory: rand() < 0.3 ? pickOf(rand, ACCESSORY_IDS.slice(1)) : 'none',
    ...(rand() < 0.2 ? { hairStyle2Color: pickOf(rand, colors) } : {}),
  };
}

/** Directions drawn. Left is the right frames mirrored. */
export const DOLL_DRAWN_DIRS = ['down', 'up', 'right'] as const;
type DrawnDir = (typeof DOLL_DRAWN_DIRS)[number];
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/**
 * Work animations (D16). A node or station names one in its `workAnim`. Four frames each, in
 * every facing: swing (Logging, Mining, Smithing), reach (Foraging), stir (Cooking, Alchemy),
 * hands (Tailoring, Enchanting, Tinkering, Woodworking), cast (Fishing).
 */
export const WORK_ANIMS = [
  'work_swing',
  'work_reach',
  'work_stir',
  'work_hands',
  'work_cast',
] as const;
export type WorkAnim = (typeof WORK_ANIMS)[number];

/** Frame names every layer provides: walk 4, idle 1, attack 3, hurt 1, dodge 2, per drawn direction. */
export const DOLL_FRAMES: readonly string[] = [
  ...DOLL_DRAWN_DIRS.flatMap((d) => range(4).map((n) => `walk_${d}_${n}`)),
  ...DOLL_DRAWN_DIRS.map((d) => `idle_${d}`),
  ...DOLL_DRAWN_DIRS.flatMap((d) => range(3).map((n) => `attack_${d}_${n}`)),
  ...DOLL_DRAWN_DIRS.map((d) => `hurt_${d}`),
  ...DOLL_DRAWN_DIRS.flatMap((d) => range(2).map((n) => `dodge_${d}_${n}`)),
  ...WORK_ANIMS.flatMap((w) =>
    DOLL_DRAWN_DIRS.flatMap((d) => range(4).map((n) => `${w}_${d}_${n}`)),
  ),
];

/**
 * Animations, in four facings. Left shares the right frames mirrored. Idle is two frames (a slow
 * breath), walk four, attack three (windup, strike, recover), hurt one, dodge two, and each work animation four.
 */
export const DOLL_ANIMS: Readonly<Record<string, AnimDef>> = Object.fromEntries(
  (['down', 'up', 'right', 'left'] as const).flatMap((f) => {
    const d: DrawnDir = f === 'left' ? 'right' : f;
    const flip = f === 'left' ? { flipX: true } : {};
    const seq = (name: string, n: number): string[] => range(n).map((i) => `${name}_${d}_${i}`);
    return [
      [`walk_${f}`, { fps: 8, frames: seq('walk', 4), ...flip }],
      [`idle_${f}`, { fps: 2, frames: [`idle_${d}`, `walk_${d}_1`], ...flip }],
      [`attack_${f}`, { fps: 12, frames: seq('attack', 3), ...flip }],
      [`hurt_${f}`, { fps: 4, frames: [`hurt_${d}`], ...flip }],
      [`dodge_${f}`, { fps: 8, frames: seq('dodge', 2), ...flip }],
      ...WORK_ANIMS.map(
        (w) => [`${w}_${f}`, { fps: 6, frames: seq(w, 4), ...flip }] as [string, AnimDef],
      ),
    ] as [string, AnimDef][];
  }),
);

export const DOLL_SIZE = [24, 32] as const;
export const DOLL_ORIGIN = [12, 28] as const;
