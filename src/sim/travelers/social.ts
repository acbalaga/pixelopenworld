import { DUELS } from '../../content/balance/mail';
import { FRIENDS, MEMORY, REGARD } from '../../content/balance/social';
import { FLAG, MEMORY_KINDS, type MemoryKind } from '../../content/travelers/types';
import type { SimState } from '../state';
import { MIN_PER_DAY } from './schedule';
import { MEMORY_RING, type TravelerLife } from './types';

/**
 * Regard, memory and friends for Travelers (POW-M5-06, design/12 section 5, design/07 Friends). Pure
 * in its inputs: it reads and writes a `TravelerLife` and takes the real local minute as a
 * parameter, so no clock or random source is read here. Regard creates no value, so it has no ledger.
 *
 * `regardPts` is the point total. `regardTier` is kept equal to the tier of the total, so a reader
 * that only looks at the tier is right. `lastSeen` is the real local minute of the last contact,
 * and regard decays lazily from it: a day without contact costs `decayPerDay`, and once a
 * Traveler has been an Acquaintance their regard never falls below that.
 */

export const REGARD_TIER_NAMES = ['Stranger', 'Acquaintance', 'Friend', 'Close Friend'] as const;

/** The tier of a point total. */
export function tierOf(points: number): number {
  let t = 0;
  for (let i = 0; i < REGARD.tiers.length; i++) if (points >= (REGARD.tiers[i] as number)) t = i;
  return t;
}

/** Regard now: the stored points less the decay since the last contact. */
export function regardNow(life: TravelerLife, nowMin: number): number {
  if (life.regardPts <= 0) return 0;
  const days = Math.max(0, Math.floor((nowMin - life.lastSeen) / MIN_PER_DAY));
  const decayed = life.regardPts - days * REGARD.decayPerDay;
  const floor = life.regardPts >= REGARD.floorOnceKnown ? REGARD.floorOnceKnown : 0;
  return Math.max(floor, decayed);
}

/** Regard tier now (0 Stranger to 3 Close Friend). */
export const tierNow = (life: TravelerLife, nowMin: number): number =>
  tierOf(regardNow(life, nowMin));

const kindIdx = (k: MemoryKind): number => MEMORY_KINDS.indexOf(k);

/** Adds `points` to regard (after bringing it up to date) and marks contact. */
function addRegard(life: TravelerLife, points: number, nowMin: number): void {
  const base = regardNow(life, nowMin);
  life.regardPts = Math.max(0, Math.min(REGARD.cap, base + points));
  life.regardTier = tierOf(life.regardPts);
  life.lastSeen = nowMin;
  life.flags |= FLAG.met;
}

/**
 * Records a memory of the player. The ring keeps the newest MEMORY_RING entries. Regard moves by the
 * kind's weight, once per real day for the same kind (so grinding one thing cannot buy a friend).
 * Returns true if an entry was added.
 */
export function remember(
  life: TravelerLife,
  kind: MemoryKind,
  subject: number,
  day: number,
  nowMin: number,
): boolean {
  const k = kindIdx(kind);
  if (k < 0) return false;
  const same = life.memory.some((m) => m.kind === k && m.day === day);
  life.memory.push({ kind: k, subject, day });
  while (life.memory.length > MEMORY_RING) life.memory.shift();
  const weight = REGARD.weights[kind];
  if (!(REGARD.oncePerDay && same)) addRegard(life, weight, nowMin);
  else life.lastSeen = nowMin;
  return true;
}

/** True if the player and the Traveler are friends. */
export const isFriend = (life: TravelerLife): boolean => (life.flags & FLAG.friend) !== 0;

/** The slots of the player's friends. */
export function friendSlots(state: SimState): number[] {
  const out: number[] = [];
  state.travelers.forEach((l, i) => {
    if (isFriend(l)) out.push(i);
  });
  return out;
}

/** A Traveler who has shared activity and has enough regard could ask to be friends. */
export function canAsk(
  life: TravelerLife,
  temper: keyof typeof FRIENDS.askAt,
  nowMin: number,
): boolean {
  if (isFriend(life) || (life.flags & (FLAG.requestIn | FLAG.requestOut)) !== 0) return false;
  if ((life.flags & FLAG.muted) !== 0) return false;
  return life.memory.length > 0 && regardNow(life, nowMin) >= FRIENDS.askAt[temper];
}

/** Does a Traveler accept a request from the player? By regard and temper. */
export const wouldAccept = (
  life: TravelerLife,
  temper: keyof typeof FRIENDS.acceptAt,
  nowMin: number,
): boolean => regardNow(life, nowMin) >= FRIENDS.acceptAt[temper];

/** Makes the two friends (the player accepts, or a request is accepted). Marks contact. */
export function makeFriends(life: TravelerLife, nowMin: number): void {
  life.flags = (life.flags | FLAG.friend | FLAG.met) & ~(FLAG.requestIn | FLAG.requestOut);
  life.lastSeen = nowMin;
  life.regardPts = Math.max(life.regardPts, REGARD.tiers[2] as number);
  life.regardTier = tierOf(life.regardPts);
}

/** The newest `n` memory entries, newest first. */
export const recentMemory = (life: TravelerLife, n = MEMORY.cardEntries) =>
  life.memory.slice(-n).reverse();

/** Marks contact now: brings regard up to date (so the decay is paid) and restarts the clock. */
export function touch(life: TravelerLife, nowMin: number): void {
  life.regardPts = regardNow(life, nowMin);
  life.regardTier = tierOf(life.regardPts);
  life.lastSeen = nowMin;
}

/** Takes the friend flag off. Regard stays, so they remain an Acquaintance at least. */
export function removeFriend(life: TravelerLife): void {
  life.flags &= ~(FLAG.friend | FLAG.requestIn | FLAG.requestOut);
}

/**
 * A Rival flag from repeated close competition (design/12 section 5): duels count more than
 * passing on a board. Set when the score from the memory ring reaches the threshold, never taken
 * off, and it does not block friendship. Returns true if the flag was newly set.
 */
export function updateRival(life: TravelerLife): boolean {
  if ((life.flags & FLAG.rival) !== 0) return false;
  const duelKinds = [MEMORY_KINDS.indexOf('duelWon'), MEMORY_KINDS.indexOf('duelLost')];
  const pass = MEMORY_KINDS.indexOf('passedOnBoard');
  let score = 0;
  for (const m of life.memory) {
    if (duelKinds.includes(m.kind)) score += DUELS.rivalDuelPoints;
    else if (m.kind === pass) score += DUELS.rivalPassPoints;
  }
  if (score < DUELS.rivalAt) return false;
  life.flags |= FLAG.rival;
  return true;
}
