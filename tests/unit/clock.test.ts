import { describe, expect, it } from 'vitest';
import { TrustedClock, type ClockEnv, type ClockMemory } from '../../src/platform/clock';
import { worldTickAt } from '../../src/sim/time';
import { TIME } from '../../src/content/balance/time';

const H = 3_600_000;
const CAP = TIME.offlineCapBaseMs;

/** A fake device: `date` is the wall clock and can be moved, `perf` only moves forward. */
function device(date: number, server: number | null = null) {
  const d = { date, perf: 1000, server, latency: 0 };
  const env: ClockEnv = {
    dateNow: () => d.date,
    perfNow: () => d.perf,
    fetchServerTime: async () => {
      if (d.server === null) throw new Error('offline');
      d.perf += d.latency;
      return d.server;
    },
  };
  /** Real time passes for both clocks. */
  const wait = (ms: number): void => {
    d.date += ms;
    d.perf += ms;
    if (d.server !== null) d.server += ms;
  };
  return { d, env, wait };
}

describe('TrustedClock within a session', () => {
  it('moves by the monotonic clock, not the device clock', () => {
    const { d, env, wait } = device(1_000_000);
    const c = new TrustedClock(env);
    const t0 = c.trustedNow();
    wait(5000);
    d.date += 10 * H; // a forward jump of the device clock
    expect(c.trustedNow() - t0).toBe(5000);
    d.date -= 30 * H; // and a backward one
    expect(c.trustedNow() - t0).toBe(5000);
  });

  it('takes the server time on sync, and half the round trip into account', async () => {
    const { d, env } = device(1_000_000, 9_000_000);
    d.latency = 200;
    const c = new TrustedClock(env);
    expect(await c.sync()).toBe(true);
    expect(c.isSynced()).toBe(true);
    expect(c.trustedNow()).toBe(9_000_000 + 100);
  });

  it('a failed sync is silent and changes nothing', async () => {
    const { env } = device(1_000_000, null);
    const c = new TrustedClock(env);
    const t = c.trustedNow();
    expect(await c.sync()).toBe(false);
    expect(c.isSynced()).toBe(false);
    expect(c.trustedNow()).toBe(t);
  });

  it('ignores a garbage answer', async () => {
    const { d, env } = device(1_000_000, 0);
    const c = new TrustedClock(env);
    expect(await c.sync()).toBe(false);
    d.server = Number.NaN;
    expect(await c.sync()).toBe(false);
  });

  it('a later sync inside the noise does not move the world clock', async () => {
    const { d, env, wait } = device(1_000_000, 1_000_000);
    const c = new TrustedClock(env);
    await c.sync();
    wait(60_000);
    d.server = (d.server as number) + 500; // within the re-anchor window
    const before = c.trustedNow();
    await c.sync();
    expect(c.trustedNow()).toBe(before);
  });

  it('a later sync that finds us far off corrects the clock', async () => {
    const { d, env } = device(1_000_000, 1_000_000);
    const c = new TrustedClock(env);
    await c.sync();
    d.server = 1_000_000 + 30_000;
    await c.sync();
    expect(c.trustedNow()).toBe(1_030_000);
  });
});

describe('across sessions', () => {
  const mem = (over: Partial<ClockMemory> = {}): ClockMemory => ({
    lastTrustedNow: 5_000_000,
    offset: 0,
    accrualUsedMs: 0,
    ...over,
  });

  it('reports the time the game was closed, offline', () => {
    const { env } = device(5_000_000 + 2 * H);
    const c = new TrustedClock(env);
    c.load(mem());
    expect(c.elapsedSinceLastSession()).toBe(2 * H);
  });

  it('a device clock moved backwards gives zero elapsed and cannot rewind the world', () => {
    const { env } = device(5_000_000 - 3 * H);
    const c = new TrustedClock(env);
    c.load(mem());
    expect(c.elapsedSinceLastSession()).toBe(0);
    expect(c.trustedNow()).toBe(5_000_000);
  });

  it('applies the last known offset offline', () => {
    // The device clock ran 1 hour slow when last synced.
    const { env } = device(5_000_000 - H + H / 2);
    const c = new TrustedClock(env);
    c.load(mem({ offset: H }));
    expect(c.elapsedSinceLastSession()).toBe(H / 2);
  });

  it('a forward jump offline is bounded by the cap, then a sync puts the time right', async () => {
    const { d, env } = device(5_000_000 + 10 * 24 * H, 5_000_000 + H);
    const offline = new TrustedClock({
      ...env,
      fetchServerTime: async () => Promise.reject(new Error('x')),
    });
    offline.load(mem());
    expect(offline.elapsedSinceLastSession()).toBe(10 * 24 * H);
    expect(offline.claimOffline(CAP)).toBe(CAP);
    const saved = offline.snapshot();
    // Back online with a correct clock: the server wins, and the time falls back.
    d.date = 5_000_000 + 2 * H;
    const online = new TrustedClock(env);
    await online.sync();
    online.load(saved);
    expect(online.trustedNow()).toBeLessThan(saved.lastTrustedNow);
    expect(online.elapsedSinceLastSession()).toBe(0);
    expect(online.claimOffline(CAP)).toBe(0);
  });

  it('several offline sessions between syncs share one cap period', () => {
    const { d, env } = device(5_000_000);
    let memory = mem();
    const session = (gapMs: number): number => {
      d.date = memory.lastTrustedNow + gapMs;
      const c = new TrustedClock(env);
      c.load(memory);
      const got = c.claimOffline(CAP);
      memory = c.snapshot();
      return got;
    };
    expect(session(3 * H)).toBe(3 * H);
    expect(session(4 * H)).toBe(4 * H);
    expect(session(5 * H)).toBe(CAP - 7 * H); // only 1 hour of the cap is left
    expect(session(6 * H)).toBe(0);
    expect(memory.accrualUsedMs).toBe(CAP);
  });

  it('a week offline pays one cap period', () => {
    const { env } = device(5_000_000 + 7 * 24 * H);
    const c = new TrustedClock(env);
    c.load(mem());
    expect(c.claimOffline(CAP)).toBe(CAP);
    expect(c.claimOffline(CAP)).toBe(0); // an interval is taken once
  });

  it('a successful sync resets the budget', async () => {
    const { d, env } = device(5_000_000 + 9 * H, null);
    const c = new TrustedClock(env);
    c.load(mem({ accrualUsedMs: CAP }));
    expect(c.claimOffline(CAP)).toBe(0);
    d.server = 5_000_000 + 9 * H;
    await c.sync();
    expect(c.snapshot().accrualUsedMs).toBe(0);
  });

  it('a boot sync before load measures the gap against server time, not a forward clock', async () => {
    const { d, env } = device(5_000_000 + 30 * H, 5_000_000 + 1 * H);
    const c = new TrustedClock(env);
    await c.sync();
    c.load(mem());
    expect(d.date).toBeGreaterThan(c.trustedNow());
    expect(c.elapsedSinceLastSession()).toBe(1 * H);
  });

  it('no save: the clock just runs', () => {
    const { env, wait } = device(5_000_000);
    const c = new TrustedClock(env);
    c.load(null);
    wait(1000);
    expect(c.elapsedSinceLastSession()).toBe(0);
    expect(c.snapshot().lastTrustedNow).toBe(5_001_000);
  });
});

describe('the world clock', () => {
  const m = TIME.ticksPerMinute;
  it('counts ticks of in-game time since the epoch', () => {
    expect(worldTickAt(10_000, 10_000)).toBe(0);
    expect(worldTickAt(10_000 + 60_000, 10_000)).toBe(m);
    expect(worldTickAt(10_000 + 48 * 60_000, 10_000)).toBe(48 * m);
  });
  it('is zero before the epoch', () => {
    expect(worldTickAt(5, 10_000)).toBe(0);
  });
  it('continues across a reload and across an offline period', () => {
    const epoch = 1_000_000;
    const { env, d } = device(epoch);
    const a = new TrustedClock(env);
    a.load(null);
    d.perf += 10 * 60_000;
    d.date += 10 * 60_000;
    const before = worldTickAt(a.trustedNow(), epoch);
    const saved = a.snapshot();
    // Closed for 20 minutes, then reopened.
    d.date += 20 * 60_000;
    const b = new TrustedClock(env);
    b.load(saved);
    expect(worldTickAt(b.trustedNow(), epoch) - before).toBe(20 * m);
  });
});
