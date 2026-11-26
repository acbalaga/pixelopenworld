import { DUELS } from '../content/balance/mail';
import type { Temper } from '../content/travelers/types';
import { findAvatar } from '../shared/summary';
import { getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { SUBPX } from './kernel/fixed';
import type { SimState } from './state';
import { crowdOf } from './travelers/crowd';
import { regardNow } from './travelers/social';
import { pitWin, playerInPit } from './pitBouts';

/**
 * Duels (POW-M5-12, design/07 Rivals and duels). A duel is non-lethal: the first to lose 30% of
 * their health loses. While it runs the Traveler's fighter is on the other team, so the player's
 * hits land on them and theirs on the player, and nobody can fall: health never drops below 1 for
 * the two of them. When it ends both are healed back to where they began, the Traveler goes back to
 * the player's side, and a result is sent for the memory, the Duels board and the letters. Session
 * only: a duel that is running when the game closes is not saved, and nothing changed.
 */

export interface DuelState {
  slot: number;
  ent: EntityId;
  /** Tick the challenge was taken, and the tick the fight begins (a short count first). */
  startTick: number;
  beginTick: number;
  begun: boolean;
  /** Health of each side at the start, to heal back to and to measure the loss by. */
  hp0: { me: number; them: number };
  /** Begun in the Pit: a win counts toward the Pit honor (M5-30). */
  pit?: true;
}

/** The ticks between the challenge being taken and the first blow. */
export const DUEL_COUNT_TICKS = 60;

/** The health a duelling fighter cannot fall below: 1 for the two in a duel, else 0. */
export function duelFloor(state: SimState, id: EntityId): number {
  const d = state.duel;
  if (!d || !d.begun) return 0;
  return id === d.ent || id === findAvatar(state) ? 1 : 0;
}

/** True if the Traveler of this entity is in a duel that has begun: they fight the avatar. */
export const duelFoeOf = (state: SimState, ent: EntityId): EntityId | null => {
  const d = state.duel;
  return d && d.ent === ent ? findAvatar(state) : null;
};

/** Does this Traveler take a challenge? By regard and temper, and only if they are free. */
export function acceptsDuel(
  state: SimState,
  slot: number,
  temper: Temper,
  nowMin: number,
): boolean {
  if (state.duel || state.party?.members.some((m) => m.slot === slot)) return false;
  const bout = state.pitBouts?.bout;
  if (bout && (bout.a === slot || bout.b === slot)) return false;
  const life = state.travelers[slot];
  if (!life) return false;
  return regardNow(life, nowMin) >= DUELS.acceptAt[temper];
}

const distPx = (state: SimState, a: EntityId, b: EntityId): number => {
  const p = state.entities.comps.pos[a];
  const q = state.entities.comps.pos[b];
  return p && q ? Math.hypot((p.x - q.x) / SUBPX, (p.y - q.y) / SUBPX) : Infinity;
};

/** Starts a duel with the promoted Traveler of `slot`. False if one cannot start. */
export function startDuel(state: SimState, slot: number): boolean {
  const crowd = state.crowd;
  const me = findAvatar(state);
  if (!crowd || me === null || state.duel) return false;
  const ent = crowd.entOf[slot] ?? -1;
  if (ent < 0 || !crowd.ents.has(ent)) return false;
  const myPools = getComp(state.entities, me, 'pools');
  const herPools = getComp(state.entities, ent, 'pools');
  const f = getComp(state.entities, ent, 'fighter');
  if (!myPools || !herPools || !f || f.state === 'dead') return false;
  if (getComp(state.entities, me, 'fighter')?.state === 'dead') return false;
  if (distPx(state, me, ent) > DUELS.nearPx) return false;
  state.duel = {
    slot,
    ent,
    startTick: state.tick,
    beginTick: state.tick + DUEL_COUNT_TICKS,
    begun: false,
    hp0: { me: myPools.hp, them: herPools.hp },
    ...(playerInPit(state) ? { pit: true as const } : {}),
  };
  emit(state.events, { type: 'duelStarted', slot });
  return true;
}

/** Ends the duel: both sides healed back, the Traveler back on the player's side, a result sent. */
function endDuel(state: SimState, result: 'player' | 'traveler' | 'draw'): void {
  const d = state.duel;
  if (!d) return;
  state.duel = undefined;
  const me = findAvatar(state);
  const f = getComp(state.entities, d.ent, 'fighter');
  if (f) {
    f.team = 0;
    if (f.state !== 'dead') {
      f.state = 'idle';
      f.atk = null;
      f.t = 0;
    }
  }
  const herPools = getComp(state.entities, d.ent, 'pools');
  if (herPools) herPools.hp = Math.min(herPools.hpMax, Math.max(herPools.hp, d.hp0.them));
  const myPools = me === null ? undefined : getComp(state.entities, me, 'pools');
  if (myPools) myPools.hp = Math.min(myPools.hpMax, Math.max(myPools.hp, d.hp0.me));
  if (result === 'player') {
    state.mail.duels.wins++;
    if (d.pit) pitWin(state);
  } else if (result === 'traveler') state.mail.duels.losses++;
  emit(state.events, { type: 'duelEnded', slot: d.slot, result });
}

/** Share of its starting health a side has lost, 0 to 1. */
const lost = (hp0: number, hp: number): number => (hp0 <= 0 ? 0 : Math.max(0, hp0 - hp) / hp0);

/**
 * Runs the duel once a tick: starts the fight after the count, and ends it when a side has lost 30%,
 * when someone is not there any more, or when it has gone on too long.
 */
export function duelSystem(state: SimState): void {
  const d = state.duel;
  if (!d) return;
  const me = findAvatar(state);
  const crowd = crowdOf(state);
  const f = getComp(state.entities, d.ent, 'fighter');
  const alive = state.entities.alive[d.ent] && crowd.ents.has(d.ent) && f && f.state !== 'dead';
  if (me === null || !alive || distPx(state, me, d.ent) > DUELS.nearPx * 2.5) {
    endDuel(state, 'draw');
    return;
  }
  if (!d.begun) {
    if (state.tick >= d.beginTick) {
      d.begun = true;
      f.team = 1;
    }
    return;
  }
  const myPools = getComp(state.entities, me, 'pools');
  const herPools = getComp(state.entities, d.ent, 'pools');
  if (!myPools || !herPools) return endDuel(state, 'draw');
  const mine = lost(d.hp0.me, myPools.hp);
  const theirs = lost(d.hp0.them, herPools.hp);
  if (mine >= DUELS.loseShare || theirs >= DUELS.loseShare) {
    endDuel(state, mine === theirs ? 'draw' : mine > theirs ? 'traveler' : 'player');
    return;
  }
  if (state.tick - d.startTick > DUELS.maxTicks) endDuel(state, 'draw');
}
