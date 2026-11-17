import { COMBAT as C } from '../../content/balance/combat';
import { ATTACKS, WEAPONS } from '../../content/combat/attacks';
import { startComboStep } from '../combat/commands';
import {
  cardinalOf,
  centerPx,
  newFighter,
  nearestInArc,
  pxPos,
  resolveSwing,
  startAttack,
} from '../combat/fighter';
import { len } from '../combat/geometry';
import { destroy, getComp, query, spawn, setComp, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { dirStep, SUBPX } from '../kernel/fixed';
import type { SimState } from '../state';
import { nudge } from './movement';
import { launchProjectile } from './projectile';
import { earnCoin, spendCoin } from '../ledger';

/** The state machine for every fighter, run once per tick after commands. Ascending id order. */
export function combatSystem(state: SimState): void {
  for (const id of query(state.entities, 'fighter', 'pos', 'pools')) {
    const f = getComp(state.entities, id, 'fighter');
    if (!f) continue;
    if (f.hitstop > 0) {
      f.hitstop--;
      continue;
    }
    for (let s = 0; s < f.cooldowns.length; s++) {
      if ((f.cooldowns[s] ?? 0) > 0) (f.cooldowns[s] as number)--;
    }
    if (f.gap > 0 && f.state === 'idle') {
      f.gap--;
      if (f.gap === 0 && f.scheme === 'classic') f.combo = 0;
    }
    if (f.invuln > 0) f.invuln--;
    f.t++;
    tickLock(state, id);

    switch (f.state) {
      case 'attack':
        advanceAttack(state, id);
        break;
      case 'dodge':
        if (f.t >= C.dodge.ticks) {
          f.state = 'idle';
          f.t = 0;
          f.dv = { x: 0, y: 0 };
        }
        break;
      case 'hurt':
        if (f.t >= C.hurtTicks.player) {
          f.state = 'idle';
          f.t = 0;
        }
        break;
      case 'stagger':
        if (f.t >= C.stagger.ticks) {
          f.state = 'idle';
          f.t = 0;
        }
        break;
      case 'dead':
        advanceDeath(state, id);
        break;
      default:
        autoAttack(state, id);
    }
    drainStagger(state, id);
  }
  recoverEchoes(state);
}

/** Keeps a lock valid: the target must live and be within the leash. Faces the target while locked. */
function tickLock(state: SimState, id: EntityId): void {
  const f = getComp(state.entities, id, 'fighter');
  if (!f || f.lock === null) return;
  const me = centerPx(state, id);
  const target = getComp(state.entities, f.lock, 'fighter');
  const tp = centerPx(state, f.lock);
  const gone = !target || target.state === 'dead' || !state.entities.alive[f.lock] || !tp || !me;
  if (gone || len({ x: tp.x - me.x, y: tp.y - me.y }) > C.lock.leash) {
    f.lock = null;
    emit(state.events, { type: 'lockChanged', id, target: null });
    return;
  }
  const a = getComp(state.entities, id, 'avatar');
  if (a && f.state !== 'dodge') a.facing = cardinalOf({ x: tp.x - me.x, y: tp.y - me.y }, a.facing);
}

/** Flow: swing on the weapon's cadence while a target is in reach and in the facing arc. */
function autoAttack(state: SimState, id: EntityId): void {
  const f = getComp(state.entities, id, 'fighter');
  const cb = getComp(state.entities, id, 'combatant');
  const a = getComp(state.entities, id, 'avatar');
  const w = cb ? WEAPONS[cb.weapon] : undefined;
  if (!f || !w || !a || f.team !== 0 || f.scheme !== 'flow' || f.gap > 0 || f.aiming >= 0) return;
  const locked = f.lock !== null ? centerPx(state, f.lock) : null;
  const me = centerPx(state, id);
  let point = null as { x: number; y: number } | null;
  if (locked && me && len({ x: locked.x - me.x, y: locked.y - me.y }) <= w.reach + 6)
    point = locked;
  else if (f.lock === null) {
    const t = nearestInArc(state, id, dirStep(a.facing), w.reach, C.flowArcCos256);
    point = t === null ? null : centerPx(state, t);
  }
  if (point) startAttack(state, id, w.auto, point);
}

/** Advances an attack through windup, active frames and recovery. */
function advanceAttack(state: SimState, id: EntityId): void {
  const f = getComp(state.entities, id, 'fighter');
  const def = f?.atk ? ATTACKS[f.atk] : undefined;
  if (!f || !def) return;
  const activeFrom = def.windup;
  const activeTo = def.windup + def.active;
  const end = activeTo + def.recover;

  if (f.t >= activeFrom && f.t < activeTo) {
    if (def.dash) {
      const per = (def.dash * SUBPX) / def.active;
      const l = len(f.aim);
      f.dv = { x: Math.round((f.aim.x / l) * per), y: Math.round((f.aim.y / l) * per) };
    }
    if (f.t === activeFrom && def.projectile) launchProjectile(state, id, def, def.projectile);
    // Creatures are not moved by the avatar movement system, so their dashes are applied here.
    if (def.dash && !getComp(state.entities, id, 'avatar')) nudge(state, id, f.dv.x, f.dv.y);
    resolveSwing(state, id, def);
  } else {
    f.dv = { x: 0, y: 0 };
  }

  if (f.t >= end) {
    f.state = 'idle';
    f.t = 0;
    f.atk = null;
    f.casting = null;
    f.hit = [];
    f.gap = f.team === 0 && f.scheme === 'classic' ? C.comboResetGap : C.flowGap;
    if (f.queued && f.scheme === 'classic') startComboStep(state, id);
    f.queued = false;
  }
}

/** The stagger bar drains slowly when the enemy is left alone. */
function drainStagger(state: SimState, id: EntityId): void {
  const s = getComp(state.entities, id, 'stagger');
  if (!s || s.cur === 0) return;
  if (state.tick - s.lastHit >= C.stagger.decayDelay && state.tick % C.stagger.decayEvery === 0)
    s.cur--;
}

/** Enemies are removed after a short linger. The avatar respawns at its Waystone. */
function advanceDeath(state: SimState, id: EntityId): void {
  const f = getComp(state.entities, id, 'fighter');
  if (!f) return;
  f.deadT++;
  const avatar = getComp(state.entities, id, 'avatar');
  if (!avatar) {
    if (f.deadT >= C.death.enemyLinger) destroy(state.entities, id);
    return;
  }
  if (f.deadT === 1) dropEcho(state, id);
  if (f.deadT >= C.death.respawnDelay) respawn(state, id);
}

/** Leaves 10% of carried coin where the avatar fell. An older Echo is lost. */
function dropEcho(state: SimState, id: EntityId): void {
  const a = getComp(state.entities, id, 'avatar');
  const p = getComp(state.entities, id, 'pos');
  if (!a || !p) return;
  for (const old of query(state.entities, 'echo')) {
    destroy(state.entities, old);
    emit(state.events, { type: 'echoLost', id: old });
  }
  const left = Math.floor((a.coin * C.death.echoPercent) / 100);
  if (left <= 0) return;
  spendCoin(state, id, left, 'echo');
  const echo = spawn(state.entities);
  setComp(state.entities, echo, 'pos', { x: p.x, y: p.y });
  setComp(state.entities, echo, 'echo', { coin: left });
  emit(state.events, { type: 'echoDropped', id: echo, coin: left });
}

function respawn(state: SimState, id: EntityId): void {
  const a = getComp(state.entities, id, 'avatar');
  const p = getComp(state.entities, id, 'pos');
  const v = getComp(state.entities, id, 'vel');
  const pools = getComp(state.entities, id, 'pools');
  const old = getComp(state.entities, id, 'fighter');
  if (!a || !p || !pools || !old) return;
  p.x = a.respawn.x;
  p.y = a.respawn.y;
  if (v) {
    v.x = 0;
    v.y = 0;
  }
  pools.hp = pools.hpMax;
  pools.sta = pools.staMax;
  pools.foc = pools.focMax;
  pools.lastCombat = state.tick - C.pools.hpRegenDelay;
  const fresh = newFighter(0, old.slots);
  fresh.scheme = old.scheme;
  fresh.invuln = 0;
  state.entities.comps.fighter[id] = fresh;
  a.intent = null;
  a.full = false;
  a.winded = false;
  emit(state.events, { type: 'respawned', id });
}

/** Walking onto an Echo recovers its coin. */
function recoverEchoes(state: SimState): void {
  const echoes = query(state.entities, 'echo', 'pos');
  if (echoes.length === 0) return;
  for (const aid of query(state.entities, 'avatar', 'pos', 'fighter')) {
    const a = getComp(state.entities, aid, 'avatar');
    const f = getComp(state.entities, aid, 'fighter');
    const me = pxPos(state, aid);
    if (!a || !me || f?.state === 'dead') continue;
    for (const eid of echoes) {
      const ep = pxPos(state, eid);
      const echo = getComp(state.entities, eid, 'echo');
      if (!ep || !echo) continue;
      if (len({ x: ep.x - me.x, y: ep.y - me.y }) <= C.death.echoPickup) {
        earnCoin(state, aid, echo.coin, 'echo');
        emit(state.events, { type: 'echoRecovered', id: eid, coin: echo.coin });
        destroy(state.entities, eid);
      }
    }
  }
}
