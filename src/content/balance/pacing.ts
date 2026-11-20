/**
 * Pacing budgets (POW-M4-12, design/10 and regions/01 section 14). `tools/pacing-ledger` sums the
 * `estMinutes` of authored content by category and region and holds each region against this
 * table. A region's numbers are its planning estimates; `count` is how many pieces the budget
 * assumes, so the report can show how much is still to author.
 */
export type PacingCategory =
  | 'dungeons'
  | 'miniDungeons'
  | 'pois'
  | 'requests'
  | 'threads'
  | 'trials15'
  | 'singulars'
  | 'extras';

export interface PacingBudget {
  /** Pieces the budget assumes. */
  count: number;
  /** Minutes the category should reach. */
  minutes: number;
}

export const PACING_LABELS: Readonly<Record<PacingCategory, string>> = {
  dungeons: 'Dungeons',
  miniDungeons: 'Mini-dungeons',
  pois: 'Points of interest',
  requests: 'Requests',
  threads: 'Threads',
  trials15: 'Rank 15 Trials',
  singulars: 'Singulars',
  extras: 'Field boss, Waystones, routes',
};

/** Order the report lists the categories in. */
export const PACING_ORDER: readonly PacingCategory[] = [
  'dungeons',
  'miniDungeons',
  'pois',
  'requests',
  'threads',
  'trials15',
  'singulars',
  'extras',
];

export const PACING_BUDGETS: Readonly<
  Record<string, Readonly<Record<PacingCategory, PacingBudget>>>
> = {
  // regions/01-dawnmeadow section 14: 1,193 minutes, about 20 hours.
  dawnmeadow: {
    dungeons: { count: 4, minutes: 120 },
    miniDungeons: { count: 12, minutes: 96 },
    pois: { count: 30, minutes: 120 },
    requests: { count: 25, minutes: 260 },
    threads: { count: 5, minutes: 225 },
    trials15: { count: 32, minutes: 192 },
    singulars: { count: 3, minutes: 90 },
    extras: { count: 0, minutes: 90 },
  },
};

/** A Waystone found, read and attuned, in minutes (counted under `extras`). */
export const WAYSTONE_MINUTES = 5;

/**
 * Content with no region of its own (the Trials the first map shipped with) belongs here: they
 * were authored for the first map, which is Dawnmeadow's home ground.
 */
export const HOME_REGION = 'dawnmeadow';
