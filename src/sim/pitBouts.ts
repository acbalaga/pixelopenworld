import { honorFor, PIT_DUELS } from '../content/balance/pit';
import { PIT } from '../content/balance/travelers';
import { ATTACKS } from '../content/combat/attacks';
import { PLACE_SPOTS } from '../content/people/placeSpots';
import { findAvatar } from '../shared/summary';
import { startComboStep } from './combat/commands';
import type { EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { SUBPX } from './kernel/fixed';
import { int, next } from './kernel/rng';
import type { SimState } from './state';
import { nudge } from './systems/movement';
import { identitiesOf } from './travelers/generate';
import { PLACE_LIST } from './travelers/lists';
import { pitOpen } from './travelers/pit';

/**
 * The Pit's duels (POW-M5-30, design/07 Rivals and duels). Two duel-minded Travelers waiting at
 * the Pit fight a bout by M5-12's rule: the first to lose 30% of their Health loses. The winner is
 * the abstract roll (the travelers stream, weighted by rank) and the bout is staged to match: both
 * stay on the player's side, so no real blow lands, and each swing that connects takes a scripted
 * share. The loser always reaches 30% first and nobody is ever downed. Spectators cheer by name.
 * Session only: a bout running at close is not saved, and changed nothing.
 *
 * The player's own Pit duels are M5-12 duels started in the Pit. A win there counts toward the
 * cosmetic Pit honor (5 wins "Pit regular", 20 "Pit champion"), kept beside the duel record.
 */

export interface Bout {
  a: number;
  b: number;
  winner: number;
  start: number;
  begin: number;
  /** Health at the start, to measure the 30% by and to heal back to. */
  hp0: { a: number; b: number };
  /** Next tick each side swings. */
  next: { a: number; b: number };
  nextCheer: number;
}

export interface PitState {
  bout: Bout | null;
  /** In-game minute each Traveler last fought a bout. */
  rested: Map<number, number>;
  lastMinute: number;
}

const pitOf = (state: SimState): PitState =>
  (state.pitBouts ??= { bout: null, rested: new Map(), lastMinute: -1 });

const PIT_IDX = (): number => PLACE_LIST.indexOf(PIT.place);

/** The Pit's middle, in px. */
function ringPx(): { x: number; y: number } | null {
  const r = PLACE_SPOTS[PIT.place]?.rect;
  return r ? { x: (r.x + r.w / 2) * 16, y: (r.y + r.h / 2) * 16 + 6 } : null;
}

/** True if a px point is in the Pit (its place rectangle and a tile around it). */
export function inPit(x: number, y: number): boolean {
  const r = PLACE_SPOTS[PIT.place]?.rect;
  if (!r) return false;
  const tx = Math.floor(x / 16);
  const ty = Math.floor((y - 1) / 16);
  return tx >= r.x - 1 && tx < r.x + r.w + 1 && ty >= r.y - 1 && ty < r.y + r.h + 1;
}

/** Is this Traveler the sort who duels: bold, in the duelists' guild, or named for it. */
export function duelMinded(state: SimState, slot: number): boolean {
  const t = identitiesOf(state.seed)[slot]!;
  return (
    t.temper === 'bold' ||
    PIT.guilds.includes(state.travelers[slot]!.guild) ||
    PIT.handles.includes(t.handle)
  );
}

/** Duelists waiting at the Pit, on screen and free: the "Next" board lists them. */
export function waitingAtPit(state: SimState): number[] {
  const crowd = state.crowd;
  if (!crowd || !pitOpen(state)) return [];
  const bout = state.pitBouts?.bout;
  const out: number[] = [];
  for (const ent of crowd.ents.values()) {
    const d = crowd.doing[ent.slot];
    if (!d || d.kind !== 'social' || d.place !== PIT_IDX() || d.eta > 0) continue;
    if (bout && (bout.a === ent.slot || bout.b === ent.slot)) continue;
    if (state.duel?.slot === ent.slot || state.party?.members.some((m) => m.slot === ent.slot))
      continue;
    if (duelMinded(state, ent.slot)) out.push(ent.slot);
  }
  return out.sort((a, b) => a - b);
}

const entOf = (state: SimState, slot: number): EntityId => state.crowd?.entOf[slot] ?? -1;

const rankOf = (state: SimState, slot: number): number =>
  state.travelers[slot]!.build.reduce((m, [, p]) => Math.max(m, p), 0);

export function startBout(state: SimState, a: number, b: number): void {
  const pit = pitOf(state);
  const ea = entOf(state, a);
  const eb = entOf(state, b);
  const pa = state.entities.comps.pools[ea];
  const pb = state.entities.comps.pools[eb];
  if (!pa || !pb) return;
  const ra = rankOf(state, a) + 10;
  const rb = rankOf(state, b) + 10;
  const winner = next(state.rng.travelers) * (ra + rb) < ra ? a : b;
  pit.bout = {
    a,
    b,
    winner,
    start: state.tick,
    begin: state.tick + PIT_DUELS.countTicks,
    hp0: { a: pa.hp, b: pb.hp },
    next: { a: state.tick + PIT_DUELS.countTicks, b: state.tick + PIT_DUELS.countTicks + 12 },
    nextCheer: state.tick + PIT_DUELS.countTicks,
  };
  emit(state.events, { type: 'pitBoutStarted', a, b });
}

function endBout(state: SimState, called: boolean): void {
  const pit = pitOf(state);
  const bout = pit.bout;
  if (!bout) return;
  pit.bout = null;
  const minute = state.crowd?.lastMinute ?? 0;
  for (const [slot, hp0] of [
    [bout.a, bout.hp0.a],
    [bout.b, bout.hp0.b],
  ] as const) {
    pit.rested.set(slot, minute);
    const pl = state.entities.comps.pools[entOf(state, slot)];
    if (pl) pl.hp = Math.min(pl.hpMax, Math.max(pl.hp, hp0));
    const f = state.entities.comps.fighter[entOf(state, slot)];
    if (f && f.state !== 'dead') {
      f.state = 'idle';
      f.atk = null;
      f.t = 0;
    }
  }
  const loser = bout.winner === bout.a ? bout.b : bout.a;
  emit(state.events, { type: 'pitBoutEnded', winner: bout.winner, loser, called });
}

/** The share of starting Health a side has lost. */
const lost = (hp0: number, hp: number): number => (hp0 <= 0 ? 0 : Math.max(0, hp0 - hp) / hp0);

/** A swing connects: the scripted share comes off the other side, never past what the rule allows. */
function land(state: SimState, bout: Bout, from: number): void {
  const to = from === bout.a ? bout.b : bout.a;
  const pl = state.entities.comps.pools[entOf(state, to)];
  if (!pl) return;
  const hp0 = to === bout.a ? bout.hp0.a : bout.hp0.b;
  const r = state.rng.travelers;
  const winnerHits = from === bout.winner;
  const [lo, hi] = winnerHits ? PIT_DUELS.winnerHitPct : PIT_DUELS.loserHitPct;
  let amount = Math.max(1, Math.round((hp0 * int(r, lo, hi)) / 100));
  if (!winnerHits) {
    // The loser's blows never take the winner past the cap.
    const floor = Math.ceil(hp0 * (1 - PIT_DUELS.winnerCapPct / 100));
    amount = Math.max(0, Math.min(amount, pl.hp - floor));
  }
  amount = Math.min(amount, Math.max(0, pl.hp - 1));
  if (amount <= 0) return;
  pl.hp -= amount;
  pl.lastCombat = state.tick;
  emit(state.events, {
    type: 'damageDealt',
    src: entOf(state, from),
    dst: entOf(state, to),
    amount,
    crit: false,
    bonus: false,
    heavy: false,
    tag: 'bout',
  });
}

/**
 * One tick of a fighter in a bout: to their side of the ring, face the other, swing on their beat.
 * Called by the entity layer. True when it handled the entity.
 */
export function boutEntTick(
  state: SimState,
  id: EntityId,
  ent: { slot: number; face: 0 | 2 | 4 | 6; mode: string; emote: unknown; still: number },
): boolean {
  const bout = state.pitBouts?.bout;
  if (!bout || (ent.slot !== bout.a && ent.slot !== bout.b)) return false;
  const ring = ringPx();
  const p = state.entities.comps.pos[id];
  const f = state.entities.comps.fighter[id];
  if (!ring || !p || !f) return true;
  ent.emote = null;
  const left = ent.slot === bout.a;
  const gx = ring.x + (left ? -PIT_DUELS.ringHalfPx : PIT_DUELS.ringHalfPx);
  const x = p.x / SUBPX;
  const y = p.y / SUBPX;
  const dx = gx - x;
  const dy = ring.y - y;
  const d = Math.hypot(dx, dy);
  if (f.state !== 'idle') {
    ent.mode = f.state === 'attack' ? 'fight' : 'idle';
    return true;
  }
  if (d > 2) {
    const step = Math.min(640, d * SUBPX);
    nudge(state, id, Math.round((dx / d) * step), Math.round((dy / d) * step));
    ent.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 6) : dy > 0 ? 4 : 0;
    ent.mode = 'walk';
    return true;
  }
  ent.face = left ? 2 : 6;
  ent.mode = 'idle';
  ent.still = 0;
  const side = left ? 'a' : 'b';
  if (state.tick >= bout.begin && state.tick >= bout.next[side]) {
    f.lock = null;
    f.aim = { x: left ? 1 : -1, y: 0 };
    startComboStep(state, id);
    const r = state.rng.travelers;
    bout.next[side] = state.tick + int(r, PIT_DUELS.swingTicks[0], PIT_DUELS.swingTicks[1]);
    ent.mode = 'fight';
  }
  return true;
}

/**
 * The Pit, once a tick: lands the swings of a bout on their active frame, ends it by the 30% rule,
 * gets spectators cheering, and once an in-game minute may start the next bout.
 */
export function pitBoutSystem(state: SimState): void {
  const crowd = state.crowd;
  if (!crowd || !state.clock || !pitOpen(state)) return;
  const pit = pitOf(state);
  const bout = pit.bout;
  if (bout) {
    const ea = entOf(state, bout.a);
    const eb = entOf(state, bout.b);
    const here = ea >= 0 && eb >= 0 && crowd.online[bout.a] === 1 && crowd.online[bout.b] === 1;
    if (!here) {
      endBout(state, true);
      return;
    }
    for (const [slot, id] of [
      [bout.a, ea],
      [bout.b, eb],
    ] as const) {
      const f = state.entities.comps.fighter[id];
      const def = f?.atk ? ATTACKS[f.atk] : undefined;
      if (f && def && f.state === 'attack' && f.t === def.windup) land(state, bout, slot);
    }
    const la = lost(bout.hp0.a, state.entities.comps.pools[ea]!.hp);
    const lb = lost(bout.hp0.b, state.entities.comps.pools[eb]!.hp);
    if (la >= 0.3 || lb >= 0.3) {
      endBout(state, false);
      return;
    }
    if (state.tick - bout.start > PIT_DUELS.maxTicks) {
      // Out of time: the winner's last blows land at once, so the roll still decides it.
      const to = bout.winner === bout.a ? bout.b : bout.a;
      const pl = state.entities.comps.pools[entOf(state, to)]!;
      const hp0 = to === bout.a ? bout.hp0.a : bout.hp0.b;
      pl.hp = Math.max(1, Math.min(pl.hp, Math.floor(hp0 * 0.7)));
      endBout(state, false);
      return;
    }
    if (state.tick >= bout.nextCheer) {
      bout.nextCheer = state.tick + PIT_DUELS.cheerTicks;
      const fans = waitingAtPit(state).concat(spectators(state, bout));
      if (fans.length > 0) {
        const fan = fans[state.tick % fans.length]!;
        const e = crowd.ents.get(entOf(state, fan));
        if (e) e.emote = { kind: 'cheer', t: 0 };
        emit(state.events, {
          type: 'pitCheer',
          slot: fan,
          for: state.tick % 2 === 0 ? bout.a : bout.b,
        });
      }
    }
    return;
  }
  if (crowd.lastMinute === pit.lastMinute) return;
  pit.lastMinute = crowd.lastMinute;
  const ready = waitingAtPit(state).filter(
    (s) => crowd.lastMinute - (pit.rested.get(s) ?? -1e9) >= PIT_DUELS.restMinutes,
  );
  if (ready.length < 2 || next(state.rng.travelers) >= PIT_DUELS.boutChance) return;
  const r = state.rng.travelers;
  const a = ready.splice(int(r, 0, ready.length - 1), 1)[0]!;
  const b = ready[int(r, 0, ready.length - 1)]!;
  startBout(state, a, b);
}

/** Everyone else on screen at the Pit, who watches. */
function spectators(state: SimState, bout: Bout | null): number[] {
  const crowd = state.crowd!;
  const out: number[] = [];
  for (const ent of crowd.ents.values()) {
    const d = crowd.doing[ent.slot];
    if (!d || d.place !== PIT_IDX() || d.eta > 0) continue;
    if (bout && (ent.slot === bout.a || ent.slot === bout.b)) continue;
    if (!duelMinded(state, ent.slot)) out.push(ent.slot);
  }
  return out;
}

/** Spectators at the Pit while the player duels there, for the cheers by honor. */
export const pitWatchers = (state: SimState): number[] =>
  state.crowd ? [...waitingAtPit(state), ...spectators(state, state.pitBouts?.bout ?? null)] : [];

/**
 * A duel the player won in the Pit: one more Pit win, and the honor it brings, once. Called by the
 * duel when it ends. The honor is derived from the count and saved with it, so neither a reload nor
 * an older save can grant it twice.
 */
export function pitWin(state: SimState): void {
  const d = state.mail.duels;
  d.pit = (d.pit ?? 0) + 1;
  const tier = honorFor(d.pit);
  if (tier > (d.honor ?? 0)) {
    d.honor = tier;
    emit(state.events, { type: 'pitHonor', tier });
  }
}

/** Is the player standing in the Pit now. */
export function playerInPit(state: SimState): boolean {
  const me = findAvatar(state);
  const p = me === null ? undefined : state.entities.comps.pos[me];
  return !!p && inPit(p.x / SUBPX, p.y / SUBPX);
}
