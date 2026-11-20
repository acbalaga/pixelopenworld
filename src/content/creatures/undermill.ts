import { coin, drop, make } from './dawnmeadow';
import type { CreatureDef } from './types';

/**
 * The Undermill's own creature (POW-M4-11, regions/01 section 8): the Millrace Eel, who strikes
 * from the flooded channel under the mill. It is a boss; its fight is in `bosses/undermill`.
 */
export const UNDERMILL_CREATURES: Readonly<Record<string, CreatureDef>> = {
  'creature.millrace_eel': make({
    id: 'creature.millrace_eel',
    name: 'Millrace Eel',
    temperament: 'territorial',
    territory: { radius: 120, warnTicks: 45 },
    archetype: 'chaser',
    hp: 1500,
    defense: 10,
    power: 15,
    speed: 170,
    notice: 140,
    lose: 230,
    leash: 260,
    wander: false,
    staggerMax: 150,
    bodyW: 24,
    bodyH: 10,
    attacks: [
      { attack: 'attack.eel_snap', range: 36, cooldown: 40 },
      { attack: 'attack.eel_lash', range: 80, cooldown: 90 },
    ],
    drops: [drop('item.fish_river', 100, 2, 3), drop('item.clay', 100, 2, 3), coin(100, 25, 40)],
    voice: 'squelch',
  }),
};
