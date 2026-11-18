import type { Craft } from './stations';
import type { DayPhase, Season, Weather } from '../balance/time';
import type { BottomStyle, ClothColor, MainHand, OffHand, TopStyle } from '../dolls/parts';

export type ItemCategory =
  'weapon' | 'armor' | 'tool' | 'consumable' | 'material' | 'currency' | 'misc';

/** Common, Fine, Superior, Masterwork. Only items with `quality: true` can carry one. */
export type Quality = 0 | 1 | 2 | 3;

/** The tool kinds gathering and crafting ask for (M3-06, M3-07, M3-14). */
export type ToolKind = 'pick' | 'axe' | 'sickle' | 'rod' | 'hammer' | 'needle';

/** The Bag tab filters. Every item belongs to exactly one. */
export type BagFilter = 'gear' | 'tools' | 'food' | 'materials' | 'other';

/** Where gear is worn. */
export const EQUIP_SLOTS = ['main', 'off', 'head', 'body', 'legs', 'accessory'] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

/** What worn gear adds to the paper doll. Only the layers the art supports today. */
export interface DollGear {
  top?: TopStyle;
  topColor?: ClothColor;
  bottom?: BottomStyle;
  bottomColor?: ClothColor;
  mainHand?: MainHand;
  offHand?: OffHand;
}

export interface EquipDef {
  slot: EquipSlot;
  /** Added to the wearer's defense. */
  defense?: number;
  /** Main hand only: the weapon family from `content/combat/attacks` and its base power. */
  weapon?: string;
  power?: number;
  doll?: DollGear;
}

/** A Fed buff: timed bonus to the pool maxima. One active at a time. Stamina and Focus in tenths. */
export interface FedDef {
  ticks: number;
  hpMax: number;
  staMax: number;
  focMax: number;
}

export interface FoodDef {
  /** Restored when eaten. Health in points, Stamina and Focus in tenths. */
  hp: number;
  sta: number;
  foc: number;
  fed?: FedDef;
  /** Eaten as found, uncooked. Eating it pays Survival XP (eatRaw). */
  raw?: true;
}

/** One item. Text lives in `content/strings/items.ts` under the two keys. */
export interface ItemDef {
  id: string;
  nameKey: string;
  descKey: string;
  /** Sprite id of the icon. */
  icon: string;
  category: ItemCategory;
  /** Most that fit in one bag slot. */
  stack: number;
  tier: number;
  /** Coin value when sold. */
  value: number;
  equip?: EquipDef;
  food?: FoodDef;
  /** This item can carry a quality. Others never do (`QUALITY_ON_PLAIN`). */
  quality?: true;
  /** Most durability. Gear and tools only. Absent means the item does not wear. */
  durability?: number;
  /** Affixes it can hold. Enchanting fills them (M3-14). Absent means 0. */
  affixSlots?: 0 | 1 | 2;
  tool?: { kind: ToolKind; tier: number };
  /** A gadget: the Use button does this (M3-14). `lantern` is worn in the off hand instead. */
  gadget?: 'spark' | 'flask' | 'smoke' | 'bell' | 'repair' | 'snare' | 'grit' | 'lantern';
  /** Using it (eating or drinking) clears these statuses and may apply one. */
  status?: { clear?: readonly string[]; apply?: { status: string; ticks: number } };
  /** Reading it (the Use button) teaches this recipe and uses it up. */
  teaches?: string;
  /** Which Bag filter lists it. */
  bag: BagFilter;
}

/** How a recipe comes to be known. `start` is known from the first day. */
export type RecipeLearn = 'start' | 'teach' | 'buy' | 'find' | 'experiment';

/** A recipe: these ingredients, together, at this station, make this. Order never matters. */
export interface RecipeDef {
  id: string;
  craft: Craft;
  tier: number;
  /** The station kind it is made at. */
  station: string;
  ingredients: readonly { item: string; qty: number }[];
  result: string;
  qty: number;
  learn: RecipeLearn;
  /** Enchanting: the affix this recipe puts on a chosen piece. The result is empty. */
  enchant?: string;
}

/** One thing a node can give, and when. A missing condition means always. */
export interface YieldDef {
  item: string;
  weight: number;
  phases?: readonly DayPhase[];
  seasons?: readonly Season[];
  weather?: readonly Weather[];
}

/** The timing of one sweep. A node overrides any part of the default in `balance/items.ts`. */
export interface SweepDef {
  /** Ticks the sweep runs. */
  ticks: number;
  /** The sweet window, first and last tick. */
  sweetFrom: number;
  sweetTo: number;
  baseMin: number;
  baseMax: number;
  /** Extra yield for each sweet hit. */
  sweetBonus: number;
  /** Sweeps to a node: a tree takes three. */
  swings: number;
}

/** What a gathering node gives. Each work picks one yield by weight. */
export interface NodeDef {
  id: string;
  /** Skill XP tag sent with the gathered event, and the skill that rolls quality. */
  tag: string;
  tier: number;
  /** The tool that helps. Without one the node needs none. */
  tool?: ToolKind;
  yields: readonly YieldDef[];
  /** World ticks until the node can be worked again. */
  respawn: number;
  sweep?: Partial<SweepDef>;
  /** Fishing placeholder (M6-05 replaces it): cast, wait for a bite, tap inside the window. */
  fishing?: true;
  /** Sprite ids for a ready and a spent node. */
  sprite: { ready: string; spent: string };
}
