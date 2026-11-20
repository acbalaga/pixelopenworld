import { REQUEST_BALANCE as RB } from '../balance/requests';
import { authoredDefs } from './dawnmeadow';
import type { RequestDef } from './types';

export type * from './types';

const R = RB.homeRegion;

/**
 * The authored requests of the slice (M3-11). Each has a giver, the asker's own words, and one or
 * more ways to finish it. A request is finished by any one solution.
 */
const M3_REQUESTS: Readonly<Record<string, RequestDef>> = {
  'request.clear_pests': {
    id: 'request.clear_pests',
    giver: { npc: 'npc.guard' },
    kind: 'authored',
    region: R,
    titleKey: 'request.clear_pests.title',
    askKey: 'request.clear_pests.ask',
    solutions: [
      {
        id: 'defeat',
        labelKey: 'request.clear_pests.defeat',
        steps: [{ kind: 'defeat', creature: 'creature.mossling', count: 4 }],
      },
    ],
    reward: { coin: 50, items: [{ item: 'item.ring_copper', qty: 1 }], renown: 2 },
    estMinutes: 4,
  },
  'request.ember_pods': {
    id: 'request.ember_pods',
    giver: { npc: 'npc.scholar' },
    kind: 'authored',
    region: R,
    titleKey: 'request.ember_pods.title',
    askKey: 'request.ember_pods.ask',
    solutions: [
      {
        id: 'defeat',
        labelKey: 'request.ember_pods.defeat',
        steps: [{ kind: 'defeat', creature: 'creature.spitbloom', count: 2 }],
      },
    ],
    reward: { coin: 30, items: [], techniques: ['technique.ember_bolt'], renown: 2 },
    estMinutes: 5,
  },
  'request.old_lamps': {
    id: 'request.old_lamps',
    giver: { npc: 'npc.scholar' },
    kind: 'authored',
    region: R,
    titleKey: 'request.old_lamps.title',
    askKey: 'request.old_lamps.ask',
    solutions: [
      {
        id: 'bring',
        labelKey: 'request.old_lamps.bring',
        steps: [{ kind: 'deliver', item: 'item.lantern_oil', qty: 2, to: 'npc.scholar' }],
      },
    ],
    reward: { coin: 25, items: [], renown: 1 },
    estMinutes: 3,
  },
  'request.cave_boar': {
    id: 'request.cave_boar',
    giver: { npc: 'npc.guard' },
    kind: 'authored',
    region: R,
    titleKey: 'request.cave_boar.title',
    askKey: 'request.cave_boar.ask',
    solutions: [
      {
        id: 'defeat',
        labelKey: 'request.cave_boar.defeat',
        steps: [{ kind: 'defeat', creature: 'creature.bramble_boar', count: 1 }],
      },
      {
        id: 'hide',
        labelKey: 'request.cave_boar.hide',
        steps: [{ kind: 'flag', flag: 'flag.satchel_taken' }],
      },
    ],
    reward: { coin: 60, items: [], renown: 2 },
    estMinutes: 8,
  },
  'request.watch_supper': {
    id: 'request.watch_supper',
    giver: { npc: 'npc.cook' },
    kind: 'authored',
    region: R,
    titleKey: 'request.watch_supper.title',
    askKey: 'request.watch_supper.ask',
    solutions: [
      {
        id: 'stew',
        labelKey: 'request.watch_supper.stew',
        steps: [{ kind: 'deliver', item: 'item.hearty_stew', qty: 3, to: 'npc.cook' }],
      },
      {
        id: 'skewers',
        labelKey: 'request.watch_supper.skewers',
        steps: [{ kind: 'deliver', item: 'item.herbed_skewer', qty: 5, to: 'npc.cook' }],
      },
    ],
    reward: { coin: 70, items: [], renown: 2 },
    estMinutes: 10,
  },
  'request.anvil_metal': {
    id: 'request.anvil_metal',
    giver: { npc: 'npc.shopkeeper' },
    kind: 'authored',
    region: R,
    titleKey: 'request.anvil_metal.title',
    askKey: 'request.anvil_metal.ask',
    solutions: [
      {
        id: 'ore',
        labelKey: 'request.anvil_metal.ore',
        steps: [{ kind: 'deliver', item: 'item.copper_ore', qty: 6, to: 'npc.shopkeeper' }],
      },
      {
        id: 'ingots',
        labelKey: 'request.anvil_metal.ingots',
        steps: [{ kind: 'deliver', item: 'item.copper_ingot', qty: 2, to: 'npc.shopkeeper' }],
      },
    ],
    reward: { coin: 45, items: [], renown: 2 },
    estMinutes: 8,
  },
  'request.deep_room': {
    id: 'request.deep_room',
    giver: { npc: 'npc.pilgrim' },
    kind: 'authored',
    region: R,
    titleKey: 'request.deep_room.title',
    askKey: 'request.deep_room.ask',
    solutions: [
      {
        id: 'defeat',
        labelKey: 'request.deep_room.defeat',
        steps: [{ kind: 'defeat', creature: 'creature.spitbloom', count: 3 }],
      },
      {
        id: 'sing',
        labelKey: 'request.deep_room.sing',
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
    reward: { coin: 55, items: [], renown: 2 },
    estMinutes: 8,
  },
};

/** Every authored request: the first map's (M3-11) and Dawnmeadow's table (M4-12). */
export const REQUESTS: Readonly<Record<string, RequestDef>> = { ...M3_REQUESTS, ...authoredDefs() };

/** The most coin the authored requests pay, each once. */
export const AUTHORED_COIN_TOTAL = Object.values(REQUESTS).reduce((n, r) => n + r.reward.coin, 0);
