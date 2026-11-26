import type { Season, Weather } from './time';

/**
 * The market (POW-M5-10, design/05 Economy, design/07 Market). Every number is data. A price lives
 * between a floor just above the most an NPC shop ever pays and a ceiling where listing nets less
 * than the cheapest an NPC shop ever sells for, so no loop between the two gains coin.
 */
export const MARKET = {
  /** Percent of a listing's price paid up front to list, at least 1 coin, never returned. */
  feePct: 3,
  /** Percent of the price the market keeps from a sale, rounded up. */
  cutPct: 8,
  /** The most listings the player can have up at once. */
  maxListings: 12,
  /** Each in-game hour the price moves back toward its target by this share of the gap. */
  decay: 0.02,
  /** Pressure (demand minus supply, in units) moves the price by this share of base per unit... */
  pressurePerUnit: 0.012,
  /** ...and no more than this share of base in one hour. */
  pressureCap: 0.25,
  /** A player listing at the market price sells with this chance in an in-game hour. */
  saleChance: 0.18,
  /** How fast the chance falls with a price above the market (exponent on market / price). */
  saleSteep: 3,
  /** The most a listing's chance can be, however cheap. */
  saleMax: 0.85,
  /** Days of price history the sparkline shows (in-game days). */
  historyDays: 14,
  /** A price that moves this share from the last one announced makes chat talk about it. */
  announcePct: 12,
  /** Hours of an offline gap played out one by one. The rest decay in one step, with no sales. */
  catchUpHours: 48,
  /** How many Traveler listings the terminal shows for an item, and the stock each offers. */
  travelerListings: 4,
  travelerQty: [1, 6] as readonly [number, number],
  /** Each Traveler under the one before undercuts by about this share of the price. */
  undercutPct: 3,
  /** Market day (M5-11): demand and Traveler stock on the day it runs. */
  marketDayDemand: 1.6,
  marketDayListings: 7,
} as const;

/** Target price factors by season and by weather, per item category. 1 is the base price. */
export const SEASON_FACTOR: Readonly<Record<Season, { material: number; consumable: number }>> = {
  spring: { material: 1, consumable: 0.95 },
  summer: { material: 0.95, consumable: 0.9 },
  autumn: { material: 1, consumable: 1.05 },
  winter: { material: 1.08, consumable: 1.12 },
};
export const WEATHER_FACTOR: Readonly<Partial<Record<Weather, number>>> = {
  rain: 1.03,
  storm: 1.08,
  snow: 1.06,
};
