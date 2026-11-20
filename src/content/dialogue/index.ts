import { COLD_OVEN_FLAGS } from '../singulars';
import { EVERY } from '../requests/dawnmeadow';
import { AUTHORED_TRIALS } from '../skills/dawnmeadowTrials';
import type { Choice, Cond, Dialogue, DialogueNode, NpcDef, ShopDef } from './types';

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
  'npc.carpenter': {
    id: 'npc.carpenter',
    name: 'Pell',
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
  'npc.tinker': {
    id: 'npc.tinker',
    name: 'Juniper',
    facing: 'down',
    doll: {
      body: 'b',
      skin: 'peach',
      hair: 'ponytail',
      hairColor: 'ginger',
      top: 'tunic',
      topColor: 'blue',
      bottom: 'trousers',
      bottomColor: 'slate',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.miller': {
    id: 'npc.miller',
    name: 'Aldo',
    facing: 'down',
    doll: {
      body: 'a',
      skin: 'light',
      hair: 'short',
      hairColor: 'white',
      top: 'tunic',
      topColor: 'ochre',
      bottom: 'trousers',
      bottomColor: 'brown',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.farmer': {
    id: 'npc.farmer',
    name: 'Tamsin',
    facing: 'left',
    doll: {
      body: 'b',
      skin: 'peach',
      hair: 'long',
      hairColor: 'blond',
      top: 'tunic',
      topColor: 'rose',
      bottom: 'skirt',
      bottomColor: 'green',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.fisher': {
    id: 'npc.fisher',
    name: 'Nessa',
    facing: 'down',
    doll: {
      body: 'b',
      skin: 'bronze',
      hair: 'curly',
      hairColor: 'black',
      top: 'vest',
      topColor: 'blue',
      bottom: 'trousers',
      bottomColor: 'brown',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.foreman': {
    id: 'npc.foreman',
    name: 'Garrick',
    facing: 'down',
    doll: {
      body: 'a',
      skin: 'deep',
      hair: 'none',
      hairColor: 'black',
      top: 'vest',
      topColor: 'red',
      bottom: 'trousers',
      bottomColor: 'slate',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.hermit': {
    id: 'npc.hermit',
    name: 'Old Fen',
    facing: 'right',
    doll: {
      body: 'a',
      skin: 'pale',
      hair: 'long',
      hairColor: 'grey',
      top: 'robe',
      topColor: 'green',
      bottom: 'trousers',
      bottomColor: 'brown',
      mainHand: 'none',
      offHand: 'none',
    },
  },
  'npc.reeve': {
    id: 'npc.reeve',
    name: 'Edda',
    facing: 'down',
    doll: {
      body: 'b',
      skin: 'umber',
      hair: 'bun',
      hairColor: 'grey',
      top: 'robe',
      topColor: 'slate',
      bottom: 'skirt',
      bottomColor: 'slate',
      mainHand: 'none',
      offHand: 'none',
    },
  },
};

export const SHOPS: Readonly<Record<string, ShopDef>> = {
  'shop.brin': {
    id: 'shop.brin',
    region: 'dawnmeadow',
    buys: ['gear', 'food', 'materials', 'other'],
    firmness: 30,
    repairs: true,
    npc: 'npc.shopkeeper',
    purse: { start: 80, max: 150 },
    stock: [
      { item: 'item.dish_bread', max: 10 },
      { item: 'item.herb_tea', max: 10 },
      { item: 'item.cap_wool', max: 3 },
      { item: 'item.shield_wood', max: 3 },
      { item: 'item.spear_ash', max: 3 },
      { item: 'item.maul_oak', max: 3 },
      { item: 'item.bow_short', max: 3 },
      { item: 'item.wraps_cloth', max: 3 },
      { item: 'item.lantern_oil', max: 10 },
      { item: 'item.scroll_sword_iron', max: 1 },
    ],
  },
  // Tier 1 trade for the new item set. Purses are small and capped, so no one buys without end.
  'shop.tobin': {
    id: 'shop.tobin',
    region: 'dawnmeadow',
    buys: ['gear', 'tools', 'materials'],
    firmness: 40,
    npc: 'npc.smith',
    purse: { start: 120, max: 200 },
    stock: [
      { item: 'item.sword_bronze', max: 3 },
      { item: 'item.spear_hunter', max: 3 },
      { item: 'item.shield_buckler', max: 3 },
      { item: 'item.pick_copper', max: 3 },
      { item: 'item.axe_copper', max: 3 },
      { item: 'item.sickle_copper', max: 3 },
      { item: 'item.hammer_copper', max: 3 },
      { item: 'item.rod_ash', max: 3 },
      { item: 'item.whetstone', max: 10 },
    ],
  },
  'shop.mara': {
    id: 'shop.mara',
    region: 'dawnmeadow',
    buys: ['gear', 'materials', 'other'],
    firmness: 25,
    npc: 'npc.outfitter',
    purse: { start: 100, max: 180 },
    stock: [
      { item: 'item.trousers_wool', max: 3 },
      { item: 'item.cap_leather', max: 3 },
      { item: 'item.jerkin_leather', max: 3 },
      { item: 'item.chaps_leather', max: 3 },
      { item: 'item.coif_mail', max: 3 },
      { item: 'item.belt_leather', max: 3 },
      { item: 'item.amulet_bone', max: 3 },
      { item: 'item.thread_spool', max: 10 },
      { item: 'item.flute_reed', max: 3 },
    ],
  },
  'shop.ilse': {
    id: 'shop.ilse',
    region: 'dawnmeadow',
    buys: ['food', 'materials', 'other'],
    firmness: 20,
    npc: 'npc.herbalist',
    purse: { start: 90, max: 160 },
    stock: [
      { item: 'item.potion_health_s', max: 10 },
      { item: 'item.potion_stamina', max: 10 },
      { item: 'item.potion_focus', max: 10 },
      { item: 'item.dew_vial', max: 10 },
      { item: 'item.salt', max: 10 },
      { item: 'item.spark_dust', max: 10 },
      { item: 'item.trail_biscuit', max: 10 },
      { item: 'item.apple_tart', max: 10 },
    ],
  },
};

/**
 * One request's conversation: the four nodes (ask, accepted, progress, report), the entry that
 * turns it in, and the two choices that reach it. The ask line is the request's own text.
 */
function requestFlow(
  key: string,
  request: string,
  npc: string,
  askText: string,
): {
  nodes: Record<string, DialogueNode>;
  ready: { if: readonly Cond[]; node: string };
  offer: Choice;
  remind: Choice;
} {
  const is = (state: 'none' | 'active' | 'ready'): { request: string; is: typeof state } => ({
    request,
    is: state,
  });
  return {
    nodes: {
      [`${key}_ask`]: {
        id: `${key}_ask`,
        text: askText,
        choices: [
          { text: 'dlg.c_accept', next: `${key}_accepted`, do: [{ startRequest: request }] },
          { text: 'dlg.c_later', next: null },
        ],
      },
      [`${key}_accepted`]: {
        id: `${key}_accepted`,
        text: `dlg.${npc}.${key}_accepted`,
        next: null,
      },
      [`${key}_progress`]: {
        id: `${key}_progress`,
        text: `dlg.${npc}.${key}_progress`,
        next: null,
      },
      [`${key}_report`]: {
        id: `${key}_report`,
        text: `dlg.${npc}.${key}_report`,
        do: [{ turnIn: request }],
        next: null,
      },
    },
    ready: { if: [is('ready')], node: `${key}_report` },
    offer: { text: `dlg.${npc}.c_${key}`, next: `${key}_ask`, if: [is('none')] },
    remind: { text: `dlg.${npc}.c_${key}_remind`, next: `${key}_progress`, if: [is('active')] },
  };
}

const boar = requestFlow('boar', 'request.cave_boar', 'orla', 'request.cave_boar.ask');
const lamps = requestFlow('lamps', 'request.old_lamps', 'wren', 'request.old_lamps.ask');
const supper = requestFlow('supper', 'request.watch_supper', 'hesper', 'request.watch_supper.ask');
const anvil = requestFlow('anvil', 'request.anvil_metal', 'brin', 'request.anvil_metal.ask');
const deep = requestFlow('deep', 'request.deep_room', 'pilgrim', 'request.deep_room.ask');

/**
 * A lesson (M4-15): a teacher shows one technique for a small ask. `ask` is an item to hand over
 * or a skill that must already be awake ("show me what you have done"). Teaching awakens the
 * skill, so a person can open a skill the player has never used.
 */
const lesson = (
  text: string,
  technique: string,
  ask: { item: string; qty: number } | { awake: string },
): Choice => ({
  text,
  next: 'taught',
  if: [
    { flag: `learned.${technique}`, not: true },
    'item' in ask ? { item: ask.item, atLeast: ask.qty } : { awake: ask.awake },
  ],
  do: [
    ...('item' in ask ? [{ takeItem: ask.item, qty: ask.qty }] : []),
    { learnTechnique: technique },
  ],
});

const asked = { request: 'request.clear_pests' } as const;
const pods = { request: 'request.ember_pods' } as const;

const BASE_DIALOGUES: Readonly<Record<string, Dialogue>> = {
  'npc.shopkeeper': {
    npc: 'npc.shopkeeper',
    entries: [anvil.ready, { if: [{ flag: 'met_brin' }], node: 'again' }, { node: 'greet' }],
    nodes: {
      ...anvil.nodes,
      greet: {
        id: 'greet',
        text: 'dlg.brin.greet',
        do: [{ setFlag: 'met_brin' }],
        choices: [
          { text: 'dlg.brin.c_shop', next: null, do: [{ openShop: 'shop.brin' }] },
          {
            text: 'dlg.brin.c_test',
            next: 'offer_smithing',
            if: [{ trial: 'trial.smithing.15', is: 'passed', not: true }],
            do: [{ offerTrial: 'trial.smithing.15' }, { learnRecipe: 'recipe.sword_iron' }],
          },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      offer_smithing: {
        id: 'offer_smithing',
        text: 'trial.smithing.15.intro',
        next: null,
      },
      again: {
        id: 'again',
        text: 'dlg.brin.again',
        choices: [
          { text: 'dlg.brin.c_shop', next: null, do: [{ openShop: 'shop.brin' }] },
          anvil.offer,
          anvil.remind,
          {
            text: 'dlg.brin.c_test',
            next: 'offer_smithing',
            if: [{ trial: 'trial.smithing.15', is: 'passed', not: true }],
            do: [{ offerTrial: 'trial.smithing.15' }, { learnRecipe: 'recipe.sword_iron' }],
          },
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
          { text: 'dlg.tobin.c_lesson', next: 'lesson' },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      lesson: {
        id: 'lesson',
        text: 'dlg.tobin.lesson',
        choices: [
          lesson('dlg.tobin.c_overhead', 'technique.heavy_overhead', {
            item: 'item.copper_ore',
            qty: 3,
          }),
          { text: 'dlg.c_bye', next: null },
        ],
      },
      taught: { id: 'taught', text: 'dlg.tobin.taught', next: null },
      // The Cold Oven (M4-20). Offered only once the Singular's own step has set its flag.
      bricks: {
        id: 'bricks',
        text: 'dlg.tobin.bricks',
        choices: [
          {
            text: 'dlg.tobin.c_bricks_set',
            next: 'bricks_done',
            if: [
              { skill: 'skill.smithing', atLeast: 10 },
              { item: 'item.firebrick', atLeast: 1 },
            ],
            do: [{ takeItem: 'item.firebrick', qty: 1 }, { setFlag: COLD_OVEN_FLAGS.set }],
          },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      bricks_done: { id: 'bricks_done', text: 'dlg.tobin.bricks_done', next: null },
      again: {
        id: 'again',
        text: 'dlg.tobin.again',
        choices: [
          { text: 'dlg.tobin.c_shop', next: null, do: [{ openShop: 'shop.tobin' }] },
          { text: 'dlg.tobin.c_lesson', next: 'lesson' },
          {
            text: 'dlg.tobin.c_bricks',
            next: 'bricks',
            if: [{ flag: COLD_OVEN_FLAGS.bricks }, { flag: COLD_OVEN_FLAGS.set, not: true }],
          },
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
    entries: [supper.ready, { if: [{ flag: 'cook_taught' }], node: 'again' }, { node: 'greet' }],
    nodes: {
      ...supper.nodes,
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
          supper.offer,
          supper.remind,
          { text: 'dlg.hesper.c_test', next: 'trial_again' },
          { text: 'dlg.hesper.c_lesson', next: 'lesson' },
          {
            text: 'dlg.hesper.c_cook',
            next: 'offer_cooking',
            if: [{ trial: 'trial.cooking.15', is: 'passed', not: true }],
            do: [{ offerTrial: 'trial.cooking.15' }, { learnRecipe: 'recipe.hearty_stew' }],
          },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      lesson: {
        id: 'lesson',
        text: 'dlg.hesper.lesson',
        choices: [
          lesson('dlg.hesper.c_hum', 'technique.performance_hum', { item: 'item.sunwort', qty: 2 }),
          { text: 'dlg.c_bye', next: null },
        ],
      },
      taught: { id: 'taught', text: 'dlg.hesper.taught', next: null },
      offer_cooking: { id: 'offer_cooking', text: 'trial.cooking.15.intro', next: null },
      trial_again: { id: 'trial_again', text: 'trial.foraging.15.intro', next: null },
    },
  },
  'npc.guard': {
    npc: 'npc.guard',
    entries: [
      { if: [{ ...asked, is: 'ready' }], node: 'report' },
      boar.ready,
      { if: [{ ...asked, is: 'active' }], node: 'progress' },
      { if: [{ ...asked, is: 'done' }], node: 'after' },
      { node: 'ask' },
    ],
    nodes: {
      ...boar.nodes,
      ask: {
        id: 'ask',
        text: 'dlg.orla.ask',
        choices: [
          { text: 'dlg.orla.c_accept', next: 'accepted', do: [{ startRequest: asked.request }] },
          { text: 'dlg.c_test', next: 'tests' },
          { text: 'dlg.orla.c_lesson', next: 'lessons' },
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
          boar.offer,
          boar.remind,
          { text: 'dlg.c_test', next: 'tests' },
          { text: 'dlg.orla.c_lesson', next: 'lessons' },
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
      lessons: {
        id: 'lessons',
        text: 'dlg.orla.lessons',
        choices: [
          lesson('dlg.orla.c_polearm_lunge', 'technique.polearms_lunge', {
            item: 'item.moss_tuft',
            qty: 3,
          }),
          lesson('dlg.orla.c_aimed', 'technique.archery_aimed', { item: 'item.moss_tuft', qty: 3 }),
          lesson('dlg.orla.c_bash', 'technique.shieldcraft_bash', { awake: 'skill.shieldcraft' }),
          { text: 'dlg.c_bye', next: null },
        ],
      },
      taught: { id: 'taught', text: 'dlg.orla.taught', next: null },
      offer_blades: { id: 'offer_blades', text: 'trial.blades.15.intro', next: null },
      offer_polearms: { id: 'offer_polearms', text: 'trial.polearms.15.intro', next: null },
      offer_evasion: { id: 'offer_evasion', text: 'trial.evasion.15.intro', next: null },
    },
  },
  'npc.scholar': {
    npc: 'npc.scholar',
    entries: [
      { if: [{ ...pods, is: 'ready' }], node: 'report' },
      lamps.ready,
      { if: [{ ...pods, is: 'active' }], node: 'progress' },
      { if: [{ ...pods, is: 'done' }], node: 'after' },
      { node: 'ask' },
    ],
    nodes: {
      ...lamps.nodes,
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
          lamps.offer,
          lamps.remind,
          { text: 'dlg.wren.c_teach', next: 'teach' },
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
      teach: {
        id: 'teach',
        text: 'dlg.wren.teach',
        choices: [
          {
            text: 'dlg.wren.c_ember_school',
            next: 'taught',
            if: [{ flag: 'learned.technique.ember_bolt', not: true }],
            do: [{ learnTechnique: 'technique.ember_bolt' }],
          },
          {
            text: 'dlg.wren.c_tide',
            next: 'taught',
            if: [{ flag: 'learned.technique.tide_splash', not: true }],
            do: [{ learnTechnique: 'technique.tide_splash' }],
          },
          {
            text: 'dlg.wren.c_gale',
            next: 'taught',
            if: [{ flag: 'learned.technique.gale_gust', not: true }],
            do: [{ learnTechnique: 'technique.gale_gust' }],
          },
          { text: 'dlg.wren.c_more', next: 'teach_more' },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      teach_more: {
        id: 'teach_more',
        text: 'dlg.wren.teach',
        choices: [
          {
            text: 'dlg.wren.c_stone',
            next: 'taught',
            if: [{ flag: 'learned.technique.stone_fist', not: true }],
            do: [{ learnTechnique: 'technique.stone_fist' }],
          },
          {
            text: 'dlg.wren.c_mending',
            next: 'taught',
            if: [{ flag: 'learned.technique.mending_mend', not: true }],
            do: [{ learnTechnique: 'technique.mending_mend' }],
          },
          {
            text: 'dlg.wren.c_hexing',
            next: 'taught',
            if: [{ flag: 'learned.technique.hexing_hex', not: true }],
            do: [{ learnTechnique: 'technique.hexing_hex' }],
          },
          { text: 'dlg.c_bye', next: null },
        ],
      },
      taught: { id: 'taught', text: 'dlg.wren.taught', next: null },
    },
  },
  // A stand-in for the Travelers of M5: a static figure whose two lines read as chat messages.
  'npc.pilgrim': {
    npc: 'npc.pilgrim',
    style: 'chat',
    entries: [deep.ready, { node: 'one' }],
    nodes: {
      ...deep.nodes,
      one: { id: 'one', text: 'dlg.pilgrim.one', next: 'two' },
      two: {
        id: 'two',
        text: 'dlg.pilgrim.two',
        choices: [
          deep.offer,
          deep.remind,
          { text: 'dlg.c_test', next: 'tests' },
          { text: 'dlg.pilgrim.c_lesson', next: 'lesson' },
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
      lesson: {
        id: 'lesson',
        text: 'dlg.pilgrim.lesson',
        choices: [
          lesson('dlg.pilgrim.c_hide', 'technique.stealth_hide', {
            item: 'item.dish_bread',
            qty: 1,
          }),
          { text: 'dlg.c_bye', next: null },
        ],
      },
      taught: { id: 'taught', text: 'dlg.pilgrim.taught', next: null },
      offer_athletics: { id: 'offer_athletics', text: 'trial.athletics.15.intro', next: null },
    },
  },
  'npc.carpenter': {
    npc: 'npc.carpenter',
    entries: [{ node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.carpenter.greet',
        choices: [{ text: 'dlg.c_bye', next: null }],
      },
    },
  },
  'npc.tinker': {
    npc: 'npc.tinker',
    entries: [{ node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.tinker.greet',
        choices: [{ text: 'dlg.c_bye', next: null }],
      },
    },
  },
  'npc.miller': {
    npc: 'npc.miller',
    entries: [{ node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.miller.greet',
        choices: [{ text: 'dlg.c_bye', next: null }],
      },
    },
  },
  'npc.farmer': {
    npc: 'npc.farmer',
    entries: [{ node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.farmer.greet',
        choices: [{ text: 'dlg.c_bye', next: null }],
      },
    },
  },
  'npc.fisher': {
    npc: 'npc.fisher',
    entries: [{ node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.fisher.greet',
        choices: [{ text: 'dlg.c_bye', next: null }],
      },
    },
  },
  'npc.foreman': {
    npc: 'npc.foreman',
    entries: [{ node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.foreman.greet',
        choices: [{ text: 'dlg.c_bye', next: null }],
      },
    },
  },
  'npc.hermit': {
    npc: 'npc.hermit',
    entries: [{ node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.hermit.greet',
        choices: [{ text: 'dlg.c_bye', next: null }],
      },
    },
  },
  'npc.reeve': {
    npc: 'npc.reeve',
    entries: [{ node: 'greet' }],
    nodes: {
      greet: {
        id: 'greet',
        text: 'dlg.reeve.greet',
        choices: [{ text: 'dlg.c_bye', next: null }],
      },
    },
  },
};

/**
 * Where each giver's "Is there any work for me?" goes: the nodes a returning player lands on. The
 * old givers keep their own request choices; the hub is one more door.
 */
const WORK_HOSTS: Readonly<Record<string, readonly string[]>> = {
  'npc.shopkeeper': ['greet', 'again'],
  'npc.smith': ['greet', 'again'],
  'npc.outfitter': ['greet', 'again'],
  'npc.herbalist': ['greet', 'again'],
  'npc.cook': ['greet', 'again'],
  'npc.guard': ['ask', 'after'],
  'npc.scholar': ['ask', 'after'],
  'npc.pilgrim': ['two'],
};

/**
 * Adds Dawnmeadow's authored requests and Trials (M4-12) to their givers. A request gets a turn-in
 * entry and a place on the work node; a Trial gets a place on the test node. Each node is reached
 * from a door on the node the giver's menu starts at.
 */
function withAuthored(base: Readonly<Record<string, Dialogue>>): Record<string, Dialogue> {
  const out: Record<string, Dialogue> = { ...base };
  const givers = [
    ...new Set([...EVERY.map((a) => a.giver), ...AUTHORED_TRIALS.map((t) => t.giver)]),
  ];
  for (const npc of givers) {
    const d = base[npc];
    if (!d) continue;
    const nodes: Record<string, DialogueNode> = { ...d.nodes };
    const entries = [...d.entries];
    const doors: Choice[] = [];

    const mine = EVERY.filter((a) => a.giver === npc);
    const flows = mine.map((a) => {
      const f = requestFlow(a.key, `request.${a.key}`, 'rq', `request.${a.key}.ask`);
      // A Thread stage is offered only once the stage before it is done.
      const after = a.thread?.after;
      return after
        ? {
            ...f,
            offer: {
              ...f.offer,
              if: [...(f.offer.if ?? []), { request: `request.${after}`, is: 'done' as const }],
            },
          }
        : f;
    });
    if (flows.length > 0) {
      for (const f of flows) Object.assign(nodes, f.nodes);
      nodes['work'] = {
        id: 'work',
        text: 'dlg.rq.work',
        choices: [...flows.flatMap((f) => [f.offer, f.remind]), { text: 'dlg.c_bye', next: null }],
      };
      entries.unshift(...flows.map((f) => f.ready));
      doors.push({ text: 'dlg.c_work', next: 'work' });
    }

    const tests = AUTHORED_TRIALS.filter((t) => t.giver === npc);
    if (tests.length > 0) {
      const choices: Choice[] = [];
      for (const t of tests) {
        const name = t.skill.replace(/^skill\./, '');
        const trial = `trial.${name}.15`;
        nodes[`rq_offer_${name}`] = { id: `rq_offer_${name}`, text: `${trial}.intro`, next: null };
        choices.push({
          text: `dlg.rq.t_${name}`,
          next: `rq_offer_${name}`,
          if: [{ trial, is: 'passed', not: true }],
          do: [{ offerTrial: trial }],
        });
      }
      nodes['rq_tests'] = {
        id: 'rq_tests',
        text: 'dlg.rq.tests',
        choices: [...choices, { text: 'dlg.c_bye', next: null }],
      };
      doors.push({ text: 'dlg.c_tests', next: 'rq_tests' });
    }

    for (const h of WORK_HOSTS[npc] ?? ['greet']) {
      const n = nodes[h];
      if (!n?.choices) continue;
      // Before the last choice, which is the way out.
      const at = n.choices.length - 1;
      nodes[h] = { ...n, choices: [...n.choices.slice(0, at), ...doors, ...n.choices.slice(at)] };
    }
    out[npc] = { ...d, entries, nodes };
  }
  return out;
}

export const DIALOGUES: Readonly<Record<string, Dialogue>> = withAuthored(BASE_DIALOGUES);
