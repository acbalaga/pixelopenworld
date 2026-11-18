/**
 * Tier 1 and 2 items that cannot be obtained yet, each with the reason (POW-M3-12). The list
 * exists to be emptied: an entry goes when the thing that supplies the item lands, and the check
 * fails if an entry is obtainable by then.
 */
export const ALLOWED: Readonly<Record<string, string>> = {};
