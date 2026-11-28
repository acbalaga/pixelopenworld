import { FISHING as F } from '../../src/content/balance/fishing';
import { bandWidth, newFight, reelStep } from '../../src/sim/fishing';
import type { Command } from '../../src/sim/kernel/commands';
import { createDemoState, type SimState } from '../../src/sim/state';

/** One fish for each difficulty, so a fight of a given difficulty picks its pull and band from data. */
export const FISH_OF_DIFFICULTY: Readonly<Record<number, string>> = {
  1: 'item.fish_river',
  2: 'item.fish_trout',
  3: 'item.fish_tench',
  4: 'item.fish_sea_bass',
  5: 'item.old_gnarl',
};

/**
 * A scripted player for the fight (POW-M6-05). It sees the marker `lag` ticks late, holds when the
 * marker it saw, pushed on by its speed, is below the band's centre, and lets go otherwise. A bot
 * with a bigger lag is a slower thumb. Returns true if the fish was landed.
 */
export function fight(
  seed: number,
  difficulty: number,
  lag: number,
  opts: { tier?: number; patient?: boolean } = {},
): boolean {
  const s = createDemoState(seed, 0);
  const f = newFight(false);
  f.item = FISH_OF_DIFFICULTY[difficulty] as string;
  f.phase = 'reel';
  f.band = bandWidth(difficulty, opts.tier ?? 1, opts.patient === true);
  const seen: { m: number; v: number }[] = [];
  for (let i = 0; i < F.maxReelTicks + 5; i++) {
    const o = seen[Math.max(0, seen.length - 1 - lag)] ?? { m: f.m, v: f.v };
    f.hold = o.m + o.v * F.bot.lead < F.center;
    const r = reelStep(s, f);
    seen.push({ m: f.m, v: f.v });
    if (r) return r === 'landed';
  }
  return false;
}

/** The share of `n` fights landed, in percent, over seeds 1 to n. */
export function rate(difficulty: number, lag: number, n = 300, opts = {}): number {
  let won = 0;
  for (let i = 1; i <= n; i++) if (fight(i, difficulty, lag, opts)) won++;
  return (100 * won) / n;
}

/**
 * Plays a cast already begun through the real sim loop: taps the bite, holds the line by the same
 * rule as `fight`, and stops when the cast ends (landed or lost). `tick` steps one sim tick with
 * the commands it is given. Returns the number of ticks played.
 */
export function playCast(
  s: SimState,
  me: number,
  tick: (...c: Command[]) => void,
  limit = 1200,
): number {
  let n = 0;
  while (s.entities.comps.gather[me] && n < limit) {
    const f = s.entities.comps.gather[me]?.fish;
    if (f?.phase === 'bite') tick({ type: 'interact' });
    else if (f?.phase === 'reel')
      tick({ type: 'reel', on: f.m + f.v * F.bot.lead < F.center });
    else tick();
    n++;
  }
  return n;
}
