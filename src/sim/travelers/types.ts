import type { DollSpec } from '../../content/dolls/parts';
import type { Archetype, ScheduleId, Temper, Tie, VoiceId } from '../../content/travelers/types';

/**
 * A Traveler is two halves (design/12 section 1). The identity is derived from the world seed and
 * the slot every time a save loads, so it costs nothing in the save. The life is what has happened
 * since, and it is saved. Slots 0 to 23 are hand-tuned, the rest are generated.
 */
export interface TravelerIdentity {
  /** 0 to 239. Stable for the life of the save. */
  slot: number;
  handle: string;
  look: DollSpec;
  archetype: Archetype;
  /** 2 to 4 skill ids. */
  focus: readonly string[];
  voice: VoiceId;
  schedule: ScheduleId;
  /** Minutes the Traveler's own schedule is shifted from its shape, -40 to 40. */
  phase: number;
  /** Region id 1 to 8 they will live in once it is baked. Until then they play in Dawnmeadow (D25). */
  home: number;
  /** Initial guild id 1 to 12, or 0 for none. */
  guild: number;
  /** Progress multiplier against the reference player, 0.6 to 1.6. */
  pace: number;
  temper: Temper;
  /** Skill points where progress flattens. */
  plateau: number;
  /** Up to three standing ties to other slots. */
  ties: readonly Tie[];
}

/** One thing the player did near or with a Traveler (design/12 section 5). */
export interface MemoryEntry {
  kind: number;
  subject: number;
  day: number;
}

/** What has happened to a Traveler since the save began. Plain data, saved as bytes. */
export interface TravelerLife {
  /** Sparse build: (index into the skill list, points), ascending by index, no zero entries. */
  build: [number, number][];
  /** Earned Paths, as a bitset over the Paths list. */
  paths: number;
  coin: number;
  /** Index into `PLACE_LIST`. Where they are when online, last place when offline. */
  place: number;
  /** Index into `ACTIVITIES` and its subject. */
  activity: number;
  subject: number;
  /** Current guild id, 0 for none. May differ from the identity's initial guild. */
  guild: number;
  /** Regard tier 0 to 3 (Stranger, Acquaintance, Friend, Close Friend) and points toward the next. */
  regardTier: number;
  regardPts: number;
  /** Friend, rival, pending request, in party, muted, met (bit order is M5-06's to define). */
  flags: number;
  /** A ring of at most 24 entries, oldest first. */
  memory: MemoryEntry[];
  /** In-game minute the Traveler and the player last shared a chunk. */
  lastSeen: number;
  /** Variety control state for chat (design/12 4.4). */
  lineCursor: number;
}

/** The most memory entries a life keeps. */
export const MEMORY_RING = 24;
