import { RANKINGS } from '../../content/balance/rankings';
import { CREATURES } from '../../content/creatures';
import { SKILLS } from '../../content/skills';
import type { Archetype } from '../../content/travelers/types';
import { identitiesOf } from '../travelers/generate';
import { SKILL_LIST } from '../travelers/lists';
import type { TravelerIdentity, TravelerLife } from '../travelers/types';

/**
 * Rankings (POW-M5-09, design/07 Rankings, design/12 3.4). Pure: a board is a sort of the Travelers'
 * values and the player's, computed from lives and the player's facts and never saved. A tie goes to
 * the Traveler, so the player must pass a Traveler to stand above them.
 */

/** The boards that are not skills. Duels and festivals are empty until their tickets (M5-12, M6). */
export const OTHER_BOARDS = [
  'wealth',
  'bestiary',
  'map',
  'fishing',
  'duels',
  'festivals',
  'renown',
] as const;
export type OtherBoard = (typeof OTHER_BOARDS)[number];
/** A board id: a skill id (`skill.fishing`) or one of the others. */
export type BoardId = string;

export const isSkillBoard = (b: BoardId): boolean => b.startsWith('skill.');

/** Every board, skills first in content order. */
export const ALL_BOARDS: readonly BoardId[] = [...Object.keys(SKILLS), ...OTHER_BOARDS];

/** What the player brings to a board. The caller reads these from the sim state and the map. */
export interface PlayerFacts {
  handle: string;
  /** Points by skill id. */
  points: Readonly<Record<string, number>>;
  coin: number;
  /** Creatures in the Bestiary. */
  bestiary: number;
  /** Percent of the map uncovered, 0 to 100. */
  mapPercent: number;
  /** Fish landed, in total. */
  fishLanded: number;
}

export interface BoardRow {
  /** The Traveler's slot, or null for the player. */
  slot: number | null;
  handle: string;
  value: number;
  /** 1 for the top. */
  rank: number;
}

export interface Board {
  id: BoardId;
  /** Every placed row, best first. The player is in it when they have a value above zero. */
  rows: readonly BoardRow[];
  /** The player's rank, or null when they have no value on this board. */
  playerRank: number | null;
  /** The player's value on this board. */
  playerValue: number;
}

const BESTIARY_ENTRIES = Object.keys(CREATURES).filter((c) => !c.endsWith('training_dummy')).length;
const pointsIn = (life: TravelerLife, skill: string): number => {
  const i = SKILL_LIST.indexOf(skill);
  if (i < 0) return 0;
  for (const [s, p] of life.build) if (s === i) return p;
  return 0;
};
const totalPoints = (life: TravelerLife): number => life.build.reduce((a, [, p]) => a + p, 0);

/** The value a Traveler has on a board, from their life and identity. Whole numbers. */
export function travelerValue(board: BoardId, t: TravelerIdentity, life: TravelerLife): number {
  if (isSkillBoard(board)) return pointsIn(life, board);
  const arch: Archetype = t.archetype;
  const R = RANKINGS;
  switch (board) {
    case 'wealth':
      return life.coin;
    case 'bestiary':
      return Math.min(
        Math.floor(BESTIARY_ENTRIES * R.travelerCap),
        Math.round(totalPoints(life) * R.bestiaryPerPoint[arch]),
      );
    case 'map':
      return Math.min(
        Math.floor(100 * R.travelerCap),
        Math.round(totalPoints(life) * R.mapPerPoint[arch]),
      );
    case 'fishing':
      return Math.round(pointsIn(life, 'skill.fishing') * R.fishPerPoint);
    case 'renown':
      return renownOf(totalPoints(life), travelerValue('bestiary', t, life), life.coin);
    default:
      return 0;
  }
}

function renownOf(points: number, bestiary: number, coin: number): number {
  const R = RANKINGS.renown;
  return Math.floor(points / R.pointsPer) + bestiary + Math.floor(coin / R.coinPer);
}

/** The value the player has on a board. */
export function playerValue(board: BoardId, f: PlayerFacts): number {
  if (isSkillBoard(board)) return f.points[board] ?? 0;
  switch (board) {
    case 'wealth':
      return f.coin;
    case 'bestiary':
      return f.bestiary;
    case 'map':
      return f.mapPercent;
    case 'fishing':
      return f.fishLanded;
    case 'renown':
      return renownOf(
        Object.values(f.points).reduce((a, b) => a + b, 0),
        f.bestiary,
        f.coin,
      );
    default:
      return 0;
  }
}

/**
 * One board: the Travelers with a value above zero and the player, best first. Ties go to the
 * lower slot, and the player stands below every Traveler of equal value.
 */
export function computeBoard(
  board: BoardId,
  seed: number,
  lives: readonly TravelerLife[],
  facts: PlayerFacts,
): Board {
  const ids = identitiesOf(seed);
  const entries: { slot: number | null; handle: string; value: number }[] = [];
  for (const t of ids) {
    const life = lives[t.slot];
    if (!life) continue;
    const value = travelerValue(board, t, life);
    if (value > 0) entries.push({ slot: t.slot, handle: t.handle, value });
  }
  const mine = playerValue(board, facts);
  if (mine > 0) entries.push({ slot: null, handle: facts.handle, value: mine });
  entries.sort((a, b) => {
    if (a.value !== b.value) return b.value - a.value;
    if ((a.slot === null) !== (b.slot === null)) return a.slot === null ? 1 : -1;
    return (a.slot ?? 0) - (b.slot ?? 0);
  });
  const rows = entries.map((e, i) => ({ ...e, rank: i + 1 }));
  const me = rows.find((r) => r.slot === null);
  return { id: board, rows, playerRank: me?.rank ?? null, playerValue: mine };
}

/** A board has something to show: a Traveler or the player stands on it. */
export const boardIsLive = (b: Board): boolean => b.rows.length > 0;

/**
 * The Travelers the player has newly passed on a board: they stood above the player before (a
 * player with no value stands below everyone) and stand below now, and they are among the top `n`
 * Travelers of the board.
 */
export function passedBetween(prev: Board | null, next: Board, n: number): number[] {
  if (next.playerRank === null) return [];
  const above = (b: Board | null, slot: number): boolean => {
    if (b === null || b.playerRank === null) return true;
    const r = b.rows.find((x) => x.slot === slot);
    return r !== undefined && r.rank < b.playerRank;
  };
  const out: number[] = [];
  let place = 0;
  for (const r of next.rows) {
    if (r.slot === null) continue;
    place++;
    if (place > n) break;
    if (r.rank > next.playerRank && above(prev, r.slot)) out.push(r.slot);
  }
  return out;
}
