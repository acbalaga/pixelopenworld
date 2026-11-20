import type { DayPhase, Weather } from '../balance/time';
import { PLACES } from './places';

export { PLACES } from './places';
export type { PlaceDef } from './places';

/**
 * The people of Dawnmeadow (POW-M4-12, regions/01-dawnmeadow section 9): where each lives and
 * works, where they are at each hour and in bad weather, and what they like. Friendship itself
 * arrives in M6; this is the data it will read. The NPCs' looks and speech are in
 * `content/dialogue`.
 */

/** One entry of a schedule: during these phases (and, if named, in this weather), be here. */
export interface ScheduleSlot {
  phases: readonly DayPhase[];
  /** Absent: any weather. A slot with weather is listed before the plain one it overrides. */
  weather?: readonly Weather[];
  /** A place id from `PLACES`. */
  place: string;
}

export interface PersonDef {
  /** The NPC id, as in `content/dialogue` (`NPCS`). */
  npc: string;
  role: string;
  home: string;
  work: string;
  /** First slot that matches the phase and weather wins. Every phase is covered in every weather. */
  schedule: readonly ScheduleSlot[];
  /** Item ids this person is glad to be given. Up to three. */
  likes: readonly string[];
}

/** Weather that keeps people who work outdoors under a roof. */
export const FOUL: readonly Weather[] = ['rain', 'storm', 'snow', 'fog'];

const ALL: readonly DayPhase[] = ['dawn', 'day', 'dusk', 'night'];

/** Works at `work` through dawn and day, goes home at dusk and stays there. Indoors in foul weather. */
function dayWorker(
  work: string,
  home: string,
  o: { foul?: string; dusk?: string } = {},
): ScheduleSlot[] {
  return [
    ...(o.foul ? [{ phases: ['dawn', 'day'] as const, weather: FOUL, place: o.foul }] : []),
    { phases: ['dawn', 'day'], place: work },
    // An evening out of doors is called off in foul weather.
    ...(o.dusk && !PLACES[o.dusk]?.indoors
      ? [{ phases: ['dusk'] as const, weather: FOUL, place: home }]
      : []),
    { phases: ['dusk'], place: o.dusk ?? home },
    { phases: ['night'], place: home },
  ];
}

const list: PersonDef[] = [
  {
    npc: 'npc.shopkeeper',
    role: 'Shopkeeper',
    home: 'hearthford.brin_shop',
    work: 'hearthford.brin_shop',
    schedule: [{ phases: ALL, place: 'hearthford.brin_shop' }],
    likes: ['item.dish_bread', 'item.ring_silver', 'item.honey_cake'],
  },
  {
    npc: 'npc.smith',
    role: 'Smith',
    home: 'hearthford.smithy',
    work: 'hearthford.smithy',
    schedule: dayWorker('hearthford.smithy', 'hearthford.smithy', { dusk: 'hearthford.inn' }),
    likes: ['item.coal', 'item.iron_ingot', 'item.spiced_cider'],
  },
  {
    npc: 'npc.outfitter',
    role: 'Outfitter and tailor',
    home: 'hearthford.tailor',
    work: 'hearthford.tailor',
    schedule: dayWorker('hearthford.tailor', 'hearthford.tailor'),
    likes: ['item.silk_cloth', 'item.thread_spool', 'item.herb_tea'],
  },
  {
    npc: 'npc.herbalist',
    role: 'Herbalist and apothecary',
    home: 'hearthford.apothecary',
    work: 'hearthford.apothecary',
    schedule: dayWorker('hearthford.apothecary', 'hearthford.apothecary'),
    likes: ['item.dewmint', 'item.sunwort', 'item.dew_vial'],
  },
  {
    npc: 'npc.cook',
    role: 'Innkeeper and cook',
    home: 'hearthford.inn',
    work: 'hearthford.inn',
    schedule: [{ phases: ALL, place: 'hearthford.inn' }],
    likes: ['item.salt', 'item.berry_red', 'item.mushroom_soup'],
  },
  {
    npc: 'npc.guard',
    role: 'Gate guard',
    home: 'hearthford.guard_yard',
    work: 'hearthford.guard_yard',
    schedule: [{ phases: ALL, place: 'hearthford.guard_yard' }],
    likes: ['item.whetstone', 'item.roast_meat', 'item.trail_biscuit'],
  },
  {
    npc: 'npc.scholar',
    role: 'Scholar',
    home: 'hearthford.rune_house',
    work: 'hearthford.rune_house',
    schedule: [{ phases: ALL, place: 'hearthford.rune_house' }],
    likes: ['item.rune_dust', 'item.quartz', 'item.worn_map'],
  },
  {
    // The Pilgrim keeps to the square by day and the wayside chapel at night.
    npc: 'npc.pilgrim',
    role: 'Wanderer',
    home: 'wayside.chapel',
    work: 'hearthford.square',
    schedule: [
      { phases: ['dawn', 'day', 'dusk'], weather: FOUL, place: 'hearthford.inn' },
      { phases: ['dawn', 'day', 'dusk'], place: 'hearthford.square' },
      { phases: ['night'], place: 'wayside.chapel' },
    ],
    likes: ['item.flute_reed', 'item.herb_tea', 'item.chalk_stub'],
  },
  {
    npc: 'npc.carpenter',
    role: 'Carpenter',
    home: 'hearthford.carpentry',
    work: 'hearthford.carpentry',
    schedule: dayWorker('hearthford.carpentry', 'hearthford.carpentry', {
      dusk: 'hearthford.inn',
    }),
    likes: ['item.oak_plank', 'item.ash_log', 'item.axe_iron'],
  },
  {
    npc: 'npc.tinker',
    role: 'Tinker',
    home: 'hearthford.tinker_shed',
    work: 'hearthford.tinker_shed',
    schedule: dayWorker('hearthford.tinker_shed', 'hearthford.tinker_shed', {
      dusk: 'hearthford.square',
    }),
    likes: ['item.spark_flint', 'item.scrap', 'item.lantern_oil'],
  },
  {
    npc: 'npc.miller',
    role: 'Miller',
    home: 'millbrook.mill',
    work: 'millbrook.mill',
    schedule: dayWorker('millbrook.mill', 'millbrook.mill'),
    likes: ['item.dish_bread', 'item.bakers_loaf', 'item.seed_pod'],
  },
  {
    npc: 'npc.farmer',
    role: "Farmer's daughter",
    home: 'millbrook.farm_one',
    work: 'millbrook.fields',
    schedule: dayWorker('millbrook.fields', 'millbrook.farm_one', { foul: 'millbrook.farm_one' }),
    likes: ['item.berry_blue', 'item.honey_cake', 'item.apple_tart'],
  },
  {
    npc: 'npc.fisher',
    role: 'Fisher',
    home: 'reedmouth.hut',
    work: 'reedmouth.jetty',
    schedule: dayWorker('reedmouth.jetty', 'reedmouth.hut', { foul: 'reedmouth.hut' }),
    likes: ['item.fish_baked', 'item.rod_ash', 'item.salt'],
  },
  {
    npc: 'npc.foreman',
    role: 'Quarry foreman',
    home: 'stonecrop.foreman_tent',
    work: 'stonecrop.quarry',
    schedule: dayWorker('stonecrop.quarry', 'stonecrop.foreman_tent', {
      foul: 'stonecrop.foreman_tent',
    }),
    likes: ['item.pick_iron', 'item.hearty_stew', 'item.coal'],
  },
  {
    // The hermit keeps to the well on fine days and a shelter beside it when it is foul or dark.
    npc: 'npc.hermit',
    role: 'Hermit',
    home: 'cairnmoor.shelter',
    work: 'cairnmoor.well',
    schedule: [
      { phases: ['dawn', 'day', 'dusk'], weather: FOUL, place: 'cairnmoor.shelter' },
      { phases: ['dawn', 'day', 'dusk'], place: 'cairnmoor.well' },
      { phases: ['night'], place: 'cairnmoor.shelter' },
    ],
    likes: ['item.herb_tea', 'item.worn_map', 'item.mushroom_soup'],
  },
  {
    npc: 'npc.reeve',
    role: 'Reeve of Hearthford',
    home: 'hearthford.bell_tower',
    work: 'hearthford.bell_tower',
    schedule: [
      { phases: ['dawn', 'dusk'], place: 'hearthford.bell_tower' },
      { phases: ['day'], weather: FOUL, place: 'hearthford.bell_tower' },
      { phases: ['day'], place: 'hearthford.square' },
      { phases: ['night'], place: 'hearthford.bell_tower' },
    ],
    likes: ['item.apple_tart', 'item.spiced_cider', 'item.chalk_stub'],
  },
];

export const PEOPLE: Readonly<Record<string, PersonDef>> = Object.fromEntries(
  list.map((p) => [p.npc, p]),
);

/** True if the id names a place in `PLACES`. */
export const knownPlace = (id: string): boolean => PLACES[id] !== undefined;
