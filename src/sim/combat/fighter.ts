import { activeMods, applyMods, hasStatus, modAdd, modPct, statusMods } from '../mods';
import { COMBAT as C } from '../../content/balance/combat';
import { STATUS_BALANCE as SB } from '../../content/balance/status';
import { ATTACKS, type AttackDef, WEAPONS } from '../../content/combat/attacks';
import { emit } from '../kernel/events';
import { getComp, type EntityId } from '../kernel/entities';
import { dirStep, SUBPX, type Vec } from '../kernel/fixed';
import { nextU32 } from '../kernel/rng';
import type { Fighter, Pools, SimState } from '../state';
import { computeDamage } from './damage';
import { provoke } from './temperament';
import { blocking, facingOf, hitAngle256 } from './guard';
import { breaksGuard, knockPx, propertyPct, refundOf, staggerPoints } from './properties';
import { inShape, len } from './geometry';
import { recordKill } from '../ledger';
import { elementPct } from '../weatherEffects';

/** A fresh set of pools at full. */
export function newPools(tick: number): Pools {
  return {
    hp: C.pools.hpMax,
    hpMax: C.pools.hpMax,
    sta: C.pools.staMax,
    staMax: C.pools.staMax,
    foc: C.pools.focMax,
    focMax: C.pools.focMax,
    lastCombat: tick - C.pools.hpRegenDelay,
    lastSpend: tick - C.pools.staRegenDelay,
  };
}

/** A fighter at rest on `team`, with technique slots. */
export function newFighter(team: 0 | 1, slots: (string | null)[] = []): Fighter {
  return {
    team,
    state: 'idle',
    t: 0,
    atk: null,
    hit: [],
    combo: 0,
    queued: false,
    aim: { x: 0, y: 1 },
    hitstop: 0,
    invuln: 0,
    dodgeStart: -1000,
    dv: { x: 0, y: 0 },
    gap: 0,
    lock: null,
    scheme: 'flow',
    aiming: -1,
    slots: [slots[0] ?? null, slots[1] ?? null, slots[2] ?? null, slots[3] ?? null],
    cooldowns: [0, 0, 0, 0],
    casting: null,
    deadT: 0,
    guard: false,
    guardT: 0,
    still: 0,
  };
}

/** Feet position in whole px. */
export function pxPos(state: SimState, id: EntityId): Vec | null {
  const p = getComp(state.entities, id, 'pos');
  return p ? { x: Math.round(p.x / SUBPX), y: Math.round(p.y / SUBPX) } : null;
}

/** Center of the body in px, so aim and hit tests use the middle of the figure, not the feet. */
export function centerPx(state: SimState, id: EntityId): Vec | null {
  const p = getComp(state.entities, id, 'pos');
  const b = getComp(state.entities, id, 'body');
  if (!p) return null;
  return { x: Math.round(p.x / SUBPX), y: Math.round((p.y - (b ? b.h >> 1 : 0)) / SUBPX) };
}

/** Half size of a body in px, for hit tests. */
function radiusOf(state: SimState, id: EntityId): number {
  const b = getComp(state.entities, id, 'body');
  return b ? Math.max(b.w, b.h) / 2 / SUBPX : 4;
}

/** Fighters on the side opposite `team` that can still be hit, ascending id. */
export function foes(state: SimState, team: 0 | 1): EntityId[] {
  const out: EntityId[] = [];
  const fighters = state.entities.comps.fighter;
  for (let id = 0; id < fighters.length; id++) {
    const f = fighters[id];
    if (f && state.entities.alive[id] && f.team !== team && f.state !== 'dead') out.push(id);
  }
  return out;
}

/** Nearest foe inside `reach` px and the arc around `facing` (cos * 256), or null. */
export function nearestInArc(
  state: SimState,
  who: EntityId,
  facing: Vec,
  reach: number,
  cos256: number,
): EntityId | null {
  const f = getComp(state.entities, who, 'fighter');
  const me = centerPx(state, who);
  if (!f || !me) return null;
  let best: EntityId | null = null;
  let bestD = Infinity;
  for (const id of foes(state, f.team)) {
    const c = centerPx(state, id);
    if (!c) continue;
    const d = { x: c.x - me.x, y: c.y - me.y };
    const dist = len(d);
    if (dist > reach + radiusOf(state, id)) continue;
    if (dist > 0 && (d.x * facing.x + d.y * facing.y) / (dist * len(facing)) < cos256 / 256)
      continue;
    if (dist < bestD) {
      best = id;
      bestD = dist;
    }
  }
  return best;
}

/** Stamina one blocked hit costs: the guard's cost, less for the Bulwark Path. */
export function blockCost(state: SimState, who: EntityId): number {
  return applyMods(C.guard.cost, 'blockStaPct', activeMods(state, who));
}

/** Spends from a pool if there is enough. Returns false (and emits a denial) if not. */
export function spend(
  state: SimState,
  who: EntityId,
  pool: 'sta' | 'foc',
  amount: number,
): boolean {
  const p = getComp(state.entities, who, 'pools');
  if (!p) return false;
  if (p[pool] < amount) {
    emit(state.events, { type: 'denied', id: who, reason: pool === 'sta' ? 'stamina' : 'focus' });
    return false;
  }
  p[pool] -= amount;
  if (pool === 'sta') p.lastSpend = state.tick;
  return true;
}

/**
 * Starts an attack. `aimAt` is a world point in px to face (a lock or a creature's target);
 * without it the aim is the facing direction. Returns false if the cost cannot be paid.
 * Callers are responsible for checking the fighter can act.
 */
export function startAttack(
  state: SimState,
  who: EntityId,
  attackId: string,
  aimAt: Vec | null,
  technique: string | null = null,
): boolean {
  const f = getComp(state.entities, who, 'fighter');
  const def = ATTACKS[attackId];
  if (!f || !def) return false;
  // Dazed units cannot start an attack or a technique.
  if (hasStatus(state, who, 'dazed')) return false;
  // A swap in combat locks every attack for a moment.
  if (state.tick < (f.lockUntil ?? 0)) return false;
  const me = centerPx(state, who);
  const av = getComp(state.entities, who, 'avatar');
  let aim: Vec | null = null;
  if (aimAt && me && (aimAt.x !== me.x || aimAt.y !== me.y))
    aim = { x: aimAt.x - me.x, y: aimAt.y - me.y };
  if (!aim) aim = av ? dirStep(av.facing) : f.aim;
  f.aim = aim;
  f.state = 'attack';
  // The tick count is bumped later this same tick, so -1 makes the windup exactly `windup` ticks
  // from the tick that started it to the first active tick.
  f.t = -1;
  f.atk = attackId;
  f.hit = [];
  f.queued = false;
  f.gap = 0;
  f.casting = technique;
  if (av && aimAt) av.facing = cardinalOf(aim, av.facing);
  emit(state.events, { type: 'attackStarted', id: who, attack: attackId });
  return true;
}

/** Cardinal facing (0 N, 2 E, 4 S, 6 W) closest to a vector. Ties keep `keep`. */
export function cardinalOf(v: Vec, keep: number = 4): 0 | 2 | 4 | 6 {
  if (Math.abs(v.x) === Math.abs(v.y)) return keep === 0 || keep === 2 || keep === 6 ? keep : 4;
  return Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 2 : 6) : v.y > 0 ? 4 : 0;
}

/** What a hit carries from its source. Projectiles fill this in themselves. */
export interface HitInfo {
  src: number;
  /** Where the hit came from, px, for knockback direction. */
  from: Vec;
  power: number;
  rank: number;
  mult: number;
  stagger: number;
  knock: number;
  element: number;
  heavy: boolean;
  /** Weapon family or element, for skill XP. */
  tag: string;
  /** The element the hit carries, and whether it applies the element's status. */
  elem?: string;
  applies?: boolean;
  /** Draws the target in instead of pushing it away. */
  pull?: boolean;
  /** Percent of the damage that heals the attacker. */
  drain?: number;
  /** A critical hit whatever the roll. */
  crit?: boolean;
  /** Count the target as staggered for the damage bonus. */
  asStaggered?: boolean;
}

/** Applies one hit to `dst`: i-frames, perfect dodge, damage, stagger, knockback, hit pause, death. */
export function dealDamage(state: SimState, dst: EntityId, h: HitInfo): void {
  const e = state.entities;
  const f = getComp(e, dst, 'fighter');
  const pools = getComp(e, dst, 'pools');
  const cb = getComp(e, dst, 'combatant');
  if (!f || !pools || f.state === 'dead') return;

  if (f.invuln > 0) {
    emit(state.events, { type: 'dodged', src: h.src, dst });
    if (
      f.state === 'dodge' &&
      state.tick - f.dodgeStart <=
        C.dodge.perfectWindow + modAdd(activeMods(state, dst), 'perfectWindow')
    )
      emit(state.events, { type: 'perfectDodge', id: dst, src: h.src });
    return;
  }

  const wasStaggered = f.state === 'stagger';
  const mid = centerPx(state, dst) ?? { x: 0, y: 0 };

  // A raised guard turns a frontal hit: a parry if it was raised just before, a guard break from
  // a heavy weapon, else a block that costs Stamina. With no Stamina left it fails.
  let through = 100;
  let blocked = false;
  if (
    blocking(state, dst) &&
    hitAngle256(facingOf(state, dst), mid, h.from) >= C.guard.frontCos256
  ) {
    if (f.guardT <= C.guard.parryWindow) {
      parry(state, dst, h);
      return;
    }
    if (breaksGuard(h.tag)) {
      f.guard = false;
      emit(state.events, { type: 'guardBroken', who: dst });
    } else if (pools.sta >= blockCost(state, dst)) {
      pools.sta -= blockCost(state, dst);
      pools.lastSpend = state.tick;
      blocked = true;
      through = C.guard.takenPct;
    } else {
      f.guard = false;
      emit(state.events, { type: 'guardBroken', who: dst });
    }
  }

  const roll =
    nextU32(state.rng.combat) % 100 <
    C.crit.chancePct + modAdd(activeMods(state, h.src), 'critPct');
  const crit = roll || h.crit === true;
  // Pestward: more damage to creatures of a tier. The mod's `arg` is the tier.
  const tierPct = 100 + modPct(activeMods(state, h.src), 'tierDamagePct', String(cb?.tier ?? 0));
  const prop = Math.floor(
    (propertyPct(state, dst, h.tag, mid, h.from, wasStaggered) * tierPct) / 100,
  );
  const defense = Math.max(
    SB.defenseFloor,
    applyMods(cb?.defense ?? 0, 'defense', statusMods(state, dst)),
  );
  let amount = computeDamage(h.power, h.mult, h.rank, defense, h.element, {
    crit,
    staggered: wasStaggered || h.asStaggered === true,
    pct: Math.floor((prop * through) / 100),
  });
  // Weather feeds some elements and damps others where the target stands (M4-09).
  if (h.elem && amount > 0) {
    const at = getComp(e, dst, 'pos');
    if (at)
      amount = Math.max(1, Math.floor((amount * elementPct(state, h.elem, at.x, at.y)) / 100));
  }
  pools.hp = Math.max(0, pools.hp - amount);
  if (h.src !== dst) provoke(state, dst, h.src);
  pools.lastCombat = state.tick;
  const srcPools = getComp(e, h.src, 'pools');
  if (srcPools) srcPools.lastCombat = state.tick;
  emit(state.events, {
    type: 'damageDealt',
    src: h.src,
    dst,
    amount,
    crit,
    bonus: wasStaggered,
    heavy: h.heavy,
    tag: h.tag,
    ...(h.elem ? { elem: h.elem, applies: h.applies === true } : {}),
  });
  if (blocked) emit(state.events, { type: 'blocked', who: dst, src: h.src, amount });
  // Drain: the caster is healed for a share of what the hit did.
  if (h.drain && srcPools && h.src !== dst) {
    const back = Math.floor((amount * h.drain) / 100);
    const before = srcPools.hp;
    srcPools.hp = Math.min(srcPools.hpMax, srcPools.hp + back);
    if (srcPools.hp > before)
      emit(state.events, {
        type: 'healed',
        id: h.src,
        src: h.src,
        amount: srcPools.hp - before,
        tag: 'drain',
      });
  }
  // Every unarmed hit gives some Stamina back.
  const refund = refundOf(h.tag);
  if (srcPools && refund > 0) srcPools.sta = Math.min(srcPools.staMax, srcPools.sta + refund);

  // Knockback away from the source, spread over a few ticks. A block takes half of it.
  const pos = getComp(e, dst, 'pos');
  if (pos && h.knock > 0) {
    // Centers, not feet, so a hit from the same row pushes straight back.
    const m = centerPx(state, dst) ?? { x: pos.x / SUBPX, y: pos.y / SUBPX };
    let dx = m.x - h.from.x;
    let dy = m.y - h.from.y;
    const l = len({ x: dx, y: dy });
    if (l === 0) {
      dx = 0;
      dy = 1;
    } else {
      dx /= l;
      dy /= l;
    }
    // A pull stops short of the caster's feet instead of carrying through them.
    const dist = h.pull ? Math.min(h.knock, Math.max(0, l - 12)) : knockPx(h.tag, h.knock, l);
    if (h.pull) {
      dx = -dx;
      dy = -dy;
    }
    const per = ((blocked ? dist >> 1 : dist) * SUBPX) / C.knockTicks;
    const k = getComp(e, dst, 'knock');
    const add = { x: Math.round(dx * per), y: Math.round(dy * per) };
    e.comps.knock[dst] = k
      ? { x: k.x + add.x, y: k.y + add.y, ttl: C.knockTicks }
      : { ...add, ttl: C.knockTicks };
  }

  // Hit pause on both sides.
  const bonus = h.heavy ? C.hitstop.heavyBonus : 0;
  f.hitstop = Math.max(f.hitstop, C.hitstop.target + bonus);
  const sf = getComp(e, h.src, 'fighter');
  if (sf) sf.hitstop = Math.max(sf.hitstop, C.hitstop.attacker + bonus);

  if (pools.hp === 0) {
    kill(state, dst);
    const kind = getComp(e, dst, 'combatant')?.kind;
    if (kind && f.team === 1)
      emit(state.events, { type: 'killed', src: h.src, dst, kind, tag: h.tag });
    return;
  }
  if (blocked) return;
  fillStagger(state, dst, staggerPoints(h.tag, h.stagger));
  const hurt = f.team === 0 ? C.hurtTicks.player : C.hurtTicks.enemy;
  if (hurt > 0 && f.state !== 'stagger') {
    f.state = 'hurt';
    f.t = 0;
    f.atk = null;
    f.dv = { x: 0, y: 0 };
  }
}

/** Adds to a fighter's stagger bar. A full bar breaks into the helpless state. */
function fillStagger(state: SimState, id: EntityId, points: number): void {
  const f = getComp(state.entities, id, 'fighter');
  const stagger = getComp(state.entities, id, 'stagger');
  if (!f || !stagger || f.state === 'dead') return;
  const was = f.state === 'stagger';
  stagger.cur += points;
  stagger.lastHit = state.tick;
  if (!was && stagger.cur >= stagger.max) {
    stagger.cur = 0;
    f.state = 'stagger';
    f.t = 0;
    f.atk = null;
    f.dv = { x: 0, y: 0 };
    emit(state.events, { type: 'staggerBreak', id });
  }
}

/** A hit met a guard raised just before it: no damage, and the attacker is thrown off balance. */
function parry(state: SimState, dst: EntityId, h: HitInfo): void {
  const e = state.entities;
  const f = getComp(e, dst, 'fighter');
  const pools = getComp(e, dst, 'pools');
  if (!f || !pools) return;
  pools.lastCombat = state.tick;
  const srcPools = getComp(e, h.src, 'pools');
  if (srcPools) srcPools.lastCombat = state.tick;
  emit(state.events, { type: 'parried', who: dst, src: h.src });
  f.hitstop = Math.max(f.hitstop, C.hitstop.target);
  const sf = getComp(e, h.src, 'fighter');
  if (sf) {
    sf.hitstop = Math.max(sf.hitstop, C.hitstop.attacker);
    // The swing is over: a parried attacker is open, whether or not it has a stagger bar.
    if (sf.state === 'attack') {
      sf.state = 'idle';
      sf.t = 0;
      sf.atk = null;
      sf.dv = { x: 0, y: 0 };
    }
  }
  fillStagger(state, h.src, C.guard.parryStagger);
}

/** Moves a fighter to the dead state. Echo and respawn are handled by the combat system. */
export function kill(state: SimState, id: EntityId): void {
  const f = getComp(state.entities, id, 'fighter');
  if (!f) return;
  f.state = 'dead';
  f.t = 0;
  f.deadT = 0;
  f.atk = null;
  f.dv = { x: 0, y: 0 };
  f.lock = null;
  if (f.team === 1) {
    const kind = getComp(state.entities, id, 'combatant')?.kind;
    if (kind) recordKill(state, kind);
  }
  emit(state.events, { type: 'died', id, team: f.team });
}

/** Resolves the active frames of `who`'s attack: finds targets in the shape and hits them. */
export function resolveSwing(state: SimState, who: EntityId, def: AttackDef, lastHit = true): void {
  const f = getComp(state.entities, who, 'fighter');
  const cb = getComp(state.entities, who, 'combatant');
  const me = centerPx(state, who);
  if (!f || !cb || !me) return;
  if (def.shape.kind === 'line' && def.shape.reach === 0) return;
  const hits: { id: number; dist: number }[] = [];
  for (const id of foes(state, f.team)) {
    if (f.hit.includes(id)) continue;
    const c = centerPx(state, id);
    if (!c) continue;
    const d = { x: c.x - me.x, y: c.y - me.y };
    if (inShape(def.shape, f.aim, d, radiusOf(state, id))) hits.push({ id, dist: len(d) });
  }
  if (hits.length === 0) return;
  hits.sort((a, b) => a.dist - b.dist || a.id - b.id);
  const chosen = def.pierce ? hits : hits.slice(0, f.hit.length === 0 ? 1 : 0);
  const weaponPower = cb.power;
  for (const { id } of chosen) {
    f.hit.push(id);
    dealDamage(state, id, {
      src: who,
      from: me,
      power: weaponPower,
      rank: cb.skillRank,
      mult: def.mult,
      stagger: def.stagger,
      knock: def.knock,
      element: 100,
      heavy: def.heavy === true,
      // A spell pays XP to its element, a blow to its weapon family.
      tag: def.element ?? def.family,
      ...(def.element ? { elem: def.element, applies: def.applies === true } : {}),
      ...(def.pull ? { pull: true } : {}),
      ...(def.drain ? { drain: def.drain } : {}),
      ...(def.crit ? { crit: true } : {}),
      ...(def.lastHitStaggers && lastHit ? { asStaggered: true } : {}),
    });
  }
}

/** The weapon a combatant carries. */
export function weaponOf(state: SimState, who: EntityId): (typeof WEAPONS)[string] | undefined {
  const cb = getComp(state.entities, who, 'combatant');
  return cb ? WEAPONS[cb.weapon] : undefined;
}
