import type { Quality } from '../items/types';
import type { Weather } from './time';

/**
 * Farming (POW-M6-02, design/05 Farming and husbandry, design/13 section 2). Every number a crop,
 * a plot or the lease reads. Growth is on the world clock, so the same formula settles a plot
 * online and offline.
 *
 * Growth is counted in growth units: one tick at full rate is `unitsPerTick`. A crop of `days`
 * needs `days * dayTicks * unitsPerTick` units. The rates are whole numbers of units, so a long
 * step and many short ones add up to exactly the same total.
 */
export const FARMING = {
  /** The reeve's field: how many plots, and the lease per plot per in-game week, paid ahead. */
  plots: 6,
  lease: { weekly: 12, weekDays: 7, maxWeeks: 4 },
  /** Growth units for one tick at full rate (watered, or a rain day). */
  unitsPerTick: 1000,
  /** Share of full rate an unwatered plot grows at. */
  dryRate: 0.5,
  /** Weather that waters every outdoor plot for the whole in-game day. */
  rainWeather: ['rain', 'storm'] as readonly Weather[],
  /** In-game days a watering lasts. Green Thumb (Farming 15) makes it `greenThumbPct` longer. */
  waterDays: 1,
  greenThumbPct: 25,
  /** Farming points for the Green Thumb passive (design/11, band 15). */
  greenThumbAt: 15,
  /** Fertilizer on a growing crop: this percent more growth until it is harvested. */
  fertBoost: 25,
  /** Stage thresholds in percent of full growth: seed, sprout, young, ripe. */
  stages: [0, 25, 60, 100] as readonly number[],
  /** Waterings a full watering can holds. Refilled at the well or the river. */
  canCharges: 10,
  /** Soil 0 to 3. A new plot starts here. */
  soilStart: 1,
  soilMax: 3,
  /** By soil 0 to 3: percent more yield, and the same steps added to the quality score. */
  soilYieldPct: [0, 10, 25, 40] as readonly number[],
  soilQualityStep: [0, 10, 25, 40] as readonly number[],
  /** Units of crop a harvest gives before soil: a first harvest, and each regrowth after. */
  yieldBase: 3,
  yieldRegrow: 2,
  /** Farming points needed to plant a crop of each tier (tier 1 is the band 0 passive). */
  tierPoints: { 1: 0, 2: 5, 3: 15, 4: 30 } as Readonly<Record<number, number>>,
  /** Giant crops (13 section 2.2): the chance four ripe plants at soil 3 merge, by Farming. */
  giant: { chancePct: 15, chanceHighPct: 30, highAt: 50, qty: 12, quality: 3 as Quality },
  /** Harvest XP: per harvest (scaled by the crop's tier), and the first time for each crop. */
  xp: { base: 60, firstTime: 150 },
  /** Most harvest events a second, for the XP ceiling: one command each, like eating. */
  harvestsPerSecond: 2,
} as const;
