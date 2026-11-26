/**
 * Shared ids for Travelers (POW-M5-02, design/12). Plain data: the sim, the chat engine and the
 * content validator all read these lists, so an index into one is stable. Add new entries at the
 * end of a list, never in the middle, because lives are saved as indexes into them.
 */

export const ARCHETYPES = [
  'Grinder',
  'Explorer',
  'Socializer',
  'Crafter',
  'Trader',
  'Roleplayer',
  'Completionist',
  'Casual',
  'Newbie',
  'Veteran',
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const SCHEDULE_IDS = [
  'student',
  'office',
  'early',
  'nightshift',
  'parent',
  'lunch',
  'retiree',
  'weekend',
  'nightowl',
  'always',
] as const;
export type ScheduleId = (typeof SCHEDULE_IDS)[number];

/** The sixteen chat voices (design/12 4.3). The transforms for each are in `content/chat/voices`. */
export const VOICE_IDS = [
  'terse',
  'chatty',
  'formal',
  'jokey',
  'lowercase',
  'glyphy',
  'shouty',
  'kind',
  'dry',
  'nerdy',
  'roleplay',
  'newbie',
  'veteran',
  'merchant',
  'sleepy',
  'excitable',
] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

export const TEMPERS = ['bold', 'steady', 'shy'] as const;
export type Temper = (typeof TEMPERS)[number];

export const TIE_KINDS = ['friend', 'sibling', 'rival', 'mentor'] as const;
export type TieKind = (typeof TIE_KINDS)[number];

/** A standing relationship with another Traveler. `lead` marks the mentor of a `mentor` tie. */
export interface Tie {
  slot: number;
  kind: TieKind;
  lead?: boolean;
  /** The tie starts to show once the player has this many play hours (the Tobo and Marrow arc). */
  fromHour?: number;
}

/** What a Traveler is doing (design/12 3.2). Saved as the index into this list. */
export const ACTIVITIES = [
  'travel',
  'gather',
  'fight',
  'craft',
  'trade',
  'social',
  'afk',
  'party',
  'dungeon',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** The eight regions by id (design/02). Until a region is baked its Travelers play in Dawnmeadow (D25). */
export const REGION_NAMES = [
  'Dawnmeadow',
  'Whisperwood',
  'Saltreach',
  'Ironvale',
  'Sunken Mire',
  'Frostspine',
  'Glass Desert',
  'The Crown',
] as const;

/** The doll look fields a hand-tuned Traveler pins. The rest of the look comes from the generator. */
export interface LookPin {
  hair: string;
  hairColor: string;
}

/** One hand-tuned Traveler (design/12 section 6). */
export interface HandTunedDef {
  slot: number;
  handle: string;
  archetype: Archetype;
  voice: VoiceId;
  schedule: ScheduleId;
  /** Region id 1 to 8. */
  home: number;
  /** Guild id 1 to 12, or 0 for none. */
  guild: number;
  focus: readonly string[];
  look: LookPin;
  ties: readonly Tie[];
  temper: Temper;
  /** Overrides for the few Travelers whose arc is part of who they are. */
  pace?: number;
  plateau?: number;
  /** Design note, kept for the people who read the data. Never shown in game. */
  note: string;
}

/** One guild (design/12 section 7). */
export interface GuildDef {
  id: number;
  name: string;
  culture: string;
  tone: string;
  /** Region id of its home. */
  home: number;
  /** Place id of its hall once built, or null while it meets in the Hearthford inn's back room. */
  hall: string | null;
  joinsBy: string;
  voices: readonly VoiceId[];
}

/**
 * What a Traveler can remember about the player (design/12 section 5). A memory entry stores the
 * index into this list. Add new kinds at the end: lives are saved as indexes (POW-M5-06).
 */
export const MEMORY_KINDS = [
  'foughtNear',
  'partied',
  'helpedDown',
  'traded',
  'gifted',
  'duelWon',
  'duelLost',
  'stoodUp',
  'passedOnBoard',
  'answered',
  'ignoredRequest',
] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** Bits of a Traveler's `flags` (POW-M5-06). `met` was already read at bit 5 by the profile card. */
export const FLAG = {
  friend: 1 << 0,
  rival: 1 << 1,
  /** They have asked the player to be friends and wait for an answer. */
  requestIn: 1 << 2,
  inParty: 1 << 3,
  muted: 1 << 4,
  met: 1 << 5,
  /** The player has asked them and has not had an answer. */
  requestOut: 1 << 6,
} as const;
