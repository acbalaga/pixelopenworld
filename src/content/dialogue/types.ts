import type { DayPhase, Season, Weather } from '../balance/time';
import type { DollSpec } from '../dolls/parts';
import type { BagFilter } from '../items/types';

/** A test the dialogue runs against the player's state. All conditions in a list must hold. */
export type Cond =
  | { flag: string; not?: boolean }
  | { item: string; atLeast: number }
  | { skill: string; atLeast: number }
  /** The skill has awakened (M4-15): first XP, a manual or a lesson. */
  | { awake: string }
  | { request: string; is: 'none' | 'active' | 'ready' | 'done' }
  | { trial: string; is: 'offered' | 'passed'; not?: boolean }
  | { pathWorn: string; not?: boolean }
  | { pathEarned: string; not?: boolean }
  | { renown: { region: string; atLeast: number } }
  /** The purse holds at least this much coin (M6-02, a lease). */
  | { coin: number }
  /** The avatar knows this recipe, or (with `not`) does not (M6-04, a person teaching). */
  | { recipe: string; not?: boolean }
  | { phase: DayPhase[] }
  | { season: Season[] }
  | { weather: Weather[] };

/** Something a node or a choice does. The sim applies it, so the client cannot invent one. */
export type Effect =
  | { setFlag: string }
  | { give: string; qty: number }
  | { learnRecipe: string }
  | { offerTrial: string }
  | { startRequest: string }
  | { turnIn: string }
  | { learnTechnique: string }
  | { openShop: string }
  /** Raises the home region's Renown. Only on a choice that also sets a flag it requires unset. */
  | { renown: number }
  /** Tells the avatar of a place: a rumor id from `content/world/rumors` (M4-06). */
  | { rumor: string }
  /** Takes items from the bag, if it holds that many. */
  | { takeItem: string; qty: number }
  /** Leases the first `plots` plots of the reeve's field for `weeks` more weeks, paid now (M6-02). */
  | { lease: { plots: number; weeks: number } }
  /** Aldo mills wheat to flour for a fee (M6-04). */
  | { mill: true };

export interface Choice {
  /** String key of the button label. */
  text: string;
  /** Node to go to, or null to end the conversation. */
  next: string | null;
  if?: readonly Cond[];
  do?: readonly Effect[];
}

export interface DialogueNode {
  id: string;
  /** String key of what the speaker says. */
  text: string;
  /** Without choices: where a tap goes. Null or absent ends the conversation. */
  next?: string | null;
  choices?: readonly Choice[];
  /** Runs once when the node is shown. */
  do?: readonly Effect[];
}

/** One speaker's conversation. The first entry whose conditions hold says where to start. */
export interface Dialogue {
  npc: string;
  /** `chat` looks like a chat message, for Travelers. `speech` is the default. */
  style?: 'speech' | 'chat';
  entries: readonly { if?: readonly Cond[]; node: string }[];
  nodes: Readonly<Record<string, DialogueNode>>;
}

export interface NpcDef {
  id: string;
  name: string;
  doll: DollSpec;
  /** Facing when nobody is near: `up`, `down`, `left` or `right`. */
  facing: 'up' | 'down' | 'left' | 'right';
}

export interface ShopDef {
  id: string;
  npc: string;
  /** The region whose price table applies (`SHOP_BALANCE.regionPct`). */
  region: string;
  /** What is on sale, in order, and how many are on the shelf after each dawn restock. */
  stock: readonly { item: string; max: number }[];
  /** The Bag filters of the things this shop will buy. Anything with a value in them. */
  buys: readonly BagFilter[];
  /** The shopkeeper's coin: what they hold at the start, and the most they will hold. */
  purse: { start: number; max: number };
  /** How hard a bargain they drive, 0 to 60. Subtracts from the chance they accept an offer. */
  firmness: number;
  /** The shop mends gear for coin. */
  repairs?: true;
}
