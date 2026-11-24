/**
 * Trusted time (tech/02 "Trusted time", threat T6). The only module that reads the device clock.
 * A lint rule bans `Date.now()` and `new Date()` everywhere else under `src/`.
 *
 * The rules:
 * - While the page is alive, time advances by `performance.now()` (monotonic), never by `Date`.
 *   Moving the device clock mid-session changes nothing.
 * - When the server answers `/api/time`, its time wins. The game keeps working when it does not.
 * - Across sessions with no sync, `trustedNow = max(lastTrustedNow, Date.now() + lastOffset)`. A
 *   clock that went backwards gives zero elapsed.
 * - Offline accrual (M7 settlement) is budgeted: at most one cap period in total between two
 *   successful syncs, however many sessions there are. A week offline pays one cap.
 */

import { TIME } from '../content/balance/time';

/** What the clock needs from the outside world. Tests pass fakes. */
export interface ClockEnv {
  /** Device wall clock, ms. The one place this is read. */
  dateNow(): number;
  /** Monotonic ms. */
  perfNow(): number;
  /** Server epoch ms from `/api/time`. Rejects or resolves to a non-finite number on failure. */
  fetchServerTime(): Promise<number>;
}

/** What a save keeps so the next session can pick the clock up. Part of the save (schema 5). */
export interface ClockMemory {
  /** Trusted ms at the last commit. */
  lastTrustedNow: number;
  /** `serverTime - Date.now()` at the last successful sync, ms. 0 if never synced. */
  offset: number;
  /** Offline accrual used since the last successful sync, ms. */
  accrualUsedMs: number;
}

/**
 * The device keeps its own copy of the clock memory, outside any save (tech/02 T5). Restoring an
 * older save or importing an older export therefore cannot hand back time or budget already
 * taken: the later trusted time wins, and so does the larger budget used. (A successful sync
 * resets the budget in any case.)
 */
export function mergeClockMemory(
  save: ClockMemory | null,
  device: ClockMemory | null,
): ClockMemory | null {
  if (!save || !device) return save ?? device;
  const later = save.lastTrustedNow >= device.lastTrustedNow ? save : device;
  return {
    lastTrustedNow: later.lastTrustedNow,
    offset: later.offset,
    accrualUsedMs: Math.max(save.accrualUsedMs, device.accrualUsedMs),
  };
}

const DEVICE_KEY = 'pow.clock';

/** Reads the device copy. Missing, blocked or malformed storage gives null. */
export function readDeviceClock(): ClockMemory | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as Record<string, unknown>;
    const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    if (!ok(m.lastTrustedNow) || !ok(m.offset) || !ok(m.accrualUsedMs) || m.accrualUsedMs < 0)
      return null;
    return { lastTrustedNow: m.lastTrustedNow, offset: m.offset, accrualUsedMs: m.accrualUsedMs };
  } catch {
    return null;
  }
}

/** Writes the device copy. Storage that is full or blocked is ignored. */
export function writeDeviceClock(m: ClockMemory): void {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(m));
  } catch {
    // The save still carries the same record.
  }
}

/** A server answer further than this from our own trusted time re-anchors a running session. */
const REANCHOR_MS = 2000;

export class TrustedClock {
  private anchorTrusted: number;
  private anchorPerf: number;
  private offset = 0;
  private used = 0;
  private synced = false;
  private sinceLast = 0;

  constructor(private readonly env: ClockEnv) {
    this.anchorTrusted = env.dateNow();
    this.anchorPerf = env.perfNow();
  }

  /** Trusted ms now. Monotonic within a session. */
  trustedNow(): number {
    return this.anchorTrusted + (this.env.perfNow() - this.anchorPerf);
  }

  /** True once a time sync has succeeded this session. */
  isSynced(): boolean {
    return this.synced;
  }

  /**
   * Asks the server. Returns true on success. Failure is normal and silent: offline, blocked, or
   * a bad answer. A success resets the offline accrual budget.
   */
  async sync(): Promise<boolean> {
    const t0 = this.env.perfNow();
    let server: number;
    try {
      server = await this.env.fetchServerTime();
    } catch {
      return false;
    }
    if (!Number.isFinite(server) || server <= 0) return false;
    const t1 = this.env.perfNow();
    // Half the round trip is the one-way delay.
    const atServer = server + Math.max(0, t1 - t0) / 2;
    // Compare with our own sense of now at the instant the answer lands.
    const ours = this.trustedNow();
    if (!this.synced || Math.abs(atServer - ours) > REANCHOR_MS) {
      this.anchorTrusted = atServer;
      this.anchorPerf = t1;
    }
    this.offset = atServer - this.env.dateNow();
    this.synced = true;
    this.used = 0;
    return true;
  }

  /**
   * Picks the clock up from a save. Call it once, after the boot sync has settled. Works out how
   * long the game was closed: from the saved trusted time to now, zero if the clock went back.
   * With no sync this session, `trustedNow` is the later of the saved time and the device clock
   * plus the last known offset, so a clock set backwards cannot rewind the world.
   */
  load(memory: ClockMemory | null): void {
    if (!memory) {
      this.sinceLast = 0;
      return;
    }
    if (!this.synced) {
      this.offset = memory.offset;
      this.used = memory.accrualUsedMs;
      this.anchorTrusted = Math.max(memory.lastTrustedNow, this.env.dateNow() + memory.offset);
      this.anchorPerf = this.env.perfNow();
    }
    this.sinceLast = Math.max(0, this.trustedNow() - memory.lastTrustedNow);
  }

  /** Ms the game was closed for, as of {@link load}. Unbudgeted: see {@link claimOffline}. */
  elapsedSinceLastSession(): number {
    return this.sinceLast;
  }

  /**
   * Takes offline time for settlement: the elapsed time, limited to `capMs` less what earlier
   * sessions already took since the last sync. Each interval is taken once.
   */
  claimOffline(capMs: number = TIME.offlineCapBaseMs): number {
    const grant = Math.max(0, Math.min(this.sinceLast, capMs - this.used));
    this.used += grant;
    this.sinceLast = 0;
    return grant;
  }

  /** What to store in the save. */
  snapshot(): ClockMemory {
    return { lastTrustedNow: this.trustedNow(), offset: this.offset, accrualUsedMs: this.used };
  }
}

/** The device clock, for the few callers that must stamp something before a clock exists. */
export const wallNow = (): number => Date.now();

/** A date for display (file names). Built from a trusted ms value, never from the device. */
export const dateAt = (ms: number): Date => new Date(ms);

/**
 * Minutes the device's local time is ahead of UTC at a trusted time (M5-03). The Travelers' schedules
 * run on real local time, so the platform hands the sim this next to trusted time. Reads the
 * device's time zone through `Date`, the one place it is read.
 */
export const deviceTzOffsetMin = (ms: number): number => -new Date(ms).getTimezoneOffset() || 0;

/** The real environment: the device clock, `performance`, and `GET /api/time` with a timeout. */
export function browserClockEnv(timeoutMs = 2500): ClockEnv {
  return {
    dateNow: () => Date.now(),
    perfNow: () => performance.now(),
    fetchServerTime: async () => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetch('/api/time', { cache: 'no-store', signal: ctl.signal });
        if (!res.ok) return NaN;
        const body = (await res.json()) as { now?: unknown };
        return typeof body.now === 'number' ? body.now : NaN;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
