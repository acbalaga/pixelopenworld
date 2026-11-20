import { coin, drop, make } from './dawnmeadow';
import type { CreatureDef } from './types';

/** The Deeps' own creature (POW-M4-11): the Foreman's Engine, a clockwork digger. Its fight is in `bosses/deeps`. */
export const DEEPS_CREATURES: Readonly<Record<string, CreatureDef>> = {
  'creature.foremans_engine': make({
    id: 'creature.foremans_engine',
    name: "Foreman's Engine",
    temperament: 'territorial',
    territory: { radius: 120, warnTicks: 45 },
    archetype: 'charger',
    hp: 1700,
    defense: 14,
    power: 15,
    speed: 180,
    notice: 140,
    lose: 230,
    leash: 260,
    wander: false,
    staggerMax: 170,
    bodyW: 26,
    bodyH: 16,
    attacks: [
      { attack: 'attack.engine_ram', range: 120, cooldown: 100 },
      { attack: 'attack.engine_steam', range: 46, cooldown: 100 },
    ],
    drops: [drop('item.iron_ingot', 100, 2, 3), drop('item.coal', 100, 2, 3), coin(100, 30, 45)],
    voice: 'squelch',
  }),
};
