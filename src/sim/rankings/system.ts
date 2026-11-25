import { RANKINGS } from '../../content/balance/rankings';
import { findAvatar } from '../../shared/summary';
import { emit } from '../kernel/events';
import type { SimState } from '../state';
import {
  ALL_BOARDS,
  computeBoard,
  passedBetween,
  playerValue,
  type Board,
  type BoardId,
  type PlayerFacts,
} from './boards';

/** What the player brings to the boards, read from the sim. The map percent comes from the caller. */
export function factsOf(state: SimState, who: number, mapPercent = 0): PlayerFacts {
  const c = state.entities.comps;
  const made = state.ledger.itemsMade;
  let fish = 0;
  for (const bySource of Object.values(made))
    fish += (bySource['item.fish_river'] ?? 0) + (bySource['item.fish_silver'] ?? 0);
  return {
    handle: c.avatar[who]?.handle ?? 'you',
    points: c.skills[who]?.points ?? {},
    coin: c.avatar[who]?.coin ?? 0,
    bestiary: Object.keys(c.journal[who]?.bestiary ?? {}).length,
    mapPercent,
    fishLanded: fish,
  };
}

/** Transient memory of the last boards, so a pass is only announced once. Never saved. */
export interface RankingsMemo {
  boards: Map<BoardId, Board>;
  values: Map<BoardId, number>;
  lastTick: number;
}

/** Ticks between looks when nothing of the player's has changed: the Travelers drift slowly. */
const REFRESH_TICKS = 1800;
/** Ticks between looks at the player's own values (cheap: no sorting unless one changed). */
const LOOK_TICKS = 90;

/**
 * Watches the boards the sim can compute (every board but the map, which needs the region's size)
 * and sends `playerPassed` when the player newly passes a Traveler in the top of one. It never changes
 * the sim: a board is derived. It does nothing without Traveler lives.
 */
export function rankingsSystem(state: SimState): void {
  const who = findAvatar(state);
  if (who === null || state.travelers.length === 0) return;
  const memo = (state.rankings ??= { boards: new Map(), values: new Map(), lastTick: -1e9 });
  if (state.tick - memo.lastTick < LOOK_TICKS) return;
  memo.lastTick = state.tick;
  const facts = factsOf(state, who);
  const stale = state.tick % REFRESH_TICKS < LOOK_TICKS;
  for (const id of ALL_BOARDS) {
    if (id === 'map') continue;
    const v = playerValue(id, facts);
    const known = memo.values.get(id);
    if (known === v && !stale) continue;
    memo.values.set(id, v);
    const next = computeBoard(id, state.seed, state.travelers, facts);
    const prev = memo.boards.get(id) ?? null;
    memo.boards.set(id, next);
    if (known === undefined) continue; // The first look only records where the player stands.
    for (const slot of passedBetween(prev, next, RANKINGS.passTop))
      emit(state.events, { type: 'playerPassed', board: id, slot, rank: next.playerRank ?? 0 });
  }
}
