import { UNDERMILL_BUILT } from '../world/dungeons/undermill';
import type { RequestObjective } from './types';
import type { AuthoredRequest } from './dawnmeadow';

/** Reach the Undermill's wheel hall from the entry (no race: the time allowed is generous). */
const WHEEL_HALL: RequestObjective = {
  kind: 'reach',
  room: UNDERMILL_BUILT.roomId('u2'),
  from: UNDERMILL_BUILT.portal('u1', 'u2'),
  withinTicks: 3600,
};

/**
 * Dawnmeadow's Threads (POW-M4-12, regions/01-dawnmeadow section 10): longer jobs of about 45
 * minutes, told in stages. A stage is an authored request whose `requires` is the stage before
 * it, so it is offered only once that one is done; the last stage pays the Thread's reward. The
 * ledger counts the Thread, not its stages.
 *
 * Four of the five are here. Wren's Missing Pages (t4) needs the region's points of interest and
 * page items, which M4-11 builds. Parts of the others that lean on unbuilt places are told with
 * what exists (see the PR). Voice: plain, a little dry, no lore. No em dashes. Titles are at most
 * 24 characters.
 */
export interface ThreadDef {
  id: string;
  title: string;
  /** What the Thread is about, one line, for the log. */
  blurb: string;
  giver: string;
  /** The stage keys, in order. */
  stages: readonly string[];
  /** Minutes the whole Thread takes, for the pacing ledger. */
  estMinutes: number;
}

const deliver = (item: string, qty: number, to: string): RequestObjective => ({
  kind: 'deliver',
  item,
  qty,
  to,
});

type Stage = Omit<AuthoredRequest, 'thread'>;
const stages = (thread: string, list: Stage[]): AuthoredRequest[] =>
  list.map((s, i) => ({
    ...s,
    thread: { id: thread, ...(i > 0 ? { after: list[i - 1]!.key } : {}) },
  }));

export const THREADS: readonly ThreadDef[] = [
  {
    id: 'thread.mill',
    title: 'The Mill Turns Again',
    blurb: 'Aldo wants the mill at Millbrook working again: gears, sails and a sluice.',
    giver: 'npc.miller',
    stages: ['mill_gears', 'mill_sails', 'mill_sluice', 'mill_flour'],
    estMinutes: 45,
  },
  {
    id: 'thread.watch',
    title: 'Hearthford Watch',
    blurb: 'Orla wants three nights of watch kept at the walls.',
    giver: 'npc.guard',
    stages: ['watch_1', 'watch_2', 'watch_3'],
    estMinutes: 45,
  },
  {
    id: 'thread.quarry',
    title: 'The Quarry Strike',
    blurb: 'Garrick cannot get the crew to go down, and wants to know why.',
    giver: 'npc.foreman',
    stages: ['strike_meal', 'strike_shoring', 'strike_below'],
    estMinutes: 45,
  },
  {
    id: 'thread.ledger',
    title: "The Reeve's Ledger",
    blurb: 'Edda wants a trade with Reedmouth written into the town ledger.',
    giver: 'npc.reeve',
    stages: ['ledger_prices', 'ledger_goods', 'ledger_return', 'ledger_settled'],
    estMinutes: 45,
  },
];

export const THREAD_STAGES: readonly AuthoredRequest[] = [
  ...stages('thread.mill', [
    {
      key: 'mill_gears',
      row: 't1',
      giver: 'npc.miller',
      title: 'Mill: new gears',
      ask: 'The mill has stood still since the gears wore down to nubs. I can hang new ones if someone brings the iron. Four ingots, and I will do the rest.',
      ways: [
        {
          id: 'iron',
          label: 'Bring iron ingots',
          steps: [deliver('item.iron_ingot', 4, 'npc.miller')],
        },
      ],
      reward: { coin: 40, renown: 1 },
      estMinutes: 12,
      talk: {
        offer: 'What is wrong with the mill?',
        remind: 'About the gears.',
        accepted: 'Tobin at the smithy will smelt it for you, or you can do it yourself.',
        progress: 'Four iron ingots. The gears will not cut themselves.',
        report: 'Good iron. I will start on the wheel tonight.',
      },
    },
    {
      key: 'mill_sails',
      row: 't1',
      giver: 'npc.miller',
      title: 'Mill: new sails',
      ask: 'The sails are rags. Six lengths of linen cloth, or wool if you must, and the wind will have something to push again.',
      ways: [
        {
          id: 'linen',
          label: 'Bring linen cloth',
          steps: [deliver('item.linen_cloth', 6, 'npc.miller')],
        },
        {
          id: 'wool',
          label: 'Bring wool cloth',
          steps: [deliver('item.wool_cloth', 6, 'npc.miller')],
        },
      ],
      reward: { coin: 45, renown: 1 },
      estMinutes: 12,
      talk: {
        offer: 'What about the sails?',
        remind: 'About the sails.',
        accepted: 'Mara at the tailor will sell you cloth, if you would rather not weave it.',
        progress: 'Six lengths of cloth, linen or wool.',
        report: 'They will catch the wind now. Here, for the cloth.',
      },
    },
    {
      key: 'mill_sluice',
      row: 't1',
      giver: 'npc.miller',
      title: 'Mill: the sluice',
      ask: 'The sluice boards have rotted through. Go down to the wheel hall under the mill and see what is left of them, then bring eight oak planks, or ash, cut true, and the water will turn the wheel the way it used to.',
      ways: [
        {
          id: 'oak',
          label: 'Bring oak planks',
          steps: [WHEEL_HALL, deliver('item.oak_plank', 8, 'npc.miller')],
        },
        {
          id: 'ash',
          label: 'Bring ash planks',
          steps: [WHEEL_HALL, deliver('item.ash_plank', 8, 'npc.miller')],
        },
      ],
      reward: { coin: 50, renown: 1 },
      estMinutes: 12,
      talk: {
        offer: 'And the water?',
        remind: 'About the sluice.',
        accepted: 'Pell the carpenter has planks, or you can saw your own.',
        progress: 'Eight planks, oak or ash.',
        report: 'Solid. Listen, you can hear the water already.',
      },
    },
    {
      key: 'mill_flour',
      row: 't1',
      giver: 'npc.miller',
      title: 'Mill: flour for Brin',
      ask: 'She turns! Take word to Brin in Hearthford that Millbrook flour is coming. He will want to hear it from someone who saw the wheel go round.',
      ways: [
        {
          id: 'word',
          label: 'Tell Brin the mill turns',
          steps: [{ kind: 'talk', npc: 'npc.shopkeeper' }],
        },
      ],
      reward: { coin: 120, renown: 3, items: [{ item: 'item.bakers_peel', qty: 1 }] },
      estMinutes: 9,
      talk: {
        offer: 'Is the mill turning?',
        remind: 'About the word for Brin.',
        accepted: 'Market street, the shop with the red roof. Tell him the wheel goes round.',
        progress: 'Brin has to hear it from you.',
        report: "He said he would clear a shelf. Take this, with the mill's thanks.",
      },
    },
  ]),
  ...stages('thread.watch', [
    {
      key: 'watch_1',
      row: 't2',
      giver: 'npc.guard',
      title: 'Watch: first night',
      ask: 'The gates are shut at dark, but things come to the walls. Stand watch tonight: put down two creatures that come near the town after the light goes.',
      ways: [
        {
          id: 'watch',
          label: 'Put two creatures down after dark',
          steps: [{ kind: 'defeat', count: 2, phases: ['dusk', 'night'] }],
        },
      ],
      reward: { coin: 40, renown: 1 },
      estMinutes: 15,
      talk: {
        offer: 'Does the watch need another pair of hands?',
        remind: 'About the first watch.',
        accepted: 'Stay near the walls and keep your back to the stones.',
        progress: 'Two creatures, after the light goes.',
        report: 'A quiet gate is a watched gate. Well done.',
      },
    },
    {
      key: 'watch_2',
      row: 't2',
      giver: 'npc.guard',
      title: 'Watch: second night',
      ask: 'Again. The walls are only as good as the people who stand by them. Two more, after dark.',
      ways: [
        {
          id: 'watch',
          label: 'Put two creatures down after dark',
          steps: [{ kind: 'defeat', count: 2, phases: ['dusk', 'night'] }],
        },
      ],
      reward: { coin: 50, renown: 1 },
      estMinutes: 15,
      talk: {
        offer: 'I can stand another watch.',
        remind: 'About the second watch.',
        accepted: 'Different quarter tonight, if you can. They learn your habits.',
        progress: 'Two more after dark.',
        report: 'Two nights. The captain asked who you were.',
      },
    },
    {
      key: 'watch_3',
      row: 't2',
      giver: 'npc.guard',
      title: 'Watch: third night',
      ask: 'Once more, and you will have done a watch. Two more after dark, and the rack in the yard is yours to use.',
      ways: [
        {
          id: 'watch',
          label: 'Put two creatures down after dark',
          steps: [{ kind: 'defeat', count: 2, phases: ['dusk', 'night'] }],
        },
      ],
      reward: {
        coin: 100,
        renown: 3,
        items: [
          { item: 'item.shield_buckler', qty: 1 },
          { item: 'item.whetstone', qty: 3 },
        ],
      },
      estMinutes: 15,
      talk: {
        offer: 'One more night?',
        remind: 'About the third watch.',
        accepted: 'This is the one that counts. The dark is longer than it looks.',
        progress: 'Two more after dark, and then the rack.',
        report: 'That is a watch. Take what you need from the rack, and this for the road.',
      },
    },
  ]),
  ...stages('thread.quarry', [
    {
      key: 'strike_meal',
      row: 't3',
      giver: 'npc.foreman',
      title: 'Strike: a hot meal',
      ask: 'The crew will not go down. They say they will not work hungry for a foreman who will not listen. Three hearty stews, and they might hear me out.',
      ways: [
        {
          id: 'stew',
          label: 'Bring hearty stew',
          steps: [deliver('item.hearty_stew', 3, 'npc.foreman')],
        },
      ],
      reward: { coin: 45, renown: 1 },
      estMinutes: 15,
      talk: {
        offer: 'Why is the quarry quiet?',
        remind: 'About the stew.',
        accepted: 'The inn does a good stew, or make your own. They can tell the difference.',
        progress: 'Three hearty stews, hot if you can manage it.',
        report: 'They are eating, and talking. That is something.',
      },
    },
    {
      key: 'strike_shoring',
      row: 't3',
      giver: 'npc.foreman',
      title: 'Strike: shoring up',
      ask: 'They say the shaft props are rotten, and they are right. Six oak planks, or ash, and the crew will have something to point at and say fixed.',
      ways: [
        {
          id: 'oak',
          label: 'Bring oak planks',
          steps: [deliver('item.oak_plank', 6, 'npc.foreman')],
        },
        {
          id: 'ash',
          label: 'Bring ash planks',
          steps: [deliver('item.ash_plank', 6, 'npc.foreman')],
        },
      ],
      reward: { coin: 50, renown: 1 },
      estMinutes: 15,
      talk: {
        offer: 'What do the crew want?',
        remind: 'About the props.',
        accepted: 'Plain planks will do. They are not fussy about the grain.',
        progress: 'Six planks, oak or ash.',
        report: 'Better. They will not say so, but they are less angry.',
      },
    },
    {
      key: 'strike_below',
      row: 't3',
      giver: 'npc.foreman',
      title: 'Strike: what is below',
      ask: 'Something has been dropping rubble down there on purpose, and the crew will not go until it stops. Put down four rubblets, or light the way so they can see it for themselves: six flasks of lantern oil.',
      ways: [
        {
          id: 'defeat',
          label: 'Put the Rubblets down',
          steps: [{ kind: 'defeat', creature: 'creature.rubblet', count: 4 }],
        },
        {
          id: 'oil',
          label: 'Bring lantern oil',
          steps: [deliver('item.lantern_oil', 6, 'npc.foreman')],
        },
      ],
      reward: { coin: 110, renown: 3 },
      estMinutes: 15,
      talk: {
        offer: 'Is the crew ready to go down?',
        remind: 'About what is below.',
        accepted: 'Rubblets nest in the rubble. Hit them while they are still stones.',
        progress: 'Four rubblets, or six flasks of oil. Either way the crew needs to see.',
        report: 'They are going down. First time in a week. Here, you earned it.',
      },
    },
  ]),
  ...stages('thread.ledger', [
    {
      key: 'ledger_prices',
      row: 't5',
      giver: 'npc.reeve',
      title: 'Ledger: the prices',
      ask: 'I keep the town ledger, and it has no column for Reedmouth. Ask Brin what he would pay for what they catch there, and bring me his figure.',
      ways: [
        {
          id: 'ask',
          label: 'Ask Brin his price',
          steps: [{ kind: 'talk', npc: 'npc.shopkeeper' }],
        },
      ],
      reward: { coin: 30, renown: 1 },
      estMinutes: 8,
      talk: {
        offer: 'Is there something the ledger needs?',
        remind: 'About the ledger.',
        accepted: 'He will pretend not to know. Ask twice.',
        progress: 'Brin has the figure. Ask him.',
        report: 'That is lower than I hoped and higher than he wanted. Good.',
      },
    },
    {
      key: 'ledger_goods',
      row: 't5',
      giver: 'npc.reeve',
      title: 'Ledger: to Reedmouth',
      ask: 'Now the other half. Take three lengths of wool cloth to Nessa at Reedmouth, as a sample of what Hearthford offers, and see what she thinks of it.',
      ways: [
        {
          id: 'cloth',
          label: 'Bring wool cloth to Nessa',
          steps: [deliver('item.wool_cloth', 3, 'npc.fisher')],
        },
      ],
      reward: { coin: 40, renown: 1 },
      estMinutes: 12,
      talk: {
        offer: 'What next for the route?',
        remind: 'About the sample.',
        accepted:
          'East over the bridge, then the cart track down the river. It is longer than it looks.',
        progress: 'Three lengths of wool cloth, to Nessa at Reedmouth.',
        report: 'She liked it. She said so in so many words, which is rare for Reedmouth.',
      },
    },
    {
      key: 'ledger_return',
      row: 't5',
      giver: 'npc.reeve',
      title: 'Ledger: the return',
      ask: 'Nessa says baked fish keeps well on the road. Bring three back, and the entry is half written.',
      ways: [
        {
          id: 'fish',
          label: 'Bring baked fish',
          steps: [deliver('item.fish_baked', 3, 'npc.reeve')],
        },
      ],
      reward: { coin: 50, renown: 1 },
      estMinutes: 15,
      talk: {
        offer: 'Did Nessa have an answer?',
        remind: 'About the baked fish.',
        accepted: 'The inn will bake them, or do it yourself. Salt helps.',
        progress: 'Three baked fish.',
        report: 'They keep. Even I could tell.',
      },
    },
    {
      key: 'ledger_settled',
      row: 't5',
      giver: 'npc.reeve',
      title: 'Ledger: settled',
      ask: 'Show Brin the baked fish and the figure and let him do the sum. When he has agreed, the route is a route.',
      ways: [
        {
          id: 'agree',
          label: 'Settle it with Brin',
          steps: [{ kind: 'talk', npc: 'npc.shopkeeper' }],
        },
      ],
      reward: { coin: 110, renown: 3 },
      estMinutes: 10,
      talk: {
        offer: 'Is the route settled?',
        remind: 'About the sum.',
        accepted: 'Let him count it himself. He trusts his own fingers.',
        progress: 'Brin has to agree to the sum.',
        report: 'Written in. Hearthford and Reedmouth, a line in the ledger at last. Take this.',
      },
    },
  ]),
];
