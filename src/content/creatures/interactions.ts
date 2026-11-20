/**
 * What a creature will take from a hand (POW-M4-05, design/04 non-combat interactions). Feeding
 * a creature one of these calms it for `TEMPERAMENT.feed.calmTicks`: it notices nothing, starts
 * nothing and forgets any fight, until it is hit or the time is up. The first time opens its
 * Bestiary entry as a friend. Scaring is the Bell and Smoke gadgets (`sim/gadgets.ts`); soothing
 * is Mending's, and arrives with it. Bosses are not fed: they are tamed (M6).
 */
export interface FeedDef {
  /** Item ids the creature accepts. */
  items: readonly string[];
}

const GREENS = ['item.sunwort', 'item.dewmint'] as const;
const BERRIES = ['item.berry_red', 'item.berry_blue'] as const;
const MEAT = ['item.raw_meat', 'item.roast_meat'] as const;

export const FEEDS: Readonly<Record<string, FeedDef>> = {
  'creature.meadow_hare': { items: [...GREENS, ...BERRIES] },
  'creature.hedge_sparrow': { items: ['item.seed_pod', ...BERRIES] },
  'creature.mossling': { items: ['item.seed_pod', 'item.berry_blue'] },
  'creature.downs_ram': { items: GREENS },
  'creature.grain_rat': { items: ['item.dish_bread', 'item.seed_pod'] },
  'creature.fox': { items: MEAT },
  'creature.moorhound': { items: MEAT },
  'creature.crag_hawk': { items: MEAT },
  'creature.reed_crab': { items: ['item.raw_meat'] },
  'creature.bramble_boar': { items: [...BERRIES, 'item.dish_bread'] },
  'creature.thistle_wasp': { items: ['item.honey_cake', 'item.apple_tart'] },
};
