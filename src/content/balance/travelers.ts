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
  ['student', 15],
  ['office', 18],
  ['early', 10],
  ['nightshift', 6],
  ['parent', 11],
  ['lunch', 8],
  ['retiree', 8],
  ['weekend', 9],
  ['nightowl', 8],
  ['always', 7],
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

/** Skill points a Traveler of this archetype starts with in its first focus skill. Later ones fall off. */
export const START_BASE: Record<Archetype, number> = {
  Grinder: 14,
  Explorer: 11,
  Socializer: 8,
  Crafter: 12,
  Trader: 10,
  Roleplayer: 7,
  Completionist: 13,
  Casual: 5,
  Newbie: 1,
  Veteran: 34,
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

/** One session of a schedule shape, in minutes after local midnight. `start + len` may pass 1440. */
export interface SessionShape {
  start: number;
  len: number;
  /** Largest random shift of the start and of the length, in minutes, either way. */
  jitter: number;
}

export interface ScheduleShape {
  weekday: readonly SessionShape[];
  weekend: readonly SessionShape[];
  /** Chance a weekday session is skipped (design/12 3.1: 12%, 25% for parent). */
  skip: number;
  /**
   * Chance the Traveler logs in at all on a weekday and on a weekend day. With 240 Travelers and
   * every shape playing every day the evening would hold over 100 online, so each shape has an
   * attendance that brings the count to the curve in design/07 (about 20 at the trough, about 45
   * at the weekday peak). A balance knob, tuned with `npm run crowd-report`.
   */
  attend: readonly [weekday: number, weekend: number];
  /** `weekend` shape: its one weekday session falls on a single weekday chosen per Traveler. */
  oneWeekday?: true;
}

const h = (hour: number, min = 0): number => hour * 60 + min;
const SS = (start: number, end: number, jitter = 20): SessionShape => ({
  start,
  len: end - start,
  jitter,
});

/** The ten schedule shapes (design/12 3.1). Times are real local time. */
export const SCHEDULE_SHAPES: Record<ScheduleId, ScheduleShape> = {
  student: {
    weekday: [SS(h(15), h(19)), SS(h(19, 30), h(23, 30))],
    weekend: [SS(h(11), h(15)), SS(h(18), h(25))],
    skip: 0.12,
    attend: [0.2, 0.15],
  },
  office: {
    weekday: [SS(h(18, 30), h(23))],
    weekend: [SS(h(14), h(18)), SS(h(20), h(24))],
    skip: 0.12,
    attend: [0.3, 0.15],
  },
  early: {
    weekday: [SS(h(4, 30), h(9))],
    weekend: [SS(h(5, 30), h(11))],
    skip: 0.12,
    attend: [0.45, 0.4],
  },
  nightshift: {
    weekday: [SS(h(7, 30), h(14, 30))],
    weekend: [SS(h(9), h(13))],
    skip: 0.12,
    attend: [0.35, 0.05],
  },
  parent: {
    weekday: [SS(h(13, 30), h(16)), SS(h(21, 30), h(23, 15))],
    weekend: [SS(h(13), h(15)), SS(h(21), h(23, 30))],
    skip: 0.25,
    attend: [0.05, 0.05],
  },
  lunch: {
    weekday: [SS(h(12, 10), h(12, 55)), SS(h(20), h(21, 30))],
    weekend: [SS(h(10), h(12))],
    skip: 0.12,
    attend: [0.65, 0.05],
  },
  retiree: {
    weekday: [SS(h(9), h(12)), SS(h(12, 30), h(18, 30))],
    weekend: [SS(h(10), h(16))],
    skip: 0.12,
    attend: [0.55, 0.05],
  },
  weekend: {
    weekday: [SS(h(21), h(22))],
    weekend: [SS(h(10), h(13)), SS(h(14), h(19)), SS(h(19), h(26))],
    skip: 0.12,
    attend: [0.25, 0.4],
    oneWeekday: true,
  },
  nightowl: {
    weekday: [SS(h(22, 30), h(28, 45))],
    weekend: [SS(h(24), h(30))],
    skip: 0.12,
    attend: [0.82, 0.15],
  },
  always: {
    // Three long sessions with short overlaps, so the Traveler is never seen to blink out.
    weekday: [SS(h(0), h(8), 10), SS(h(7, 30), h(16), 10), SS(h(15, 30), h(24, 30), 10)],
    weekend: [SS(h(0), h(8), 10), SS(h(7, 30), h(16), 10), SS(h(15, 30), h(24, 30), 10)],
    skip: 0.05,
    attend: [0.95, 1],
  },
};

/**
 * Sessions pinned to exact times with a fixed first line (design/12 3.1, the lore support). The
 * schedule system honors them and M5 uses none: M10 fills this in. Keyed by slot. `weekday` is
 * 0 (Sunday) to 6; `line` is a chat template id.
 */
export interface FixedSession {
  weekday: number;
  start: number;
  len: number;
  line: string;
}
export const FIXED_SESSIONS: Readonly<Record<number, readonly FixedSession[]>> = {};

/**
 * Progress (design/12 3.4): `expected = min(plateau, start + pace * (A * playHours + B * realDays)
 * curve(archetype, playHours))` for the first focus skill, times `focusFalloff` for each next one.
 */
export const PROGRESS = {
  /** Skill points per play hour and per real day in a focus skill, before pace and curve. */
  pointsPerHour: 1.3,
  pointsPerRealDay: 0.5,
  /** Each later focus skill earns this share of the one before it. */
  focusFalloff: 0.85,
  /** Activity may push a skill this many points past its expected value, never more. */
  band: 3,
  /** Chance per abstract minute of working a skill that it gains a point, while it is behind. */
  nudgePerMinute: 0.06,
  /** Points per rank, for the rank-up event. */
  pointsPerRank: 5,
  /** Coin per play hour by archetype, before pace. Catch-up and the purse use it. */
  coinPerHour: {
    Grinder: 70,
    Explorer: 50,
    Socializer: 40,
    Crafter: 90,
    Trader: 220,
    Roleplayer: 35,
    Completionist: 55,
    Casual: 25,
    Newbie: 20,
    Veteran: 130,
  } as Record<Archetype, number>,
  coinPerRealDay: 8,
  /** Largest purse a Traveler holds. */
  coinCap: 60_000,
} as const;

/**
 * How an archetype's pace bends over play hours: it moves from `from` to `to`, mostly by `tau`
 * hours (a Gaussian ease). A Newbie starts slow and catches up by hour 80; a Veteran starts quick
 * and levels off.
 */
export const ARCHETYPE_CURVE: Record<Archetype, { from: number; to: number; tau: number }> = {
  Grinder: { from: 1, to: 1, tau: 1 },
  Explorer: { from: 1, to: 1, tau: 1 },
  Socializer: { from: 1, to: 1, tau: 1 },
  Crafter: { from: 1, to: 1, tau: 1 },
  Trader: { from: 1, to: 1, tau: 1 },
  Roleplayer: { from: 1, to: 1, tau: 1 },
  Completionist: { from: 0.9, to: 1.2, tau: 60 },
  Casual: { from: 1, to: 0.7, tau: 60 },
  Newbie: { from: 0.25, to: 1.15, tau: 45 },
  Veteran: { from: 1.45, to: 0.9, tau: 30 },
};

/** The reference player's points in a focus skill: `scale * ln(1 + hours / halfHours)`, capped at 100. */
export const REFERENCE_PLAYER = { scale: 20, halfHours: 2 } as const;

/** One abstract tick is one in-game minute: 60 sim ticks (the 48 minute day is 24 in-game hours). */
export const ABSTRACT_TICKS = 60;

/** The most "while you were away" events a catch-up reports. */
export const AWAY_EVENTS_MAX = 6;

/** Share of gap days to count at most, so a very long absence does not run past the plateau logic. */
export const CATCHUP_DAYS_CAP = 3650;

/** Activity weights by archetype, over the things a Traveler can choose to do. */
export type Choice = 'gather' | 'fight' | 'craft' | 'trade' | 'social' | 'afk';
export const ACTIVITY_WEIGHTS: Record<Archetype, Record<Choice, number>> = {
  Grinder: { gather: 2, fight: 9, craft: 1, trade: 1, social: 2, afk: 1 },
  Explorer: { gather: 5, fight: 3, craft: 1, trade: 1, social: 2, afk: 1 },
  Socializer: { gather: 2, fight: 1, craft: 2, trade: 2, social: 9, afk: 1 },
  Crafter: { gather: 4, fight: 1, craft: 8, trade: 3, social: 2, afk: 1 },
  Trader: { gather: 2, fight: 1, craft: 2, trade: 8, social: 3, afk: 1 },
  Roleplayer: { gather: 1, fight: 2, craft: 1, trade: 1, social: 8, afk: 1 },
  Completionist: { gather: 4, fight: 4, craft: 3, trade: 1, social: 1, afk: 1 },
  Casual: { gather: 4, fight: 2, craft: 2, trade: 1, social: 4, afk: 3 },
  Newbie: { gather: 4, fight: 3, craft: 3, trade: 1, social: 3, afk: 1 },
  Veteran: { gather: 2, fight: 6, craft: 2, trade: 2, social: 3, afk: 1 },
};

/** Multipliers on the weights by day phase and by weather. A missing entry is 1. */
export const PHASE_FACTORS: Record<string, Partial<Record<Choice, number>>> = {
  dawn: { gather: 1.3, social: 0.7 },
  day: {},
  dusk: { social: 1.6, afk: 1.2 },
  night: { social: 1.5, fight: 0.7, gather: 0.6, afk: 1.8 },
};
export const WEATHER_FACTORS: Record<string, Partial<Record<Choice, number>>> = {
  rain: { gather: 0.4, fight: 0.5, craft: 1.5, social: 1.4 },
  storm: { gather: 0.2, fight: 0.3, craft: 1.6, social: 1.6 },
  snow: { gather: 0.4, fight: 0.5, craft: 1.4, social: 1.4 },
  fog: { fight: 0.7 },
};

/** Minutes an activity lasts before the next choice, as a range per choice. */
export const ACTIVITY_MINUTES: Record<Choice, readonly [number, number]> = {
  gather: [12, 40],
  fight: [15, 45],
  craft: [10, 30],
  trade: [4, 10],
  social: [10, 35],
  afk: [3, 12],
};

/** Minutes per outcome while working, and what it pays. */
export const OUTCOME = {
  /** One gather swing every this many minutes yields 1 to `gatherQty` items. */
  gatherEvery: 2,
  gatherQty: 2,
  /** One kill every this many minutes. Coin per kill by creature tier, a range. */
  fightEvery: 3,
  coinPerKill: [2, 6] as readonly [number, number],
  /** Chance per kill of dying, and the share of the purse it costs. */
  deathChance: 0.01,
  deathCoinPct: 5,
  /** One craft every this many minutes. */
  craftEvery: 3,
  /** Share of the shop's sell price a Traveler gets before the market exists. */
  sellPct: 100,
  /** Chance a Traveler that is short of an ingredient buys it, instead of gathering it. */
  buyInstead: 0.4,
  /** The most items a Traveler carries per item id. */
  stockCap: 60,
  /** A drop at or under this percent chance is notable and is reported. */
  notableDropPct: 50,
} as const;

/** Walking speed between places, in tiles per in-game minute (a minute is 2 real seconds). */
export const TRAVEL_TILES_PER_MINUTE = 9;
/** Minutes between places that have no spot yet, and the least a trip takes. */
export const TRAVEL_DEFAULT_MINUTES = 6;
export const TRAVEL_MIN_MINUTES = 1;

/** Where each gathering skill is worked. Place ids are from the people places table. */
export const GATHER_PLACES: Record<string, string> = {
  'skill.foraging': 'millbrook.fields',
  'skill.farming': 'millbrook.fields',
  'skill.mining': 'stonecrop.quarry',
  'skill.logging': 'cairnmoor.well',
  'skill.fishing': 'reedmouth.jetty',
};

/** The workshop of each station kind. */
export const STATION_PLACES: Record<string, string> = {
  'fixture.anvil': 'hearthford.smithy',
  'fixture.workbench': 'hearthford.carpentry',
  'fixture.loom': 'hearthford.tailor',
  'fixture.alchemy_table': 'hearthford.apothecary',
  'fixture.tinker_bench': 'hearthford.tinker_shed',
  'fixture.rune_stone': 'hearthford.rune_house',
  camp_pot: 'hearthford.inn',
  'fixture.oven': 'hearthford.inn',
};

/** Creature areas Travelers fight in, with the creature of each. Creature ids are from content. */
export const FIGHT_AREAS: readonly { place: string; creature: string }[] = [
  { place: 'millbrook.fields', creature: 'creature.grain_rat' },
  { place: 'millbrook.fields', creature: 'creature.meadow_hare' },
  { place: 'millbrook.fields', creature: 'creature.mossling' },
  { place: 'reedmouth.jetty', creature: 'creature.reed_crab' },
  { place: 'reedmouth.jetty', creature: 'creature.marsh_leech' },
  { place: 'stonecrop.quarry', creature: 'creature.rubblet' },
  { place: 'stonecrop.quarry', creature: 'creature.crag_hawk' },
  { place: 'cairnmoor.well', creature: 'creature.moorhound' },
  { place: 'cairnmoor.well', creature: 'creature.barrow_bones' },
];

/** Social places and their weights. */
export const SOCIAL_PLACES: readonly (readonly [string, number])[] = [
  ['hearthford.square', 5],
  ['hearthford.inn', 4],
  ['hearthford.market_street', 2],
];
/**
 * Camps (POW-M5-26): a rest point near town where the abstract sim may send a `social` or `afk`
 * choice at dusk and night. `chance` is the odds per such choice, by archetype. No camp choice is
 * made in the listed weather.
 */
export const CAMP = {
  places: ['wayside.river_camp', 'wayside.meadow_camp', 'wayside.woods_camp'] as readonly string[],
  phases: ['dusk', 'night'] as readonly string[],
  noWeather: ['rain', 'storm'] as readonly string[],
  /** The most Travelers bound for or at one camp, so it never drains the square of its crowd. */
  max: 5,
  chance: {
    Grinder: 0.05,
    Explorer: 0.45,
    Socializer: 0.2,
    Crafter: 0.05,
    Trader: 0.05,
    Roleplayer: 0.45,
    Completionist: 0.1,
    Casual: 0.5,
    Newbie: 0.2,
    Veteran: 0.1,
  } as Record<Archetype, number>,
} as const;
/**
 * Low-rank Travelers sometimes spend a social stretch in the guard yard, near the training dummy
 * (POW-M5-27). Odds per social choice, by archetype. Others never.
 */
export const YARD = {
  place: 'hearthford.guard_yard',
  chance: { Newbie: 0.3, Casual: 0.2 } as Partial<Record<Archetype, number>>,
} as const;
/** The tile south of the square's well, where wishes are made (POW-M5-27). It is open cobble. */
export const WELL_SPOT = { x: 185, y: 198 } as const;
/**
 * The Pit (POW-M5-29). Once the player has slid the crates aside (journal flag `flag.pit_open`), a
 * Traveler who likes a duel may spend a social stretch there: any bold Traveler, the members of The
 * Ninth Bell (guild 9) and the named duelists. `visitRadius` is how many tiles round the quarry
 * count as having been to the quarry for the rumors that point there.
 */
export const PIT = {
  place: 'stonecrop.pit',
  chance: 0.3,
  guilds: [9] as readonly number[],
  handles: ['NoScopeNed', 'Skarrow'] as readonly string[],
  visitPlace: 'stonecrop.quarry',
  visitRadius: 6,
  flags: {
    open: 'flag.pit_open',
    quarry: 'flag.quarry_seen',
    rumor1: 'flag.pit_rumor_1',
    rumor2: 'flag.pit_rumor_2',
    rumor3: 'flag.pit_rumor_3',
  },
} as const;
/** Travelers shop at Brin's counter (M5-14). */
export const TRADE_PLACE = 'hearthford.brin_shop';

/** Travelers as entities near the player (POW-M5-04). Speeds are sub-pixels per tick unless noted. */
export const ENTITY = {
  /** Most Travelers promoted at once. Past it the nearest win. */
  cap: 30,
  /** Ticks between promotion and demotion checks. */
  checkTicks: 30,
  /**
   * Walking pace: TRAVEL_TILES_PER_MINUTE tiles in an in-game minute (60 ticks), so a promoted
   * Traveler keeps the abstract clock's pace. 9 tiles of 16 px over 60 ticks is 2.4 px a tick.
   */
  speedSubPx: Math.round((TRAVEL_TILES_PER_MINUTE * 16 * 256) / ABSTRACT_TICKS),
  /** The chunk radius a Traveler is promoted inside, and the one it is demoted outside. */
  promoteRadius: 1,
  demoteRadius: 2,
  /** With no streaming window (tests, demos), promote within this many px of the avatar. */
  flatRangePx: 768,
  /** Ticks standing still before an idle Traveler shows AFK: two in-game minutes. */
  afkTicks: 120,
  /** Ticks AFK before a Traveler is shown asleep with a floating z: five in-game minutes (M5-31). */
  asleepTicks: 300,
  /** Ticks a login or logout shimmer lasts. */
  shimmerTicks: 24,
  /** Arrival tolerance at a goal, px. */
  arrivePx: 4,
  /** A trip's minutes left are only reset from the entity's position past this many minutes of difference. */
  etaSlackMinutes: 2,
  /** Ticks without progress before a walker gives up and stands. */
  stuckTicks: 90,
  /** A fighting Traveler looks for a creature within this many px, and swings inside `engagePx`. */
  seekPx: 220,
  /** Stats from the build (design/12: their build sets their numbers). */
  hpBase: 60,
  hpPerPoint: 1.2,
  defensePerPoints: 12,
} as const;

/**
 * What promoted Travelers do besides the main activity (POW-M5-14). Entity-layer randomness never
 * touches the sim's streams: it is a hash of the seed, the slot and the tick, so the crowd's
 * outcomes are the same on screen and off.
 */
export const BEHAVIOR = {
  /** Chance a Traveler who is socializing in the open dances, by day phase. */
  danceChance: { dawn: 0.02, day: 0.05, dusk: 0.3, night: 0.18 } as Record<string, number>,
  /** Chance per festival day on top (festivals arrive in M6; the hook is here). */
  festivalDanceBoost: 0.4,
  /** Ticks between emotes while standing about, as a range, and how long one shows. */
  emoteGapTicks: [900, 2700] as readonly [number, number],
  emoteTicks: 60,
  /** Relative odds of each emote. Sleep is only for a Traveler that is AFK. */
  emotes: { wave: 4, cheer: 2, bow: 1, laugh: 3 } as Record<string, number>,
  /** Friends and guildmates standing in the same place gather in a group of up to this many. */
  groupMax: 5,
  /** Radius of the ring a group stands in, px, and the gap a group keeps from its anchor. */
  groupRadiusPx: 16,
  /** Weather that sends Travelers who are only idling indoors. */
  shelterWeather: ['rain', 'storm', 'snow'] as readonly string[],
  /** Where they go, as weights. */
  shelterPlaces: [
    ['hearthford.inn', 6],
    ['hearthford.brin_shop', 1],
  ] as readonly (readonly [string, number])[],
  /** Factor on the social place a guild favors. */
  guildPlaceBias: 6,
  /** At night the inn pulls more of the social crowd. Factors on the social place weights. */
  nightPlaceFactor: { 'hearthford.inn': 3 } as Record<string, number>,
  /** Station kind to the doll's work animation. */
  stationAnim: {
    'fixture.anvil': 'work_swing',
    'fixture.workbench': 'work_hands',
    'fixture.loom': 'work_hands',
    'fixture.alchemy_table': 'work_stir',
    'fixture.tinker_bench': 'work_hands',
    'fixture.rune_stone': 'work_hands',
    camp_pot: 'work_stir',
    'fixture.oven': 'work_hands',
  } as Record<string, string>,
} as const;
