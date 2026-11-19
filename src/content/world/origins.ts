import type { WakeId } from './wake';
import { WAKE_IDS } from './wake';

/**
 * Origins (M4-19, D22). Flavor only: an origin narrows which wake points a new character can wake
 * at and sets the first line it sees. It gives no item, stat, XP, technique, coin or reputation.
 * The subsets are the table in `docs/design/regions/01-dawnmeadow.md` section 5.
 */
export interface OriginDef {
  id: string;
  nameKey: string;
  blurbKey: string;
  /** The wake points this origin draws from. */
  wakes: readonly WakeId[];
  /** The first line shown in the notice lane on waking. */
  firstLineKey: string;
  /** Palette index of the ground the setup preview stands on. */
  ground: number;
}

export const DEFAULT_ORIGIN = 'origin.unremembered';

export const ORIGINS: Readonly<Record<string, OriginDef>> = {
  'origin.unremembered': {
    id: 'origin.unremembered',
    nameKey: 'origin.unremembered.name',
    blurbKey: 'origin.unremembered.blurb',
    wakes: WAKE_IDS,
    firstLineKey: 'origin.unremembered.first',
    ground: 10,
  },
  'origin.farmhand': {
    id: 'origin.farmhand',
    nameKey: 'origin.farmhand.name',
    blurbKey: 'origin.farmhand.blurb',
    wakes: ['w1', 'w7'],
    firstLineKey: 'origin.farmhand.first',
    ground: 11,
  },
  'origin.road_weary': {
    id: 'origin.road_weary',
    nameKey: 'origin.road_weary.name',
    blurbKey: 'origin.road_weary.blurb',
    wakes: ['w2', 'w8'],
    firstLineKey: 'origin.road_weary.first',
    ground: 5,
  },
  'origin.hunters_ward': {
    id: 'origin.hunters_ward',
    nameKey: 'origin.hunters_ward.name',
    blurbKey: 'origin.hunters_ward.blurb',
    wakes: ['w4', 'w7'],
    firstLineKey: 'origin.hunters_ward.first',
    ground: 9,
  },
  'origin.river_found': {
    id: 'origin.river_found',
    nameKey: 'origin.river_found.name',
    blurbKey: 'origin.river_found.blurb',
    wakes: ['w3', 'w6'],
    firstLineKey: 'origin.river_found.first',
    ground: 14,
  },
  'origin.pilgrims_child': {
    id: 'origin.pilgrims_child',
    nameKey: 'origin.pilgrims_child.name',
    blurbKey: 'origin.pilgrims_child.blurb',
    wakes: ['w5', 'w8'],
    firstLineKey: 'origin.pilgrims_child.first',
    ground: 18,
  },
};

export const ORIGIN_IDS: readonly string[] = Object.keys(ORIGINS);

/** The wake points an origin allows. An unknown id (a save from a newer build) allows all eight. */
export function wakesFor(origin: string): readonly WakeId[] {
  return (ORIGINS[origin] ?? (ORIGINS[DEFAULT_ORIGIN] as OriginDef)).wakes;
}
