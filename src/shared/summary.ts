import { getComp, query } from '../sim/kernel/entities';
import type { SimState } from '../sim/state';
import { travelerTotals } from '../sim/travelers';

/**
 * A small fixed-shape digest of a sim, derived by this one function. It is stored beside the sim
 * so a later integrity check (M2) can recompute it and compare. Only numbers and plain maps.
 */
export interface SaveSummary {
  tick: number;
  playSeconds: number;
  coin: number;
  /** Points per skill id, for skills with any. */
  skillPoints: Record<string, number>;
  totalSkillPoints: number;
  /** Stacks in the bag, counting quantity. */
  itemCount: number;
  requestsDone: number;
  flags: number;
  /** Sum of skill points across every Traveler's build, and of coin across their purses (M5-02). */
  travelerPoints: number;
  travelerCoin: number;
}

/** The avatar's entity id, or null if the state has none. */
export function findAvatar(state: SimState): number | null {
  return query(state.entities, 'avatar')[0] ?? null;
}

/** Derives the summary. Pure. */
export function deriveSummary(state: SimState, playSeconds: number): SaveSummary {
  const who = findAvatar(state);
  const skills = who === null ? undefined : getComp(state.entities, who, 'skills');
  const inv = who === null ? undefined : getComp(state.entities, who, 'inventory');
  const journal = who === null ? undefined : getComp(state.entities, who, 'journal');
  const trav = travelerTotals(state.travelers);
  const skillPoints: Record<string, number> = {};
  let total = 0;
  for (const [id, p] of Object.entries(skills?.points ?? {})) {
    if (p > 0) skillPoints[id] = p;
    total += p;
  }
  return {
    tick: state.tick,
    playSeconds: Math.floor(playSeconds),
    coin: who === null ? 0 : (getComp(state.entities, who, 'avatar')?.coin ?? 0),
    skillPoints,
    totalSkillPoints: total,
    itemCount: (inv?.slots ?? []).reduce((n, s) => n + (s?.qty ?? 0), 0),
    requestsDone: Object.values(journal?.requests ?? {}).filter((r) => r.state === 'done').length,
    flags: journal?.flags.length ?? 0,
    travelerPoints: trav.points,
    travelerCoin: trav.coin,
  };
}
