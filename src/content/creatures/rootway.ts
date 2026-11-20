import { coin, drop, make } from './dawnmeadow';
import type { CreatureDef } from './types';

/**
 * The Rootway's own creatures (POW-M4-21, regions/01 section 8): the Root Grub that comes up out
 * of the floor of the snare chamber, the Glowcap that shoots from the dark gallery, and the
 * boarlets Old Bramblehide calls in its second phase. They stand in no open zone.
 */
const LIST: CreatureDef[] = [
  make({
    id: 'creature.root_grub',
    name: 'Root Grub',
    temperament: 'hostile',
    archetype: 'burrower',
    hp: 70,
    defense: 2,
    power: 7,
    speed: 170,
    notice: 90,
    lose: 150,
    leash: 160,
    staggerMax: 25,
    bodyW: 10,
    bodyH: 6,
    attacks: [{ attack: 'attack.grub_bite', range: 22, cooldown: 36 }],
    drops: [drop('item.clay', 30), coin(30, 1, 2)],
    voice: 'squelch',
  }),
  make({
    id: 'creature.glowcap',
    name: 'Glowcap',
    temperament: 'territorial',
    territory: { radius: 110, warnTicks: 36 },
    archetype: 'shooter',
    hp: 95,
    defense: 2,
    power: 8,
    speed: 0,
    notice: 150,
    lose: 170,
    leash: 160,
    wander: false,
    staggerMax: 30,
    bodyW: 12,
    bodyH: 8,
    keepRange: { min: 0, max: 130 },
    attacks: [{ attack: 'attack.glowcap_spore', range: 130, cooldown: 60 }],
    drops: [drop('item.moss_tuft', 60, 1, 2), coin(40, 1, 3)],
    voice: 'squelch',
  }),
  make({
    id: 'creature.boarlet',
    name: 'Boarlet',
    temperament: 'hostile',
    archetype: 'chaser',
    hp: 55,
    defense: 2,
    power: 7,
    speed: 230,
    notice: 120,
    lose: 200,
    leash: 220,
    staggerMax: 20,
    bodyW: 12,
    bodyH: 8,
    attacks: [{ attack: 'attack.boarlet_nip', range: 20, cooldown: 36 }],
    drops: [coin(20, 1, 2)],
    voice: 'squelch',
  }),
];

export const ROOTWAY_CREATURES: Readonly<Record<string, CreatureDef>> = Object.fromEntries(
  LIST.map((c) => [c.id, c]),
);
