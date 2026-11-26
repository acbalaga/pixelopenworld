import type { MemoryKind, Temper } from '../travelers/types';

/**
 * Regard, friends and memory (POW-M5-06, design/12 section 5). Every number here is data.
 * Regard is a point total. Tiers: Stranger, Acquaintance at 20, Friend at 60, Close Friend at 140.
 */
export const REGARD = {
  tiers: [0, 20, 60, 140] as readonly number[],
  /** Points a memory event adds (or takes). */
  weights: {
    foughtNear: 4,
    partied: 10,
    helpedDown: 12,
    traded: 3,
    gifted: 15,
    duelWon: 2,
    duelLost: 2,
    stoodUp: -8,
    passedOnBoard: 1,
    answered: 5,
    ignoredRequest: -2,
  } as Record<MemoryKind, number>,
  /** Points lost per real day without contact, and the floor once Acquaintance has been reached. */
  decayPerDay: 1,
  floorOnceKnown: 20,
  /** The most points one Traveler can hold. */
  cap: 400,
  /** The same kind of memory with the same Traveler counts for regard once per real day. */
  oncePerDay: true,
} as const;

/** The friend rules. */
export const FRIENDS = {
  /** A Traveler asks the player to be friends from this many points, by temper (bold asks soonest). */
  askAt: { bold: 12, steady: 18, shy: 28 } as Record<Temper, number>,
  /** Chance per abstract minute that a Traveler who could ask does, while near the player. */
  askChance: 0.02,
  /** A request from the player is accepted from this many points, by temper. */
  acceptAt: { bold: 10, steady: 16, shy: 26 } as Record<Temper, number>,
  /** A friend request that is left unanswered lapses after this many real minutes. */
  lapseMin: 60 * 24,
  /** The most Traveler friends the player can have. */
  max: 40,
} as const;

/** Memory in the ring and on the profile card. */
export const MEMORY = {
  /** Distance in px within which a fight counts as "near" a promoted Traveler. */
  nearPx: 260,
  /** Distance in px within which a Traveler counts as having shared a chunk with the player. */
  contactPx: 420,
  /** A Traveler brings an earlier memory up in a line at most once per session, and not before this. */
  referenceAfterMin: 5,
  /** Entries the profile card lists. */
  cardEntries: 5,
} as const;
