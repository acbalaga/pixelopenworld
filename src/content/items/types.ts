import type { BottomStyle, ClothColor, MainHand, OffHand, TopStyle } from '../dolls/parts';

export type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'material' | 'currency' | 'misc';

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
}

/** A recipe: these ingredients, together, make this. Order does not matter. */
export interface RecipeDef {
  id: string;
  ingredients: readonly string[];
  result: string;
  tier: number;
}

/** What a gathering node gives. Each work picks one yield by weight. */
export interface NodeDef {
  id: string;
  /** Skill XP tag sent with the gathered event. */
  tag: string;
  tier: number;
  yields: readonly { item: string; weight: number }[];
  /** Ticks until the node can be worked again. */
  respawn: number;
  /** Sprite ids for a ready and a spent node. */
  sprite: { ready: string; spent: string };
}
