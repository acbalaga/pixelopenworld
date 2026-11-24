import {
  FIXED_SESSIONS,
  SCHEDULE_SHAPES,
  type SessionShape,
} from '../../content/balance/travelers';
import { createStream, int } from '../kernel/rng';
import { identitiesOf } from './generate';
import type { TravelerIdentity } from './types';

/**
 * When Travelers are online (POW-M5-03, design/12 3.1). Everything works on real local time, which
 * reaches the sim as two inputs: trusted time in ms and the device's offset from UTC in minutes.
 * A Traveler's sessions on a real day are a pure function of the world seed, the slot and the day
 * index, so a reload never changes who is online.
 */

export const MIN_PER_DAY = 1440;

/** A stretch of real local time a Traveler is online, in minutes after midnight of its day. */
export interface Session {
  start: number;
  /** Exclusive. May pass 1440: the session runs into the next day. */
  end: number;
  /** Chat template id the Traveler says first this session, for pinned sessions only. */
  line?: string;
}

/** Local minutes since 1970-01-01 00:00 local, from trusted ms and the device offset in minutes. */
export function localMinute(trustedMs: number, tzOffsetMin: number): number {
  return Math.floor(trustedMs / 60_000) + tzOffsetMin;
}

/** Real day index of a local minute: days since 1970-01-01 local. */
export const dayIndexOf = (localMin: number): number => Math.floor(localMin / MIN_PER_DAY);

/** Day of the week for a day index: 0 Sunday to 6 Saturday (1970-01-01 was a Thursday). */
export const weekdayOf = (dayIndex: number): number => (((dayIndex + 4) % 7) + 7) % 7;

/** Minute of the week, 0 at Sunday 00:00 local. */
export const minuteOfWeek = (localMin: number): number => {
  const day = dayIndexOf(localMin);
  return weekdayOf(day) * MIN_PER_DAY + (localMin - day * MIN_PER_DAY);
};

const isWeekend = (dow: number): boolean => dow === 0 || dow === 6;

/**
 * Position of a Traveler among the others of its schedule shape, in phase order. Attendance and
 * skips are spread over the shape with a low-discrepancy sequence on this rank, so the share of a
 * shape that shows up on a day is its attendance within one Traveler, not a dice roll that swings
 * the online count by a dozen. Still a pure function of the seed, the slot and the day.
 */
const rankCache = new Map<number, number[]>();
function shapeRank(seed: number, t: TravelerIdentity): number {
  let ranks = rankCache.get(seed);
  if (!ranks) {
    const ids = identitiesOf(seed);
    const out: number[] = Array.from({ length: ids.length }, () => 0);
    for (const shape of new Set(ids.map((x) => x.schedule))) {
      // Ranked by phase shift, so whoever attends on a day is spread evenly over the shape's
      // timing and the online count does not lurch with the draw.
      const same = ids
        .filter((x) => x.schedule === shape)
        .sort((a, b) => a.phase - b.phase || a.slot - b.slot);
      same.forEach((x, i) => {
        out[x.slot] = i;
      });
    }
    ranks = out;
    if (rankCache.size >= 4) rankCache.delete(rankCache.keys().next().value as number);
    rankCache.set(seed, ranks);
  }
  return ranks[t.slot] ?? 0;
}

const frac = (x: number): number => x - Math.floor(x);
const PHI = 0.6180339887498949;
const PSI = 0.7548776662466927;

function dayStream(seed: number, slot: number, day: number) {
  const a = (seed ^ Math.imul(slot + 1, 0x9e3779b1)) >>> 0;
  return createStream((a ^ Math.imul(day + 0x10000, 0x85ebca6b)) >>> 0, 'travelers');
}

/**
 * The sessions a Traveler plays on a real day. Phase shift, per-session jitter, skip chance and
 * attendance come from the schedule shape and a stream seeded by (seed, slot, day), so the same
 * Traveler on the same day always gets the same sessions. Pinned sessions (the lore support) take
 * their exact times and are never skipped or jittered.
 */
export function sessionsFor(seed: number, t: TravelerIdentity, day: number): Session[] {
  const shape = SCHEDULE_SHAPES[t.schedule];
  const dow = weekdayOf(day);
  const weekend = isWeekend(dow);
  const r = dayStream(seed >>> 0, t.slot, day);
  const rank = shapeRank(seed >>> 0, t);
  const attends =
    frac(rank * PHI + day * 0.3819660112501051) < (weekend ? shape.attend[1] : shape.attend[0]);
  const onlyDay = 1 + (t.slot % 5);
  const out: Session[] = [];
  const base: readonly SessionShape[] = weekend ? shape.weekend : shape.weekday;
  base.forEach((s, i) => {
    const skipRoll = frac(rank * PSI + day * 0.5698402909980532 + i * 0.324717957244746);
    const dStart = int(r, -s.jitter, s.jitter);
    const dLen = int(r, -s.jitter, s.jitter);
    if (!attends) return;
    if (!weekend && shape.oneWeekday && dow !== onlyDay) return;
    if (!weekend && skipRoll < shape.skip) return;
    const start = Math.max(0, s.start + t.phase + dStart);
    const len = Math.max(15, s.len + dLen);
    out.push({ start, end: start + len });
  });
  for (const f of FIXED_SESSIONS[t.slot] ?? [])
    if (f.weekday === dow) out.push({ start: f.start, end: f.start + f.len, line: f.line });
  return out;
}

/** True if the Traveler is online at a local minute. Looks at today's sessions and last night's. */
export function isOnlineAt(seed: number, t: TravelerIdentity, localMin: number): boolean {
  const day = dayIndexOf(localMin);
  const m = localMin - day * MIN_PER_DAY;
  for (const s of sessionsFor(seed, t, day)) if (m >= s.start && m < s.end) return true;
  for (const s of sessionsFor(seed, t, day - 1))
    if (s.end > MIN_PER_DAY && m + MIN_PER_DAY >= s.start && m + MIN_PER_DAY < s.end) return true;
  return false;
}

/**
 * The session a Traveler is in at a local minute, or null. A pinned session (the lore support) wins
 * over an ordinary one that overlaps it, so its first line is not lost.
 */
export function sessionAt(seed: number, t: TravelerIdentity, localMin: number): Session | null {
  const day = dayIndexOf(localMin);
  const m = localMin - day * MIN_PER_DAY;
  const hits: Session[] = [];
  for (const s of sessionsFor(seed, t, day)) if (m >= s.start && m < s.end) hits.push(s);
  for (const s of sessionsFor(seed, t, day - 1))
    if (s.end > MIN_PER_DAY && m + MIN_PER_DAY >= s.start && m + MIN_PER_DAY < s.end)
      hits.push(
        s.line === undefined
          ? { start: s.start - MIN_PER_DAY, end: s.end - MIN_PER_DAY }
          : { start: s.start - MIN_PER_DAY, end: s.end - MIN_PER_DAY, line: s.line },
      );
  return hits.find((h) => h.line !== undefined) ?? hits[0] ?? null;
}
