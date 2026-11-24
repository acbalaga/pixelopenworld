import { PLACES } from '../../content/people/places';
import { SKILLS } from '../../content/skills';

/**
 * Stable index lists the saved lives refer to. Both follow content order, so a new skill or place
 * is added at the end of its table and an index already saved keeps its meaning.
 */
export const SKILL_LIST: readonly string[] = Object.keys(SKILLS);
export const PLACE_LIST: readonly string[] = Object.keys(PLACES);

const skillIndex = new Map(SKILL_LIST.map((s, i) => [s, i]));
const placeIndex = new Map(PLACE_LIST.map((p, i) => [p, i]));

/** Index of a skill id, or -1. */
export const skillIdx = (id: string): number => skillIndex.get(id) ?? -1;
/** Index of a place id, or -1. */
export const placeIdx = (id: string): number => placeIndex.get(id) ?? -1;
