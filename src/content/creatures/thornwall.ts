import { coin, drop, make } from './dawnmeadow';
import type { CreatureDef } from './types';

/** Thornwall Pass's own creature (POW-M4-11): the Hedge Warden, a briar and stone guardian. Its fight is in `bosses/thornwall`. */
export const THORNWALL_CREATURES: Readonly<Record<string, CreatureDef>> = {
  'creature.hedge_warden': make({
    id: 'creature.hedge_warden',
    name: 'Hedge Warden',
    temperament: 'territorial',
    territory: { radius: 130, warnTicks: 60 },
    archetype: 'chaser',
    hp: 2000,
    defense: 14,
    power: 16,
    speed: 60,
    notice: 160,
    lose: 240,
    leash: 280,
    wander: false,
    staggerMax: 200,
    bodyW: 26,
    bodyH: 16,
    attacks: [
      { attack: 'attack.warden_lash', range: 90, cooldown: 90 },
      { attack: 'attack.warden_thorns', range: 48, cooldown: 100 },
    ],
    drops: [
      drop('item.moss_tuft', 100, 2, 3),
      drop('item.ash_plank', 100, 2, 3),
      coin(100, 40, 60),
    ],
    voice: 'rustle',
  }),
};
