import type { Archetype } from '../travelers/types';
import type { Culture } from '../travelers/names';
import type { ScheduleId } from '../travelers/types';
import type { Temper, VoiceId } from '../travelers/types';

/**
 * Traveler tunables (design/12). Everything the generator draws from is here: weights for
 * archetypes, focus skills, naming cultures, schedules, pace and plateau. Never inline these.
 */

export const TRAVELER_COUNT = 240;
/** Slots 0 to 23 come from `content/travelers/handTuned`. */
export const HAND_TUNED_COUNT = 24;

/** How many times a handle is redrawn before the always-safe fallback pattern is used. */
export const HANDLE_REROLLS = 12;

type W<T extends string> = readonly (readonly [T, number])[];

/** Share of the generated slots, as weights. */
export const ARCHETYPE_WEIGHTS: W<Archetype> = [
  ['Grinder', 16],
  ['Explorer', 12],
  ['Socializer', 12],
  ['Crafter', 16],
  ['Trader', 8],
  ['Roleplayer', 6],
  ['Completionist', 8],
  ['Casual', 12],
  ['Newbie', 6],
  ['Veteran', 4],
];

export const CULTURE_WEIGHTS: W<Culture> = [
  ['plain', 25],
  ['gamer', 20],
  ['lowercase', 20],
  ['silly', 15],
  ['fantasy', 15],
  ['compound', 5],
];

/** Schedule shapes and their shares (design/12 3.1). */
export const SCHEDULE_WEIGHTS: W<ScheduleId> = [
  ['student', 18],
  ['office', 22],
  ['early', 7],
  ['nightshift', 6],
  ['parent', 13],
  ['lunch', 8],
  ['retiree', 6],
  ['weekend', 10],
  ['nightowl', 7],
  ['always', 3],
];

/** Phase shift of a Traveler's own schedule against its shape, in minutes. */
export const PHASE_SHIFT_MIN = -40;
export const PHASE_SHIFT_MAX = 40;

export const TEMPER_WEIGHTS: Record<Archetype, W<Temper>> = {
  Grinder: [
    ['bold', 4],
    ['steady', 5],
    ['shy', 1],
  ],
  Explorer: [
    ['bold', 3],
    ['steady', 4],
    ['shy', 3],
  ],
  Socializer: [
    ['bold', 7],
    ['steady', 3],
    ['shy', 0],
  ],
  Crafter: [
    ['bold', 2],
    ['steady', 6],
    ['shy', 2],
  ],
  Trader: [
    ['bold', 5],
    ['steady', 4],
    ['shy', 1],
  ],
  Roleplayer: [
    ['bold', 6],
    ['steady', 3],
    ['shy', 1],
  ],
  Completionist: [
    ['bold', 2],
    ['steady', 6],
    ['shy', 2],
  ],
  Casual: [
    ['bold', 2],
    ['steady', 4],
    ['shy', 4],
  ],
  Newbie: [
    ['bold', 2],
    ['steady', 3],
    ['shy', 5],
  ],
  Veteran: [
    ['bold', 5],
    ['steady', 5],
    ['shy', 0],
  ],
};

/** Where Travelers call home, as weights over region ids 1 to 8. Dawnmeadow is most common. */
export const HOME_WEIGHTS: readonly (readonly [number, number])[] = [
  [1, 30],
  [2, 12],
  [3, 12],
  [4, 12],
  [5, 9],
  [6, 9],
  [7, 9],
  [8, 7],
];

/** Share of Travelers that start in a guild (design/12 section 1). */
export const GUILD_START_SHARE = 0.55;

/** Guild weights by archetype. Guild ids are in `content/travelers/guilds`. */
export const GUILD_AFFINITY: Record<Archetype, readonly (readonly [number, number])[]> = {
  Grinder: [
    [1, 6],
    [9, 2],
    [12, 2],
    [7, 1],
  ],
  Explorer: [
    [3, 4],
    [10, 2],
    [11, 3],
    [12, 2],
    [5, 2],
  ],
  Socializer: [
    [7, 6],
    [10, 2],
    [8, 3],
    [4, 2],
  ],
  Crafter: [
    [2, 6],
    [8, 4],
    [7, 1],
  ],
  Trader: [
    [6, 6],
    [2, 2],
    [5, 1],
  ],
  Roleplayer: [
    [4, 8],
    [7, 1],
  ],
  Completionist: [
    [3, 5],
    [1, 2],
    [9, 1],
  ],
  Casual: [
    [7, 4],
    [5, 3],
    [8, 2],
    [10, 1],
  ],
  Newbie: [
    [7, 8],
    [8, 1],
  ],
  Veteran: [
    [1, 4],
    [9, 3],
    [2, 2],
    [12, 2],
  ],
};

/** Voice weights by archetype. */
export const VOICE_AFFINITY: Record<Archetype, W<VoiceId>> = {
  Grinder: [
    ['terse', 4],
    ['veteran', 2],
    ['shouty', 2],
    ['excitable', 2],
    ['dry', 1],
  ],
  Explorer: [
    ['dry', 3],
    ['chatty', 3],
    ['lowercase', 2],
    ['nerdy', 2],
    ['terse', 1],
  ],
  Socializer: [
    ['chatty', 4],
    ['kind', 3],
    ['glyphy', 3],
    ['excitable', 2],
    ['jokey', 2],
  ],
  Crafter: [
    ['kind', 3],
    ['nerdy', 3],
    ['chatty', 2],
    ['terse', 2],
    ['dry', 1],
  ],
  Trader: [
    ['merchant', 6],
    ['dry', 2],
    ['chatty', 1],
    ['terse', 1],
  ],
  Roleplayer: [
    ['roleplay', 6],
    ['formal', 3],
    ['jokey', 1],
  ],
  Completionist: [
    ['nerdy', 4],
    ['formal', 3],
    ['terse', 2],
    ['dry', 1],
  ],
  Casual: [
    ['lowercase', 3],
    ['sleepy', 3],
    ['jokey', 2],
    ['kind', 2],
    ['chatty', 1],
  ],
  Newbie: [
    ['newbie', 7],
    ['jokey', 1],
    ['lowercase', 1],
    ['excitable', 1],
  ],
  Veteran: [
    ['veteran', 5],
    ['terse', 3],
    ['dry', 2],
    ['shouty', 1],
  ],
};

/** The skills an archetype tends to spend its time on, as weights. Ids are in `content/skills`. */
const S = (s: string): string => `skill.${s}`;
export const FOCUS_WEIGHTS: Record<Archetype, readonly (readonly [string, number])[]> = {
  Grinder: [
    [S('blades'), 4],
    [S('heavy_arms'), 4],
    [S('polearms'), 3],
    [S('archery'), 3],
    [S('shieldcraft'), 3],
    [S('unarmed'), 2],
    [S('evasion'), 2],
    [S('mining'), 2],
    [S('athletics'), 1],
  ],
  Explorer: [
    [S('cartography'), 4],
    [S('stealth'), 3],
    [S('survival'), 3],
    [S('athletics'), 3],
    [S('foraging'), 3],
    [S('delving'), 2],
    [S('fishing'), 2],
    [S('archery'), 1],
  ],
  Socializer: [
    [S('performance'), 4],
    [S('cooking'), 3],
    [S('farming'), 3],
    [S('taming'), 3],
    [S('leadership'), 2],
    [S('foraging'), 2],
    [S('husbandry'), 2],
  ],
  Crafter: [
    [S('smithing'), 4],
    [S('woodworking'), 4],
    [S('tailoring'), 3],
    [S('cooking'), 3],
    [S('alchemy'), 3],
    [S('tinkering'), 3],
    [S('enchanting'), 2],
    [S('logging'), 2],
    [S('mining'), 2],
  ],
  Trader: [
    [S('bartering'), 6],
    [S('foraging'), 3],
    [S('alchemy'), 2],
    [S('fishing'), 2],
    [S('farming'), 2],
    [S('cooking'), 1],
  ],
  Roleplayer: [
    [S('performance'), 5],
    [S('mending'), 3],
    [S('blades'), 2],
    [S('cooking'), 2],
    [S('leadership'), 2],
    [S('hexing'), 1],
  ],
  Completionist: [
    [S('cartography'), 4],
    [S('deciphering'), 3],
    [S('foraging'), 2],
    [S('blades'), 2],
    [S('evasion'), 2],
    [S('delving'), 2],
    [S('fishing'), 1],
  ],
  Casual: [
    [S('fishing'), 4],
    [S('foraging'), 3],
    [S('cooking'), 3],
    [S('farming'), 3],
    [S('logging'), 2],
    [S('husbandry'), 1],
  ],
  Newbie: [
    [S('mining'), 3],
    [S('smithing'), 3],
    [S('foraging'), 3],
    [S('cooking'), 2],
    [S('logging'), 2],
    [S('fishing'), 2],
    [S('taming'), 1],
  ],
  Veteran: [
    [S('blades'), 3],
    [S('heavy_arms'), 3],
    [S('archery'), 2],
    [S('smithing'), 2],
    [S('tinkering'), 2],
    [S('athletics'), 2],
    [S('shieldcraft'), 2],
  ],
};

/** Focus skills per generated Traveler: a count from this range. */
export const FOCUS_COUNT_MIN = 2;
export const FOCUS_COUNT_MAX = 4;

/** Progress multiplier range against the reference player (design/12 3.4). */
export const PACE_RANGE: Record<Archetype, readonly [number, number]> = {
  Grinder: [1.1, 1.5],
  Explorer: [0.9, 1.3],
  Socializer: [0.7, 1.1],
  Crafter: [0.9, 1.3],
  Trader: [0.8, 1.2],
  Roleplayer: [0.7, 1.0],
  Completionist: [1.0, 1.4],
  Casual: [0.6, 0.9],
  Newbie: [0.6, 0.8],
  Veteran: [1.3, 1.6],
};

/** Skill points at which a Traveler's progress flattens (design/12 3.4). */
export const PLATEAU_RANGE: Record<Archetype, readonly [number, number]> = {
  Grinder: [72, 92],
  Explorer: [60, 82],
  Socializer: [55, 78],
  Crafter: [70, 92],
  Trader: [60, 85],
  Roleplayer: [50, 72],
  Completionist: [74, 95],
  Casual: [40, 62],
  Newbie: [60, 90],
  Veteran: [66, 82],
};

/** Skill points a Traveler of this archetype starts with in each focus skill, at save creation. */
export const START_POINTS: Record<Archetype, readonly [number, number]> = {
  Grinder: [8, 22],
  Explorer: [6, 18],
  Socializer: [4, 14],
  Crafter: [8, 20],
  Trader: [6, 16],
  Roleplayer: [4, 12],
  Completionist: [8, 20],
  Casual: [2, 10],
  Newbie: [0, 3],
  Veteran: [28, 46],
};

/** Starting purse in coin, by archetype. */
export const START_COIN: Record<Archetype, readonly [number, number]> = {
  Grinder: [60, 400],
  Explorer: [40, 300],
  Socializer: [40, 300],
  Crafter: [80, 500],
  Trader: [400, 2400],
  Roleplayer: [30, 240],
  Completionist: [60, 360],
  Casual: [20, 160],
  Newbie: [5, 40],
  Veteran: [500, 3000],
};

/** Chance a generated Traveler has a standing tie, and the most ties it may hold. */
export const TIE_CHANCE = 0.35;
export const TIE_MAX = 3;
/** Relative odds of each kind of generated tie. Mentor and sibling are rare. */
export const TIE_KIND_WEIGHTS = [
  ['friend', 12],
  ['rival', 3],
  ['sibling', 1],
] as const;

/** The doll's main hand by archetype, as the chance of carrying a weapon. */
export const ARMED_CHANCE: Record<Archetype, number> = {
  Grinder: 0.95,
  Explorer: 0.4,
  Socializer: 0.2,
  Crafter: 0.25,
  Trader: 0.1,
  Roleplayer: 0.7,
  Completionist: 0.5,
  Casual: 0.2,
  Newbie: 0.3,
  Veteran: 0.95,
};
