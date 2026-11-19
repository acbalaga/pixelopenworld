/**
 * Weather (M4-09, design/02): one kind per region per in-game day, drawn from a seeded table.
 * Pure data and one pure function, so the sim, the renderer and the tests agree.
 */
import { WEATHER, type Weather } from '../balance/time';

/** Relative weight of each kind in a region's table. A kind with no entry never occurs there. */
export type WeatherTable = Readonly<Partial<Record<Weather, number>>>;

/** Tables by region id (the baked region's id). Dawnmeadow is a gentle meadow: mostly clear, some rain and fog, a rare storm. */
export const REGION_WEATHER: Readonly<Record<string, WeatherTable>> = {
  slice: { clear: 55, rain: 25, fog: 12, storm: 8 },
  dawnmeadow: { clear: 55, rain: 25, fog: 12, storm: 8 },
  dev_stress: { clear: 30, rain: 25, fog: 15, storm: 15, snow: 5, heat: 5, sandstorm: 5 },
  sample: { clear: 40, rain: 30, fog: 15, storm: 15 },
};

/** The table for a region that has none of its own. */
export const DEFAULT_WEATHER: WeatherTable = { clear: 70, rain: 20, fog: 10 };

/** A small integer hash (Murmur3 finalizer over mixed inputs). Stable across devices. */
function mix(a: number, b: number, c: number): number {
  let h = (a ^ Math.imul(b, 0x9e3779b1) ^ Math.imul(c, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash of a string, for the region id. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The weather of a region on an in-game day. A function of the world seed, the region and the day
 * only, so it is the same on every device and in every replay. `day` is `dayIndex(tick)`.
 */
export function weatherFor(region: string, seed: number, day: number): Weather {
  const table = REGION_WEATHER[region] ?? DEFAULT_WEATHER;
  let total = 0;
  for (const w of WEATHER) total += table[w] ?? 0;
  if (total <= 0) return 'clear';
  let roll = mix(seed >>> 0, hashString(region), day) % total;
  for (const w of WEATHER) {
    const weight = table[w] ?? 0;
    if (roll < weight) return w;
    roll -= weight;
  }
  return 'clear';
}
