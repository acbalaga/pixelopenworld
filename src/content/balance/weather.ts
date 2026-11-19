import type { Weather } from './time';

/**
 * What weather does to play (design/02), outdoors only. Percent of the usual, so 100 is no change.
 * Kinds not listed are unchanged.
 */
export const WEATHER_BALANCE = {
  /** Strength of an element's hit by weather: rain feeds Tide and damps Ember, and so on. */
  elementPct: {
    rain: { tide: 125, ember: 80 },
    storm: { gale: 125, tide: 110, ember: 70 },
    heat: { ember: 125, tide: 80 },
    snow: { ember: 85, tide: 90 },
    sandstorm: { stone: 115, gale: 110, tide: 80 },
  } as Partial<Record<Weather, Record<string, number>>>,
  /** How far creatures notice, as a share of their usual range. Fog and sand hide you. */
  noticePct: { rain: 90, storm: 80, fog: 55, snow: 85, sandstorm: 50 } as Partial<
    Record<Weather, number>
  >,
  /** How fast spawners refill, as a share of the usual rate. */
  spawnPct: { rain: 110, storm: 125, fog: 120, snow: 80, heat: 90, sandstorm: 70 } as Partial<
    Record<Weather, number>
  >,
  /**
   * Fishing table shift (M6 reads it): percent added to the bite chance, and kinds it forbids.
   * Data only until fishing exists.
   */
  fishingBitePct: { rain: 25, fog: 10, storm: -100, snow: -20, heat: -15 } as Partial<
    Record<Weather, number>
  >,
  /** Crop growth by weather and by season, percent (M6 reads it). Data only. */
  cropGrowthPct: {
    weather: { rain: 120, storm: 90, heat: 80, snow: 50, sandstorm: 40 } as Partial<
      Record<Weather, number>
    >,
    season: { spring: 110, summer: 100, autumn: 90, winter: 40 } as Record<string, number>,
  },
} as const;
