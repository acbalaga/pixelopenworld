import {
  ARCHETYPE_CURVE,
  AWAY_EVENTS_MAX,
  CATCHUP_DAYS_CAP,
  PROGRESS,
  REFERENCE_PLAYER,
  START_BASE,
} from '../../content/balance/travelers';
import type { TravelerAway } from '../kernel/events';
import { identitiesOf } from './generate';
import { skillIdx } from './lists';
import type { TravelerIdentity, TravelerLife } from './types';

/**
 * How Travelers progress (POW-M5-03, design/12 3.4). A skill's expected points are a formula of
 * the save's play hours and real days. Abstract activity nudges a build toward it and never far
 * past it, and a login catches every build up to it in one pass, with no tick replay.
 */

const curve = (t: TravelerIdentity, hours: number): number => {
  const c = ARCHETYPE_CURVE[t.archetype];
  const x = hours / c.tau;
  return c.to + (c.from - c.to) * Math.exp(-(x * x));
};

/**
 * Expected points in a Traveler's `k`th focus skill after `playHours` of play and `realDays` since
 * the save began. At zero it is the starting value. Whole points.
 */
export function expectedPoints(
  t: TravelerIdentity,
  k: number,
  playHours: number,
  realDays: number,
): number {
  const fall = PROGRESS.focusFalloff ** k;
  const days = Math.min(Math.max(realDays, 0), CATCHUP_DAYS_CAP);
  const grown =
    t.pace *
    (PROGRESS.pointsPerHour * Math.max(playHours, 0) + PROGRESS.pointsPerRealDay * days) *
    curve(t, Math.max(playHours, 0));
  return Math.round(Math.min(t.plateau, START_BASE[t.archetype] + grown) * fall);
}

/** Expected purse after the same time. A Traveler's coin never runs past it by more than the cap. */
export function expectedCoin(
  t: TravelerIdentity,
  playHours: number,
  realDays: number,
  startCoin: number,
): number {
  const earned =
    t.pace *
    (PROGRESS.coinPerHour[t.archetype] * Math.max(playHours, 0) +
      PROGRESS.coinPerRealDay * Math.min(Math.max(realDays, 0), CATCHUP_DAYS_CAP));
  return Math.min(PROGRESS.coinCap, Math.round(startCoin + earned));
}

/** The reference player's points in a focus skill after `playHours`. The Travelers' yardstick. */
export function referencePoints(playHours: number): number {
  return Math.min(
    100,
    REFERENCE_PLAYER.scale * Math.log(1 + Math.max(playHours, 0) / REFERENCE_PLAYER.halfHours),
  );
}

/** Play hours of a save from its sim tick (30 ticks a second). */
export const playHoursOf = (tick: number): number => tick / (30 * 3600);

/** The most a build point may be: expected plus the band. The integrity rule uses it. */
export const buildCeiling = (expected: number): number => expected + PROGRESS.band;

/** What a catch-up reports: a change worth telling the player about. */
export type AwayEvent = TravelerAway;

/**
 * Brings every life up to its expected value for the elapsed time in one pass: builds, then coin,
 * then a place. Returns at most {@link AWAY_EVENTS_MAX} events, the largest rank-ups first. Pure in
 * the lives, the seed and the time inputs. It only ever raises a build or a purse.
 */
export function catchUp(
  seed: number,
  lives: TravelerLife[],
  playHours: number,
  realDays: number,
): AwayEvent[] {
  const ids = identitiesOf(seed);
  const found: (AwayEvent & { weight: number })[] = [];
  for (const t of ids) {
    const life = lives[t.slot];
    if (!life) continue;
    t.focus.forEach((skill, k) => {
      const i = skillIdx(skill);
      if (i < 0) return;
      const want = expectedPoints(t, k, playHours, realDays);
      const at = life.build.findIndex(([s]) => s === i);
      const have = at < 0 ? 0 : life.build[at]![1];
      if (want <= have) return;
      if (at < 0) {
        life.build.push([i, want]);
        life.build.sort((a, b) => a[0] - b[0]);
      } else life.build[at]![1] = want;
      const ranksBefore = Math.floor(have / PROGRESS.pointsPerRank);
      const ranksAfter = Math.floor(want / PROGRESS.pointsPerRank);
      if (ranksAfter > ranksBefore)
        found.push({
          kind: 'rankUp',
          slot: t.slot,
          skill,
          rank: ranksAfter * PROGRESS.pointsPerRank,
          weight: want - have,
        });
    });
    const coinWant = expectedCoin(t, playHours, realDays, 0);
    if (coinWant > life.coin) {
      const gain = coinWant - life.coin;
      life.coin = coinWant;
      if (gain >= 500) found.push({ kind: 'coin', slot: t.slot, gain, weight: gain / 100 });
    }
  }
  found.sort((a, b) => b.weight - a.weight || a.slot - b.slot);
  return found.slice(0, AWAY_EVENTS_MAX).map((f): AwayEvent => {
    const { weight, ...e } = f;
    void weight;
    return e as AwayEvent;
  });
}
