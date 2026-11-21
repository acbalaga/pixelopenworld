import { REQUEST_BALANCE as RB } from '../balance/requests';
import { UNDERMILL_BUILT } from '../world/dungeons/undermill';
import { THREAD_STAGES } from './threads';
import type { RequestDef, RequestObjective } from './types';

/**
 * Dawnmeadow's authored requests (POW-M4-12, regions/01-dawnmeadow section 10), the ones the
 * game can run today. Each is written once here: the job, the asker's words, one line per way to
 * finish, and what the giver says. `requests/index.ts` turns the jobs into `RequestDef`s,
 * `strings/dawnmeadowRequests.ts` the words into strings and `dialogue` the lines into
 * conversation. The rest of the table waits on places and mechanics that are not built (the
 * Undermill, carvings, the tower clock): see the PR for the list.
 *
 * Voice: plain, a little dry, no lore. No em dashes. Titles are at most 24 characters.
 */
export interface AuthoredRequest {
  /** `request.<key>`; also names its dialogue nodes. */
  key: string;
  /** The row of the region doc's table it stands for. */
  row: string;
  giver: string;
  title: string;
  ask: string;
  ways: { id: string; label: string; steps: RequestObjective[] }[];
  reward: { coin: number; renown: number; items?: { item: string; qty: number }[] };
  estMinutes: number;
  /** Items handed over when the request is taken. */
  give?: { item: string; qty: number }[];
  /** A Thread stage: the Thread it belongs to, and the stage before it, which must be done first. */
  thread?: { id: string; after?: string };
  /** What the giver says. `offer` and `remind` are the player's two buttons. */
  talk: { offer: string; remind: string; accepted: string; progress: string; report: string };
}

const deliver = (
  item: string,
  qty: number,
  to: string,
  minQuality?: 1 | 2 | 3,
): RequestObjective => ({
  kind: 'deliver',
  item,
  qty,
  to,
  ...(minQuality ? { minQuality } : {}),
});

export const AUTHORED: readonly AuthoredRequest[] = [
  {
    key: 'bread_road',
    row: 'r1',
    giver: 'npc.cook',
    title: 'Bread for the road',
    ask: "A wagon leaves at dawn and the carters have nothing to eat. Three loaves of bread, or one proper baker's loaf, and they will thank you for it.",
    ways: [
      { id: 'bread', label: 'Bring bread', steps: [deliver('item.dish_bread', 3, 'npc.cook')] },
      {
        id: 'loaf',
        label: "Bring a baker's loaf",
        steps: [deliver('item.bakers_loaf', 1, 'npc.cook')],
      },
    ],
    reward: { coin: 40, renown: 1 },
    estMinutes: 8,
    talk: {
      offer: 'Do the carters need feeding?',
      remind: "About the carters' bread.",
      accepted: 'Bring it here when you have it. They leave at first light.',
      progress: "Three loaves of bread, or one baker's loaf. I will not send them off hungry.",
      report: 'That will do nicely. Here is something for the trouble.',
    },
  },
  {
    key: 'song_inn',
    row: 'r11',
    giver: 'npc.cook',
    title: 'A song for the inn',
    ask: 'The common room has gone quiet. Learn the Hum of Courage and sing it where we can hear, and the regulars may remember how to talk.',
    ways: [
      {
        id: 'sing',
        label: 'Sing the Hum of Courage',
        steps: [
          {
            kind: 'perform',
            action: 'technique',
            technique: 'technique.performance_hum',
            count: 1,
          },
        ],
      },
    ],
    reward: { coin: 35, renown: 1 },
    estMinutes: 6,
    talk: {
      offer: 'Could the inn use a song?',
      remind: 'About the song.',
      accepted: 'Low and steady, mind. Nothing too clever for a Tuesday.',
      progress: 'The Hum of Courage. I will know it when I hear it.',
      report: 'Better. Look, they are talking again. Take this.',
    },
  },
  {
    key: 'wool_downs',
    row: 'r7',
    giver: 'npc.outfitter',
    title: 'Wool from the downs',
    ask: 'I am out of wool. The rams on the downs shed more than they need. Six tufts, or two lengths of wool cloth, and I can start on coats again.',
    ways: [
      {
        id: 'tufts',
        label: 'Bring wool tufts',
        steps: [deliver('item.wool_tuft', 6, 'npc.outfitter')],
      },
      {
        id: 'cloth',
        label: 'Bring wool cloth',
        steps: [deliver('item.wool_cloth', 2, 'npc.outfitter')],
      },
    ],
    reward: { coin: 45, renown: 1 },
    estMinutes: 8,
    talk: {
      offer: 'Do you need wool?',
      remind: 'About the wool.',
      accepted: 'Take your time. The rams are not going anywhere.',
      progress: 'Six wool tufts, or two lengths of wool cloth.',
      report: 'Lovely and soft. Here is your share.',
    },
  },
  {
    key: 'moss_poultice',
    row: 'r4',
    giver: 'npc.herbalist',
    title: 'Moss for the poultice',
    ask: 'Moss is what holds a poultice together, and I am nearly out. Eight tufts from the Commons would see me through the month.',
    ways: [
      {
        id: 'moss',
        label: 'Bring moss tufts',
        steps: [deliver('item.moss_tuft', 8, 'npc.herbalist')],
      },
    ],
    reward: { coin: 30, renown: 1 },
    estMinutes: 6,
    talk: {
      offer: 'Is there anything you need gathered?',
      remind: 'About the moss.',
      accepted: 'Clean tufts, not the ones that have been trodden on.',
      progress: 'Eight tufts of moss. The Commons has plenty.',
      report: 'Good, clean moss. This will hold a great many poultices.',
    },
  },
  {
    key: 'kindling_forge',
    row: 'r9',
    giver: 'npc.smith',
    title: 'Kindling for the forge',
    ask: 'The forge eats wood faster than I can chop it. Ten oak logs, or ten ash, and I will keep the fire up all week.',
    ways: [
      { id: 'oak', label: 'Bring oak logs', steps: [deliver('item.oak_log', 10, 'npc.smith')] },
      { id: 'ash', label: 'Bring ash logs', steps: [deliver('item.ash_log', 10, 'npc.smith')] },
    ],
    reward: { coin: 45, renown: 1 },
    estMinutes: 8,
    talk: {
      offer: 'Does the forge need fuel?',
      remind: 'About the logs.',
      accepted: 'Stack them by the door. I will not ask how many trees you cursed.',
      progress: 'Ten logs, oak or ash. Green wood smokes, so mind the state of it.',
      report: 'That will burn. Here, for your back.',
    },
  },
  {
    key: 'copper_pots',
    row: 'r10',
    giver: 'npc.smith',
    title: 'Copper for pots',
    ask: 'The inn wants copper pots and I want copper to make them. Three ingots, or eight ore if you would rather I did the smelting.',
    ways: [
      {
        id: 'ingots',
        label: 'Bring copper ingots',
        steps: [deliver('item.copper_ingot', 3, 'npc.smith')],
      },
      { id: 'ore', label: 'Bring copper ore', steps: [deliver('item.copper_ore', 8, 'npc.smith')] },
    ],
    reward: { coin: 55, renown: 1 },
    estMinutes: 10,
    talk: {
      offer: 'Any more metal work?',
      remind: 'About the copper.',
      accepted: 'Ingots save me a morning. Ore saves you the trouble of a furnace.',
      progress: 'Three ingots, or eight ore.',
      report: 'Good copper. The inn will have its pots.',
    },
  },
  {
    key: 'blade_orla',
    row: 'r3',
    giver: 'npc.guard',
    title: 'A blade for Orla',
    ask: 'The practice blades in the yard are chipped to nothing. Make me a bronze sword worth carrying, Fine quality or better, and bring it here.',
    ways: [
      {
        id: 'sword',
        label: 'Bring a Fine bronze sword',
        steps: [deliver('item.sword_bronze', 1, 'npc.guard', 1)],
      },
    ],
    reward: { coin: 80, renown: 2 },
    estMinutes: 12,
    talk: {
      offer: 'Does the yard need a blade?',
      remind: 'About the sword.',
      accepted: 'Take your time over it. A rushed blade is a bad blade.',
      progress: 'A bronze sword, Fine or better. Check the edge before you bring it.',
      report: 'That is a good edge. The yard will be glad of it.',
    },
  },
  {
    key: 'thornling_fernside',
    row: 'r24',
    giver: 'npc.guard',
    title: 'Thornling at Fernside',
    ask: 'A thornling scout has been seen at Fernside Edge, far from where it belongs. It hits harder than it looks. Put one down, and go in rested.',
    ways: [
      {
        id: 'defeat',
        label: 'Put the Thornling Scout down',
        steps: [{ kind: 'defeat', creature: 'creature.thornling_scout', count: 1 }],
      },
    ],
    reward: { coin: 90, renown: 3 },
    estMinutes: 15,
    talk: {
      offer: 'I heard something about Fernside.',
      remind: 'About the thornling.',
      accepted: 'West road, past the arch. Do not fight it in the open.',
      progress: 'One thornling scout, at Fernside Edge. Bring food.',
      report: 'Good. The road west is a little safer. Take this.',
    },
  },
  {
    key: 'chapel_roof',
    row: 'r25',
    giver: 'npc.pilgrim',
    title: 'Mend the chapel roof',
    ask: 'The chapel roof lets the rain in. Six oak planks, or six ash, and I will have it closed before the next storm.',
    ways: [
      {
        id: 'oak',
        label: 'Bring oak planks',
        steps: [deliver('item.oak_plank', 6, 'npc.pilgrim')],
      },
      {
        id: 'ash',
        label: 'Bring ash planks',
        steps: [deliver('item.ash_plank', 6, 'npc.pilgrim')],
      },
    ],
    reward: { coin: 50, renown: 2 },
    estMinutes: 12,
    talk: {
      offer: 'Does the chapel need anything?',
      remind: 'About the roof.',
      accepted: 'The wayside chapel, south of the town. I sleep there, so I notice the rain.',
      progress: 'Six planks, oak or ash.',
      report: 'It will hold now. Thank you. Take this.',
    },
  },
  {
    key: 'boar_fence',
    row: 'r5',
    giver: 'npc.farmer',
    title: 'The boar at the fence',
    ask: 'A bramble boar keeps tearing at our fence. Put it down, or feed it a few berries and it may lose interest.',
    ways: [
      {
        id: 'defeat',
        label: 'Put the Bramble Boar down',
        steps: [{ kind: 'defeat', creature: 'creature.bramble_boar', count: 1 }],
      },
      {
        id: 'feed',
        label: 'Feed the Bramble Boar',
        steps: [{ kind: 'feed', creature: 'creature.bramble_boar', count: 1 }],
      },
    ],
    reward: { coin: 45, renown: 1 },
    estMinutes: 8,
    talk: {
      offer: 'Is something wrong at the farm?',
      remind: 'About the boar.',
      accepted: 'It comes at dusk. Boars like berries and they hate being hurried.',
      progress: 'The boar by the fence. Down, or fed.',
      report: 'Quiet at last. Dad owes you a drink. I owe you this.',
    },
  },
  {
    key: 'pie_aldo',
    row: 'r23',
    giver: 'npc.miller',
    title: 'A pie for Aldo',
    ask: "My mother's pie was berries and a good crust. Make me a berry compote worth the name, Fine quality, and I will remember the taste.",
    ways: [
      {
        id: 'compote',
        label: 'Bring a Fine berry compote',
        steps: [deliver('item.berry_compote', 1, 'npc.miller', 1)],
      },
    ],
    reward: { coin: 50, renown: 1 },
    estMinutes: 8,
    talk: {
      offer: 'Is there something you miss?',
      remind: 'About the compote.',
      accepted: 'Berries, a little patience. The inn has a pot you can use.',
      progress: 'A berry compote, Fine or better.',
      report: 'Ah. That is very nearly right. Very nearly is the best I have had in years.',
    },
  },
  {
    key: 'crabs_bait',
    row: 'r14',
    giver: 'npc.fisher',
    title: 'The crabs took my bait',
    ask: 'The reed crabs have cleaned out my bait buckets on the jetty. Put three of them down and I can fish again.',
    ways: [
      {
        id: 'defeat',
        label: 'Put the Reed Crabs down',
        steps: [{ kind: 'defeat', creature: 'creature.reed_crab', count: 3 }],
      },
    ],
    reward: { coin: 40, renown: 1 },
    estMinutes: 8,
    talk: {
      offer: 'Is something bothering the fish?',
      remind: 'About the crabs.',
      accepted: 'Get in close. They guard their patch and they do not chase.',
      progress: 'Three crabs off the jetty.',
      report: 'My bait is safe. Here is a little for your trouble.',
    },
  },
  {
    key: 'oil_quarry',
    row: 'r16',
    giver: 'npc.foreman',
    title: 'Lamp oil for the quarry',
    ask: 'The lamps along the quarry lip burn oil by the flask. Three flasks of lantern oil, and the night shift can see their own feet.',
    ways: [
      {
        id: 'oil',
        label: 'Bring lantern oil',
        steps: [deliver('item.lantern_oil', 3, 'npc.foreman')],
      },
    ],
    reward: { coin: 45, renown: 1 },
    estMinutes: 8,
    talk: {
      offer: 'Anything the quarry is short of?',
      remind: 'About the oil.',
      accepted: 'The apothecary makes it, or the tinker does. Either will do.',
      progress: 'Three flasks of lantern oil.',
      report: 'The night shift will thank you. I thank you now.',
    },
  },
  {
    key: 'moorhounds_dusk',
    row: 'r19',
    giver: 'npc.hermit',
    title: 'Moorhounds at dusk',
    ask: 'Moorhounds come down off the moor when the light goes, and they hunt in a pack. Put two of them down and the well will be quiet.',
    ways: [
      {
        id: 'defeat',
        label: 'Put the Moorhounds down',
        steps: [{ kind: 'defeat', creature: 'creature.moorhound', count: 2 }],
      },
    ],
    reward: { coin: 60, renown: 2 },
    estMinutes: 12,
    talk: {
      offer: 'Is anything troubling you up here?',
      remind: 'About the hounds.',
      accepted: 'Back to a wall, and do not run. They like it when you run.',
      progress: 'Two moorhounds. They are out at dusk and after.',
      report: 'Good. The moor sounds different when they are gone.',
    },
  },
  {
    key: 'rats_cellar',
    row: 'r2',
    giver: 'npc.cook',
    title: 'Rats in the cellar',
    ask: 'The grain rats have the inn cellar. The hatch is in the yard. Clear them out, and mind the barrels, they roll.',
    ways: [
      {
        id: 'defeat',
        label: 'Clear the Grain Rats from the cellar',
        steps: [{ kind: 'defeat', creature: 'creature.grain_rat', count: 6 }],
      },
    ],
    reward: { coin: 60, renown: 1 },
    estMinutes: 10,
    talk: {
      offer: 'Is that scratching in the cellar?',
      remind: 'About the rats.',
      accepted: 'Hatch in the yard, back corner. Six of them at the least. They come in threes.',
      progress: 'Six grain rats, in the cellar under the yard.',
      report: 'Quiet. You are a good guest. Take this.',
    },
  },
  {
    key: 'grist_sluice',
    row: 'r6',
    giver: 'npc.miller',
    title: 'Grist and sluice',
    ask: 'There is a wheel under the mill that used to set the water. I have not been down in years. Go to the wheel hall, see if the wheel still turns, and tell me.',
    ways: [
      {
        id: 'visit',
        label: 'Reach the wheel hall under the mill',
        steps: [
          {
            kind: 'reach',
            room: UNDERMILL_BUILT.roomId('u2'),
            from: UNDERMILL_BUILT.portal('u1', 'u2'),
            withinTicks: 3600,
          },
        ],
      },
    ],
    reward: { coin: 70, renown: 2 },
    estMinutes: 15,
    talk: {
      offer: 'Is anything wrong under the mill?',
      remind: 'About the wheel.',
      accepted:
        'The door is on the path south of the mill. Mind the crabs. Water gets in everywhere.',
      progress: 'The wheel hall. Go down and look, then come and tell me.',
      report: 'Still there, you say. Good. That is more than I hoped. Take this.',
    },
  },
  {
    key: 'net_nessa',
    row: 'r13',
    giver: 'npc.fisher',
    title: "Nessa's net",
    ask: 'My net went down the delta with the last flood. A length of wool cloth and some flax cord, knotted tight on a loom, and I will have a new one.',
    ways: [
      {
        id: 'net',
        label: 'Bring a fishing net',
        steps: [deliver('item.fishing_net', 1, 'npc.fisher')],
      },
    ],
    reward: { coin: 55, renown: 1 },
    estMinutes: 10,
    talk: {
      offer: 'Where is your net?',
      remind: 'About the net.',
      accepted: 'Wool cloth and flax cord, at a loom. Tailors do it before breakfast.',
      progress: 'A fishing net. Wool cloth, flax cord and a loom.',
      report: 'That will hold a river fish. Take this, you earned it.',
    },
  },
  {
    key: 'cart_wheels',
    row: 'r15',
    giver: 'npc.foreman',
    title: 'Cart wheels',
    ask: 'The quarry carts are down to their rims. Two wheels, planked and strapped with leather at a workbench, and the carts roll again.',
    ways: [
      {
        id: 'wheels',
        label: 'Bring two cart wheels',
        steps: [deliver('item.cart_wheel', 2, 'npc.foreman')],
      },
    ],
    reward: { coin: 65, renown: 1 },
    estMinutes: 10,
    talk: {
      offer: 'Those carts look lame.',
      remind: 'About the wheels.',
      accepted:
        'Oak planks, two to a wheel, and a strip of leather for the strap. Pell has a bench if you have none.',
      progress: 'Two cart wheels, made at a workbench.',
      report: 'Round and true. The crew will be glad. Here.',
    },
  },
  {
    key: 'readings_wren',
    row: 'r17',
    giver: 'npc.scholar',
    title: 'Readings for Wren',
    ask: 'The old hermit on the moor left notes on tablets down his well. I would copy them myself but I do not climb. Read three of the four and tell me what you find.',
    ways: [
      {
        id: 'read',
        label: 'Read three of the carvings in the well',
        steps: [
          {
            kind: 'read',
            fixtures: ['a', 'b', 'c', 'd'].map((k) => `fixture.m9_note_${k}`),
            count: 3,
          },
        ],
      },
    ],
    reward: { coin: 70, renown: 2 },
    estMinutes: 12,
    talk: {
      offer: 'What are you working on?',
      remind: 'About the carvings.',
      accepted:
        'Old Fen has a well on Cairnmoor, and the carvings are down it. Three of the four will do.',
      progress: 'Three of the four carvings, in the well on Cairnmoor.',
      report: 'Good. Plain handwriting, for a hermit. Take this.',
    },
  },
  {
    key: 'tower_clock',
    row: 'r18',
    giver: 'npc.reeve',
    title: 'The bell tower clock',
    ask: 'The clock in the bell tower has been wrong since spring. Someone with a bench and a steady hand could see what is the matter with it.',
    ways: [
      {
        id: 'tinker',
        label: 'Tinker with the tower clock',
        steps: [{ kind: 'flag', flag: 'request.clock' }],
      },
    ],
    reward: { coin: 70, renown: 2 },
    estMinutes: 12,
    talk: {
      offer: 'Is the clock wrong?',
      remind: 'About the clock.',
      accepted:
        'Stand at the foot of the tower and see to it. It wants someone who has handled gears.',
      progress: 'The tower clock. It needs someone who has handled gears.',
      report: 'It keeps time. Thank you. Here is something for the town.',
    },
  },
  {
    key: 'pilgrim_errand',
    row: 'r20',
    giver: 'npc.pilgrim',
    title: "The Pilgrim's errand",
    ask: 'I have a letter that should reach the chapel, but I will not be back before dark. Take it there after dark, and leave it on the steps.',
    ways: [
      {
        id: 'carry',
        label: 'Take the letter to the chapel after dark',
        steps: [
          {
            kind: 'carry',
            item: 'item.pilgrim_letter',
            place: 'wayside.chapel',
            phases: ['night'],
          },
        ],
      },
    ],
    give: [{ item: 'item.pilgrim_letter', qty: 1 }],
    reward: { coin: 45, renown: 1 },
    estMinutes: 8,
    talk: {
      offer: 'You look like you have somewhere to be.',
      remind: 'About the letter.',
      accepted: 'Here it is. The chapel is on the south road. Night, mind. It is for night.',
      progress: 'The letter goes to the chapel steps, after dark.',
      report: 'It arrived, I could tell. Take this, and my thanks.',
    },
  },
  {
    key: 'barrow_lights',
    row: 'r21',
    giver: 'npc.reeve',
    title: 'Barrow lights',
    ask: 'The shepherds talk about lights out on the downs, near the old barrow, after dark. I would like a plain account of them. Go and see.',
    ways: [
      {
        id: 'watch',
        label: "Watch the downs by the Shepherd's Barrow after dark",
        steps: [{ kind: 'flag', flag: 'request.barrow_lights' }],
      },
    ],
    reward: { coin: 90, renown: 2 },
    estMinutes: 12,
    talk: {
      offer: 'I hear there are lights on the downs.',
      remind: 'About the lights.',
      accepted: 'South west, on the downs. Go at night and keep your eyes open.',
      progress: "The Shepherd's Barrow, after dark. Watch for a while.",
      report: 'A plain account, as I asked for. That is worth something.',
    },
  },
  {
    key: 'stock_stalls',
    row: 'r22',
    giver: 'npc.shopkeeper',
    title: 'Stock for the stalls',
    ask: 'The market stalls are bare. Make things and sell them, anything you made yourself, ten of them. I will not be choosy.',
    ways: [
      {
        id: 'sell',
        label: 'Sell ten things you made',
        steps: [{ kind: 'sell', count: 10 }],
      },
    ],
    reward: { coin: 80, renown: 2 },
    estMinutes: 10,
    talk: {
      offer: 'Slow day?',
      remind: 'About the stalls.',
      accepted: 'Bread, planks, ingots, anything a recipe makes. Sell it to a shop, I will count.',
      progress: 'Ten things you made, sold to a shop.',
      report: 'The stalls look better already. Here, for the trouble.',
    },
  },
  {
    key: 'wasps_orchard',
    row: 'r12',
    giver: 'npc.farmer',
    title: 'Wasps in the orchard',
    ask: 'Thistle wasps have taken the hive on the hill. We cannot pick near it. Clear them, and the orchard is ours again.',
    ways: [
      {
        id: 'defeat',
        label: 'Clear the Thistle Wasps from Hive Hill',
        steps: [{ kind: 'defeat', creature: 'creature.thistle_wasp', count: 5 }],
      },
    ],
    reward: { coin: 55, renown: 1 },
    estMinutes: 10,
    talk: {
      offer: 'You look like you have been stung.',
      remind: 'About the wasps.',
      accepted: 'Hive Hill, out on the downs. Do not swing at the nest. They follow you.',
      progress: 'Five thistle wasps, on Hive Hill.',
      report: 'Peace at last. Here, for your trouble.',
    },
  },
];

/** The request defs the tables make. */
export function authoredDefs(): Record<string, RequestDef> {
  const out: Record<string, RequestDef> = {};
  for (const a of EVERY) {
    const id = `request.${a.key}`;
    out[id] = {
      id,
      giver: { npc: a.giver },
      kind: 'authored',
      region: RB.homeRegion,
      titleKey: `${id}.title`,
      askKey: `${id}.ask`,
      solutions: a.ways.map((w) => ({
        id: w.id,
        labelKey: `${id}.${w.id}`,
        steps: w.steps,
      })),
      reward: { coin: a.reward.coin, items: a.reward.items ?? [], renown: a.reward.renown },
      ...(a.thread?.after
        ? { requires: [{ request: `request.${a.thread.after}`, is: 'done' as const }] }
        : {}),
      ...(a.thread ? { thread: a.thread.id } : {}),
      ...(a.give ? { give: a.give } : {}),
      estMinutes: a.estMinutes,
    };
  }
  return out;
}

/** The strings the tables make: titles, asks, ways, and the giver's lines. */
export function authoredStrings(): Record<string, string> {
  const out: Record<string, string> = {
    'dlg.c_work': 'Is there any work for me?',
    'dlg.c_more': 'Anything else?',
    'dlg.rq.work': 'There is always something. Ask.',
  };
  for (const a of EVERY) {
    const id = `request.${a.key}`;
    out[`${id}.title`] = a.title;
    out[`${id}.ask`] = a.ask;
    for (const w of a.ways) out[`${id}.${w.id}`] = w.label;
    out[`dlg.rq.c_${a.key}`] = a.talk.offer;
    out[`dlg.rq.c_${a.key}_remind`] = a.talk.remind;
    out[`dlg.rq.${a.key}_accepted`] = a.talk.accepted;
    out[`dlg.rq.${a.key}_progress`] = a.talk.progress;
    out[`dlg.rq.${a.key}_report`] = a.talk.report;
  }
  return out;
}

/** Every authored request the builders and the dialogue read: the single ones, then Thread stages. */
export const EVERY: readonly AuthoredRequest[] = [...AUTHORED, ...THREAD_STAGES];
