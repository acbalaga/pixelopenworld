/**
 * Non-combat interactions (POW-M4-05, design/04 "Creatures have non-combat interactions"). What
 * each creature accepts, as data. Systems read this and never name a creature.
 *
 * - `feed`: items it takes from a hand. Offering one calms it for `calmTicks`: it notices nothing
 *   and drops any chase, until something hurts it.
 * - `soothe`: ticks it stays calm after a Lullaby. Absent means the song does not reach it.
 * - `scare`: false if the bell and a fright do not move it (the dead, stone, spirits, bosses).
 */
export interface Interaction {
  feed?: { items: readonly string[]; calmTicks: number };
  soothe?: number;
  scare?: false;
}

const BERRIES = ['item.berry_red', 'item.berry_blue'] as const;
const MEAT = ['item.raw_meat', 'item.roast_meat'] as const;

export const INTERACTIONS: Readonly<Record<string, Interaction>> = {
  'creature.mossling': {
    feed: { items: [...BERRIES, 'item.dewmint'], calmTicks: 900 },
    soothe: 450,
  },
  'creature.meadow_hare': {
    feed: { items: [...BERRIES, 'item.sunwort'], calmTicks: 600 },
    soothe: 300,
  },
  'creature.hedge_sparrow': { feed: { items: ['item.seed_pod'], calmTicks: 450 }, soothe: 300 },
  'creature.moor_wisp': { soothe: 300, scare: false },
  'creature.downs_ram': {
    feed: { items: ['item.sunwort', ...BERRIES], calmTicks: 600 },
    soothe: 450,
  },
  'creature.grain_rat': { feed: { items: ['item.dish_bread'], calmTicks: 300 } },
  'creature.fox': { feed: { items: MEAT, calmTicks: 900 }, soothe: 450 },
  'creature.strawman': { scare: false },
  'creature.burrow_mole': { feed: { items: ['item.clay'], calmTicks: 450 }, soothe: 300 },
  'creature.thistle_wasp': { soothe: 300 },
  'creature.barrow_bones': { scare: false },
  'creature.reed_crab': {
    feed: { items: [...MEAT, 'item.fish_river'], calmTicks: 600 },
    soothe: 300,
  },
  'creature.marsh_leech': {},
  'creature.rubblet': { scare: false },
  'creature.crag_hawk': { feed: { items: MEAT, calmTicks: 450 }, soothe: 300 },
  'creature.moorhound': { feed: { items: MEAT, calmTicks: 600 }, soothe: 300 },
  'creature.thornling_scout': { soothe: 300 },
  'creature.hollowhorn': { scare: false },
  // The M1 to M3 roster.
  'creature.spitbloom': { soothe: 300 },
  'creature.old_bramblehide': { scare: false },
  'creature.bramble_boar': {
    feed: { items: [...BERRIES, 'item.seed_pod'], calmTicks: 600 },
    soothe: 300,
  },
};
