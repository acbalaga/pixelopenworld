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
  'npc.smith': {
    id: 'npc.smith',
    name: 'Tobin',
    facing: 'down',
    doll: {
      body: 'a',
      skin: 'deep',
      hair: 'none',
      hairColor: 'black',
      top: 'vest',
      topColor: 'slate',
      bottom: 'trousers',
      bottomColor: 'brown',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.outfitter': {
    id: 'npc.outfitter',
    name: 'Mara',
    facing: 'down',
    doll: {
      body: 'b',
      skin: 'light',
      hair: 'ponytail',
      hairColor: 'auburn',
      top: 'tunic',
      topColor: 'green',
      bottom: 'skirt',
      bottomColor: 'brown',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.herbalist': {
    id: 'npc.herbalist',
    name: 'Ilse',
    facing: 'down',
    doll: {
      body: 'b',
      skin: 'pale',
      hair: 'bun',
      hairColor: 'blue',
      top: 'robe',
      topColor: 'green',
      bottom: 'skirt',
      bottomColor: 'slate',
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
  'npc.scholar': {
    id: 'npc.scholar',
    name: 'Wren',
    facing: 'down',
    doll: {
      body: 'b',
      skin: 'pale',
      hair: 'long',
      hairColor: 'rose',
      top: 'robe',
      topColor: 'red',
      bottom: 'skirt',
      bottomColor: 'brown',
      mainHand: 'staff',
      offHand: 'none',
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
  // Tier 1 trade for the new item set. Purses are small and capped, so no one buys without end.
  'shop.tobin': {
    id: 'shop.tobin',
    npc: 'npc.smith',
    purse: { start: 120, max: 200 },
    stock: [
      'item.sword_bronze',
      'item.spear_hunter',
      'item.shield_buckler',
      'item.pick_copper',
      'item.axe_copper',
      'item.sickle_copper',
      'item.hammer_copper',
      'item.rod_ash',
      'item.whetstone',
    ],
  },
  'shop.mara': {
    id: 'shop.mara',
    npc: 'npc.outfitter',
    purse: { start: 100, max: 180 },
    stock: [
      'item.trousers_wool',
      'item.cap_leather',
      'item.jerkin_leather',
      'item.chaps_leather',
      'item.coif_mail',
      'item.belt_leather',
      'item.amulet_bone',
      'item.thread_spool',
      'item.flute_reed',
    ],
  },
  'shop.ilse': {
    id: 'shop.ilse',
    npc: 'npc.herbalist',
    purse: { start: 90, max: 160 },
    stock: [
      'item.potion_health_s',
      'item.potion_stamina',
      'item.potion_focus',
      'item.dew_vial',
      'item.salt',
      'item.spark_dust',
      'item.trail_biscuit',
      'item.apple_tart',
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
  'request.ember_pods': {
    id: 'request.ember_pods',
    giver: 'npc.scholar',
    title: 'request.ember_pods.title',
    log: 'request.ember_pods.log',
    goal: { kill: 'creature.spitbloom', count: 2 },
    reward: { coin: 30, items: [], techniques: ['technique.ember_bolt'] },
  },
};

const asked = { request: 'request.clear_pests' } as const;
const pods = { request: 'request.ember_pods' } as const;

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
  'npc.smith': {
    npc: 'npc.smith',
    entries: [{ if: [{ flag: 'met_tobin' }], node: 'again' }, { node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.tobin.greet',
        do: [{ setFlag: 'met_tobin' }],
        choices: [
          { text: 'dlg.tobin.c_shop', next: null, do: [{ openShop: 'shop.tobin' }] },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      again: {
        id: 'again',
        text: 'dlg.tobin.again',
        choices: [
          { text: 'dlg.tobin.c_shop', next: null, do: [{ openShop: 'shop.tobin' }] },
          { text: 'dlg.c_bye', next: null },
        ],
      },
    },
  },
  'npc.outfitter': {
    npc: 'npc.outfitter',
    entries: [{ if: [{ flag: 'met_mara' }], node: 'again' }, { node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.mara.greet',
        do: [{ setFlag: 'met_mara' }],
        choices: [
          { text: 'dlg.mara.c_shop', next: null, do: [{ openShop: 'shop.mara' }] },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      again: {
        id: 'again',
        text: 'dlg.mara.again',
        choices: [
          { text: 'dlg.mara.c_shop', next: null, do: [{ openShop: 'shop.mara' }] },
          { text: 'dlg.c_bye', next: null },
        ],
      },
    },
  },
  'npc.herbalist': {
    npc: 'npc.herbalist',
    entries: [{ if: [{ flag: 'met_ilse' }], node: 'again' }, { node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.ilse.greet',
        do: [{ setFlag: 'met_ilse' }],
        choices: [
          { text: 'dlg.ilse.c_shop', next: null, do: [{ openShop: 'shop.ilse' }] },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      again: {
        id: 'again',
        text: 'dlg.ilse.again',
        choices: [
          { text: 'dlg.ilse.c_shop', next: null, do: [{ openShop: 'shop.ilse' }] },
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
        text: 'trial.foraging.15.intro',
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
      trial_again: { id: 'trial_again', text: 'trial.foraging.15.intro', next: null },
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
          { text: 'dlg.c_test', next: 'tests' },
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
      after: {
        id: 'after',
        text: 'dlg.orla.after',
        choices: [
          { text: 'dlg.c_test', next: 'tests' },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      tests: {
        id: 'tests',
        text: 'dlg.orla.tests',
        choices: [
          {
            text: 'dlg.orla.c_blades',
            next: 'offer_blades',
            if: [{ trial: 'trial.blades.15', is: 'passed', not: true }],
            do: [{ offerTrial: 'trial.blades.15' }],
          },
          {
            text: 'dlg.orla.c_polearms',
            next: 'offer_polearms',
            if: [{ trial: 'trial.polearms.15', is: 'passed', not: true }],
            do: [{ offerTrial: 'trial.polearms.15' }],
          },
          {
            text: 'dlg.orla.c_evasion',
            next: 'offer_evasion',
            if: [{ trial: 'trial.evasion.15', is: 'passed', not: true }],
            do: [{ offerTrial: 'trial.evasion.15' }],
          },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      offer_blades: { id: 'offer_blades', text: 'trial.blades.15.intro', next: null },
      offer_polearms: { id: 'offer_polearms', text: 'trial.polearms.15.intro', next: null },
      offer_evasion: { id: 'offer_evasion', text: 'trial.evasion.15.intro', next: null },
    },
  },
  'npc.scholar': {
    npc: 'npc.scholar',
    entries: [
      { if: [{ ...pods, is: 'ready' }], node: 'report' },
      { if: [{ ...pods, is: 'active' }], node: 'progress' },
      { if: [{ ...pods, is: 'done' }], node: 'after' },
      { node: 'ask' },
    ],
    nodes: {
      ask: {
        id: 'ask',
        text: 'dlg.wren.ask',
        choices: [
          { text: 'dlg.wren.c_accept', next: 'accepted', do: [{ startRequest: pods.request }] },
          { text: 'dlg.c_test', next: 'tests' },
          { text: 'dlg.wren.c_later', next: null },
        ],
      },
      accepted: { id: 'accepted', text: 'dlg.wren.accepted', next: null },
      progress: { id: 'progress', text: 'dlg.wren.progress', next: null },
      report: {
        id: 'report',
        text: 'dlg.wren.report',
        do: [{ turnIn: pods.request }],
        next: null,
      },
      after: {
        id: 'after',
        text: 'dlg.wren.after',
        choices: [
          { text: 'dlg.c_test', next: 'tests' },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      tests: {
        id: 'tests',
        text: 'dlg.wren.tests',
        choices: [
          {
            text: 'dlg.wren.c_ember',
            next: 'offer_ember',
            if: [{ trial: 'trial.ember.15', is: 'passed', not: true }],
            do: [{ offerTrial: 'trial.ember.15' }],
          },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      offer_ember: { id: 'offer_ember', text: 'trial.ember.15.intro', next: null },
    },
  },
  // A stand-in for the Travelers of M5: a static figure whose two lines read as chat messages.
  'npc.pilgrim': {
    npc: 'npc.pilgrim',
    style: 'chat',
    entries: [{ node: 'one' }],
    nodes: {
      one: { id: 'one', text: 'dlg.pilgrim.one', next: 'two' },
      two: {
        id: 'two',
        text: 'dlg.pilgrim.two',
        choices: [
          { text: 'dlg.c_test', next: 'tests' },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      tests: {
        id: 'tests',
        text: 'dlg.pilgrim.tests',
        choices: [
          {
            text: 'dlg.pilgrim.c_athletics',
            next: 'offer_athletics',
            if: [{ trial: 'trial.athletics.15', is: 'passed', not: true }],
            do: [{ offerTrial: 'trial.athletics.15' }],
          },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      offer_athletics: { id: 'offer_athletics', text: 'trial.athletics.15.intro', next: null },
    },
  },
};
