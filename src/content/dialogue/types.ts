import type { DollSpec } from '../dolls/parts';

/** A test the dialogue runs against the player's state. All conditions in a list must hold. */
export type Cond =
  | { flag: string; not?: boolean }
  | { item: string; atLeast: number }
  | { skill: string; atLeast: number }
  | { request: string; is: 'none' | 'active' | 'ready' | 'done' };

/** Something a node or a choice does. The sim applies it, so the client cannot invent one. */
export type Effect =
  | { setFlag: string }
  | { give: string; qty: number }
  | { learnRecipe: string }
  | { offerTrial: string }
  | { startRequest: string }
  | { turnIn: string }
  | { learnTechnique: string }
  | { openShop: string };

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
  /** Item ids on sale, in order. */
  stock: readonly string[];
  /** The shopkeeper's coin: what they hold at the start, and the most they will hold. */
  purse: { start: number; max: number };
}

export interface RequestDef {
  id: string;
  giver: string;
  /** String keys: the title, and the progress line with `{n}` and `{max}`. */
  title: string;
  log: string;
  goal: { kill: string; count: number };
  reward: {
    coin: number;
    items: readonly { item: string; qty: number }[];
    /** Techniques taught on turn-in. */
    techniques?: readonly string[];
  };
}
