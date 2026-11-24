import type { Rumor } from './types';

/**
 * Hints and rumors Travelers repeat when asked (design/12 4.6). About one in four is wrong or half
 * right. A wrong one is plausible and harmless: a wrong time of day, a wrong ingredient, never a
 * trap that costs the player an item. None touches the hidden layer.
 */
export const RUMORS: readonly Rumor[] = [
  {
    id: 'rumor.boar_stand',
    about: 'creature',
    text: 'a Bramble Boar shows a warning pose and a line on the ground first. step back and it lets it go',
    true: true,
  },
  {
    id: 'rumor.mossling_day',
    about: 'creature',
    text: 'mosslings are curious in daylight. they come to look. at night they guard their ground',
    true: true,
  },
  {
    id: 'rumor.mossling_always',
    about: 'creature',
    text: 'mosslings never fight back before noon, so go early',
    true: false,
  },
  {
    id: 'rumor.bread_brin',
    about: 'tip',
    text: 'Brin restocks at dawn, so the bread is freshest first thing',
    true: true,
  },
  {
    id: 'rumor.bread_noon',
    about: 'tip',
    text: 'Brin restocks at noon, so wait until lunch for the good stock',
    true: false,
  },
  {
    id: 'rumor.waystone_first',
    about: 'tip',
    text: 'touch a Waystone before you wander off. it is where you wake if you fall',
    true: true,
  },
  {
    id: 'rumor.inn_bed',
    about: 'tip',
    text: 'sleep in the inn bed and you wake there instead of at the last Waystone',
    true: true,
  },
  {
    id: 'rumor.rootway_gear',
    about: 'place',
    text: 'do not go into the Rootway bare. a tier 1 weapon, armor and a few dishes at least',
    true: true,
  },
  {
    id: 'rumor.rootway_sneak',
    about: 'place',
    text: 'there is a quiet way through the Rootway if you can sneak past the boar and climb',
    true: true,
  },
  {
    id: 'rumor.rootway_shortcut',
    about: 'place',
    text: 'the Rootway shortcut opens from either side, so you can skip the boss room',
    true: false,
  },
  {
    id: 'rumor.tea_herbs',
    about: 'recipe',
    text: 'herb tea is sunwort and dewmint together. nothing fancy',
    true: true,
  },
  {
    id: 'rumor.tea_berries',
    about: 'recipe',
    text: 'herb tea wants two red berries and a sunwort, i am pretty sure',
    true: false,
  },
  {
    id: 'rumor.ingot_coal',
    about: 'recipe',
    text: 'a copper ingot takes two ore and a lump of coal at the anvil',
    true: true,
  },
  {
    id: 'rumor.manual_shed',
    about: 'tip',
    text: 'the burnt-out shed and the guardhouse each have a manual if you look around',
    true: true,
  },
  {
    id: 'rumor.fish_dawn',
    about: 'tip',
    text: 'the fish bite best at dawn and dusk on the Reedmouth jetty',
    true: true,
  },
  {
    id: 'rumor.board_daily',
    about: 'tip',
    text: 'the request board posts new jobs every day, so check it each morning',
    true: true,
  },
];
