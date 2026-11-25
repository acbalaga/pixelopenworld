import { RANKINGS } from '../../content/balance/rankings';
import { SKILLS } from '../../content/skills';
import { RANKING_STRINGS as S } from '../../content/strings/rankings';
import {
  ALL_BOARDS,
  OTHER_BOARDS,
  computeBoard,
  isSkillBoard,
  type Board,
  type BoardId,
} from '../../sim/rankings/boards';
import { factsOf } from '../../sim/rankings/system';
import type { SimState } from '../../sim/state';

/** The words for a board, in the player's terms. */
export function boardName(id: BoardId): string {
  if (isSkillBoard(id)) return SKILLS[id]?.name ?? id;
  return S.boards[id as keyof typeof S.boards] ?? id;
}

/** The unit after a value on a board. */
export function boardUnit(id: BoardId): string {
  return isSkillBoard(id) ? S.unit.skill : (S.unit[id as keyof typeof S.unit] ?? '');
}

/** The empty-board line for a board that stays empty until a later ticket. */
export function boardEmptyLine(id: BoardId): string {
  if (id === 'duels') return S.duelsEmpty;
  if (id === 'festivals') return S.festivalsEmpty;
  return S.empty;
}

export interface BoardSummary {
  id: BoardId;
  name: string;
  /** The player's rank, or null. */
  rank: number | null;
  total: number;
}

export interface RankRow {
  rank: number;
  handle: string;
  value: number;
  isYou: boolean;
}

export interface BoardPage {
  id: BoardId;
  name: string;
  unit: string;
  total: number;
  rank: number | null;
  /** The top rows, then a gap, then the player and the rows next to them when they are not in the top. */
  top: readonly RankRow[];
  near: readonly RankRow[];
  emptyLine: string;
}

const row = (r: Board['rows'][number]): RankRow => ({
  rank: r.rank,
  handle: r.handle,
  value: r.value,
  isYou: r.slot === null,
});

/** Every board that has someone on it, with where the player stands. Skills first, then the rest. */
export function boardSummaries(state: SimState, who: number, mapPercent: number): BoardSummary[] {
  const facts = factsOf(state, who, mapPercent);
  const out: BoardSummary[] = [];
  for (const id of ALL_BOARDS) {
    const b = computeBoard(id, state.seed, state.travelers, facts);
    const alwaysShown = (OTHER_BOARDS as readonly string[]).includes(id);
    if (b.rows.length === 0 && !alwaysShown) continue;
    out.push({ id, name: boardName(id), rank: b.playerRank, total: b.rows.length });
  }
  return out;
}

/** One board as the panel draws it. */
export function boardPage(
  state: SimState,
  who: number,
  id: BoardId,
  mapPercent: number,
): BoardPage {
  const b = computeBoard(id, state.seed, state.travelers, factsOf(state, who, mapPercent));
  const top = b.rows.slice(0, RANKINGS.topRows).map(row);
  let near: RankRow[] = [];
  if (b.playerRank !== null && b.playerRank > RANKINGS.topRows) {
    const at = b.playerRank - 1;
    near = b.rows.slice(Math.max(RANKINGS.topRows, at - 1), at + 2).map(row);
  }
  return {
    id,
    name: boardName(id),
    unit: boardUnit(id),
    total: b.rows.length,
    rank: b.playerRank,
    top,
    near,
    emptyLine: boardEmptyLine(id),
  };
}
