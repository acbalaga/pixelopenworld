import type { DayPhase } from '../balance/time';
import type { Season, Weather } from '../balance/time';

/** The water a fishing spot sits on (design/13 section 4). Dawnmeadow has four of the seven. */
export type Water = 'river' | 'pond' | 'marsh' | 'estuary';
export const WATERS: readonly Water[] = ['river', 'pond', 'marsh', 'estuary'];

/** One species (design/13 section 4). Names and descriptions are the item's, in `strings/items.ts`. */
export interface FishDef {
  /** The item it lands as. */
  item: string;
  /** Where it lives. A species can live in more than one water. */
  water: readonly Water[];
  /** Its share among the fish that are biting. */
  weight: number;
  /** Length in cm, bottom and top of what a catch rolls. */
  size: readonly [number, number];
  /** 1 to 5: how narrow the band is and how hard it pulls. */
  difficulty: number;
  phases?: readonly DayPhase[];
  seasons?: readonly Season[];
  weather?: readonly Weather[];
  /** The legendary one: never in a spot's ordinary table. Once per save. */
  legend?: true;
}

export const FISH: readonly FishDef[] = [
  { item: 'item.fish_river', water: ['river'], weight: 10, size: [12, 30], difficulty: 1 },
  {
    item: 'item.fish_silver',
    water: ['river'],
    weight: 5,
    size: [14, 32],
    difficulty: 2,
    phases: ['day'],
  },
  // Bait, and the one fish the marsh gives by day (a low-stakes call: the table has none then).
  { item: 'item.fish_minnow', water: ['river', 'marsh'], weight: 6, size: [4, 9], difficulty: 1 },
  {
    item: 'item.fish_trout',
    water: ['river'],
    weight: 4,
    size: [25, 60],
    difficulty: 2,
    phases: ['dawn', 'dusk'],
  },
  {
    item: 'item.fish_chub',
    water: ['river'],
    weight: 5,
    size: [20, 45],
    difficulty: 1,
    phases: ['day'],
  },
  {
    item: 'item.fish_perch',
    water: ['pond'],
    weight: 6,
    size: [15, 35],
    difficulty: 2,
    phases: ['day'],
  },
  { item: 'item.fish_carp', water: ['pond'], weight: 8, size: [30, 80], difficulty: 2 },
  {
    item: 'item.fish_tench',
    water: ['pond'],
    weight: 5,
    size: [25, 55],
    difficulty: 3,
    weather: ['rain'],
  },
  {
    item: 'item.fish_golden_carp',
    water: ['pond'],
    weight: 1,
    size: [35, 70],
    difficulty: 4,
    seasons: ['summer'],
    phases: ['day'],
  },
  {
    item: 'item.fish_pike',
    water: ['river'],
    weight: 2,
    size: [50, 110],
    difficulty: 3,
    phases: ['dusk', 'night'],
  },
  {
    item: 'item.fish_bog_loach',
    water: ['marsh'],
    weight: 8,
    size: [8, 18],
    difficulty: 2,
    phases: ['night'],
  },
  {
    item: 'item.fish_reed_eel',
    water: ['marsh'],
    weight: 4,
    size: [40, 90],
    difficulty: 3,
    phases: ['night'],
    weather: ['rain'],
  },
  { item: 'item.fish_flounder', water: ['estuary'], weight: 8, size: [20, 50], difficulty: 2 },
  {
    item: 'item.fish_sea_bass',
    water: ['estuary'],
    weight: 3,
    size: [35, 85],
    difficulty: 4,
    weather: ['storm'],
  },
  {
    item: 'item.old_gnarl',
    water: ['pond'],
    weight: 0,
    size: [120, 160],
    difficulty: 5,
    phases: ['dusk'],
    seasons: ['autumn'],
    legend: true,
  },
];

export const FISH_BY_ITEM: Readonly<Record<string, FishDef>> = Object.fromEntries(
  FISH.map((f) => [f.item, f]),
);

/** The water the legend lives in is only the pond at this place. */
export const LEGEND_PLACE = 'millbrook_pond';
