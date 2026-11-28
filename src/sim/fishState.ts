/**
 * The saved shape of fishing (POW-M6-05). Kept apart from `fishing.ts` so the state module can
 * build and load it without pulling in the rules.
 */

/** The best catch of one species. Saved. */
export interface FishRecord {
  /** Landed so far. */
  n: number;
  /** The longest, in cm, and the place it came from (a `FISH_PLACES` id). */
  best: number;
  where: string;
}

/** What the player has landed. Saved. */
export interface FishingState {
  records: Record<string, FishRecord>;
  /** Old Gnarl has been landed. She is landed once per save. */
  gnarl: boolean;
}

/** A fight in progress, kept on the `gather` component. Saved with it. */
export interface Fight {
  /** The fish on the line, or '' while the wait for a bite runs. */
  item: string;
  /** Its length in cm, rolled when it bit. */
  size: number;
  /** `wait` for a bite, `bite` for the tap, `reel` for the fight. */
  phase: 'wait' | 'bite' | 'reel';
  /** Marker and its speed, band width, and the catch bar, all on the 0 to 1000 track. */
  m: number;
  v: number;
  band: number;
  fill: number;
  /** Ticks reeled so far. */
  t: number;
  /** The line is being held. */
  hold: boolean;
  /** The fish's shove: direction (-1, 0, 1), ticks left in it, and ticks of rest after. */
  pull: number;
  pullT: number;
  rest: number;
  /** A minnow was on the hook. */
  bait: boolean;
}

export function newFishing(): FishingState {
  return { records: {}, gnarl: false };
}

/** A loaded record, or a new one if the save has none. */
export function normalFishing(raw: FishingState | undefined): FishingState {
  if (!raw || typeof raw.records !== 'object' || raw.records === null) return newFishing();
  return { records: raw.records, gnarl: raw.gnarl === true };
}
