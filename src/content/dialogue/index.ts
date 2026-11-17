import type { Dialogue, NpcDef, RequestDef, ShopDef } from './types';

export type * from './types';

/** The slice NPCs. Their looks are paper doll specs, so they cost no new art. */
export const NPCS: Readonly<Record<string, NpcDef>> = {
  'npc.shopkeeper': {
    id: 'npc.shopkeeper',
    name: 'Brin',
    facing: 'down',
    doll: {
      body: 'a',
      skin: 'light',
      hair: 'short',
      hairColor: 'brown',
      top: 'vest',
      topColor: 'ochre',
      bottom: 'trousers',
      bottomColor: 'brown',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.cook': {
    id: 'npc.cook',
    name: 'Hesper',
    facing: 'down',
    doll: {
      body: 'b',
      skin: 'deep',
      hair: 'bun',
      hairColor: 'black',
      top: 'tunic',
      topColor: 'rose',
      bottom: 'skirt',
      bottomColor: 'slate',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.guard': {
    id: 'npc.guard',
    name: 'Orla',
    facing: 'down',
    doll: {
      body: 'a',
      skin: 'pale',
      hair: 'short',
      hairColor: 'auburn',
      top: 'tunic',
      topColor: 'slate',
      bottom: 'trousers',
      bottomColor: 'slate',
      mainHand: 'staff',
      offHand: 'shield',
    },
  },
  'npc.pilgrim': {
    id: 'npc.pilgrim',
    name: 'Pilgrim',
    facing: 'left',
    doll: {
      body: 'b',
      skin: 'light',
      hair: 'ponytail',
      hairColor: 'blue',
      top: 'robe',
      topColor: 'violet',
      bottom: 'trousers',
      bottomColor: 'green',
      mainHand: 'none',
      offHand: 'none',
    },
  },
};

export const SHOPS: Readonly<Record<string, ShopDef>> = {
  'shop.brin': {
    id: 'shop.brin',
    npc: 'npc.shopkeeper',
    purse: { start: 80, max: 150 },
    stock: [
      'item.dish_bread',
      'item.herb_tea',
      'item.cap_wool',
      'item.shield_wood',
      'item.spear_ash',
      'item.lantern_oil',
    ],
  },
};

export const REQUESTS: Readonly<Record<string, RequestDef>> = {
  'request.clear_pests': {
    id: 'request.clear_pests',
    giver: 'npc.guard',
    title: 'request.clear_pests.title',
    log: 'request.clear_pests.log',
    goal: { kill: 'creature.mossling', count: 4 },
    reward: { coin: 50, items: [{ item: 'item.ring_copper', qty: 1 }] },
  },
};

const asked = { request: 'request.clear_pests' } as const;

export const DIALOGUES: Readonly<Record<string, Dialogue>> = {
  'npc.shopkeeper': {
    npc: 'npc.shopkeeper',
    entries: [{ if: [{ flag: 'met_brin' }], node: 'again' }, { node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.brin.greet',
        do: [{ setFlag: 'met_brin' }],
        choices: [
          { text: 'dlg.brin.c_shop', next: null, do: [{ openShop: 'shop.brin' }] },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      again: {
        id: 'again',
        text: 'dlg.brin.again',
        choices: [
          { text: 'dlg.brin.c_shop', next: null, do: [{ openShop: 'shop.brin' }] },
          { text: 'dlg.c_bye', next: null },
        ],
      },
    },
  },
  'npc.cook': {
    npc: 'npc.cook',
    entries: [{ if: [{ flag: 'cook_taught' }], node: 'again' }, { node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.hesper.greet',
        choices: [
          { text: 'dlg.hesper.c_teach', next: 'teach' },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      teach: {
        id: 'teach',
        text: 'dlg.hesper.teach',
        do: [{ learnRecipe: 'recipe.herb_tea' }, { setFlag: 'cook_taught' }],
        next: 'trial',
      },
      trial: {
        id: 'trial',
        text: 'dlg.hesper.trial',
        do: [{ offerTrial: 'trial.foraging.15' }],
        next: null,
      },
      again: {
        id: 'again',
        text: 'dlg.hesper.again',
        choices: [
          { text: 'dlg.hesper.c_test', next: 'trial_again' },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      trial_again: { id: 'trial_again', text: 'dlg.hesper.trial', next: null },
    },
  },
  'npc.guard': {
    npc: 'npc.guard',
    entries: [
      { if: [{ ...asked, is: 'ready' }], node: 'report' },
      { if: [{ ...asked, is: 'active' }], node: 'progress' },
      { if: [{ ...asked, is: 'done' }], node: 'after' },
      { node: 'ask' },
    ],
    nodes: {
      ask: {
        id: 'ask',
        text: 'dlg.orla.ask',
        choices: [
          { text: 'dlg.orla.c_accept', next: 'accepted', do: [{ startRequest: asked.request }] },
          { text: 'dlg.orla.c_later', next: null },
        ],
      },
      accepted: { id: 'accepted', text: 'dlg.orla.accepted', next: null },
      progress: { id: 'progress', text: 'dlg.orla.progress', next: null },
      report: {
        id: 'report',
        text: 'dlg.orla.report',
        do: [{ turnIn: asked.request }],
        next: null,
      },
      after: { id: 'after', text: 'dlg.orla.after', next: null },
    },
  },
  // A stand-in for the Travelers of M5: a static figure whose two lines read as chat messages.
  'npc.pilgrim': {
    npc: 'npc.pilgrim',
    style: 'chat',
    entries: [{ node: 'one' }],
    nodes: {
      one: { id: 'one', text: 'dlg.pilgrim.one', next: 'two' },
      two: { id: 'two', text: 'dlg.pilgrim.two', next: null },
    },
  },
};
