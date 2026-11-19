import { ATTACKS } from '../../content/combat/attacks';
import { CREATURES } from '../../content/creatures';
import type { CreatureDef } from '../../content/creatures/types';
import { centerPx, startAttack } from '../combat/fighter';
import { len } from '../combat/geometry';
import { getComp, query, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { dirStep, SUBPX, type Vec } from '../kernel/fixed';
import { int } from '../kernel/rng';
import type { Ai, SimState } from '../state';
import { nudge } from './movement';
import { sightBlocked } from '../elements';
import { TECHNIQUE_BALANCE as TB } from '../../content/balance/techniques';
import { activeMods, applyMods, hasStatus, modAdd, statusMods } from '../mods';
import { TEMPERAMENT as TP } from '../../content/balance/temperament';
import { provenTierOf, temperamentNow, territoryOf } from '../combat/temperament';
import { frozenAt } from '../world/stream';
import { patternDriven } from './boss';
import { noticePct } from '../weatherEffects';
import { ARCHETYPE as AR } from '../../content/balance/archetypes';

/** Ticks a creature spends noticing before it commits (about a third of a second). */
const NOTICE_TICKS = 10;
/** No more than this many creatures attack one target at once (design/04). The rest circle. */
export const MAX_ATTACKERS = 6;
/** Radius, px, the rest circle at. */
const RING = 52;
/** Creatures closer than this push each other apart. */
const SEPARATION = 14;
const WANDER_TICKS = 30;

function pct(state: SimState, id: EntityId): number {
  const p = getComp(state.entities, id, 'pools');
  return p ? (p.hp * 100) / p.hpMax : 100;
}

/** Nearest living player-side fighter within `range` px of `me`, or null. */
function acquire(state: SimState, me: Vec, rangeIn: number, by: EntityId): EntityId | null {
  // Fog, sand and storm cut how far a creature notices (M4-09).
  const range = Math.floor((rangeIn * noticePct(state, me.x * SUBPX, me.y * SUBPX)) / 100);
  let best: EntityId | null = null;
  let bestD = range;
  for (const id of query(state.entities, 'fighter', 'pos')) {
    const f = getComp(state.entities, id, 'fighter');
    if (!f || f.team !== 0 || f.state === 'dead') continue;
    const c = centerPx(state, id);
    if (!c) continue;
    const d = len({ x: c.x - me.x, y: c.y - me.y });
    // Mossfriend: creatures of a kind the unit wears peace with never notice it first.
    const kind = getComp(state.entities, by, 'combatant')?.kind;
    if (kind && modAdd(activeMods(state, id), 'noAggroCreature', kind) > 0) continue;
    // A hidden unit is noticed from a fraction of the range. A creature that would have noticed
    // it at the full range and did not has been passed by: that counts once per creature per hide.
    const hidden = (getComp(state.entities, id, 'statuses') ?? []).find((s) => s.id === 'hidden');
    const reach = hidden ? Math.floor((range * TB.hide.noticePct) / 100) : range;
    if (hidden && d <= range && d > reach && !(hidden.ids ??= []).includes(by)) {
      hidden.ids.push(by);
      emit(state.events, { type: 'sneak', who: id, creature: by });
    }
    // Steam hides whoever stands in or behind it.
    if (d <= Math.min(bestD, reach) && !sightBlocked(state, me, c)) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/** Walks along `dir` (px vector) at `speed` sub-pixels per tick, pushed off nearby creatures. */
function walk(state: SimState, id: EntityId, dir: Vec, speed: number): boolean {
  const me = centerPx(state, id);
  const f = getComp(state.entities, id, 'fighter');
  if (!me || !f || speed === 0 || hasStatus(state, id, 'rooted')) return false;
  speed = applyMods(speed, 'moveSpeed', statusMods(state, id));
  let l = len(dir);
  if (l === 0) return false;
  let x = dir.x / l;
  let y = dir.y / l;
  f.aim = { x: dir.x, y: dir.y };
  for (const other of query(state.entities, 'ai', 'pos')) {
    if (other === id) continue;
    const o = centerPx(state, other);
    if (!o) continue;
    const dx = me.x - o.x;
    const dy = me.y - o.y;
    const d = len({ x: dx, y: dy });
    if (d >= SEPARATION) continue;
    // Exactly on top of each other: split by id so the pair does not jam.
    const w = (1 - d / SEPARATION) * 1.5;
    if (d === 0) x += id < other ? w : -w;
    else {
      x += (dx / d) * w;
      y += (dy / d) * w;
    }
  }
  l = Math.sqrt(x * x + y * y);
  if (l === 0) return false;
  const moved = nudge(state, id, Math.round((x / l) * speed), Math.round((y / l) * speed));
  return moved.x !== 0 || moved.y !== 0;
}

/** Tells the Bestiary a creature acted on its temperament in front of `target` (M4-05 stores it). */
function seen(state: SimState, id: EntityId, def: CreatureDef, target: EntityId, t: string): void {
  emit(state.events, { type: 'temperamentSeen', id, target, kind: def.id, temperament: t });
}

/**
 * A target is within notice. What the creature does about it follows its temperament, read before
 * any chase can start. Provoked creatures (hit, packmate hit, cornered) act as hostile.
 */
function react(
  state: SimState,
  id: EntityId,
  ai: Ai,
  def: CreatureDef,
  target: EntityId,
  homePx: Vec,
): void {
  // A guard lets go of anything that stands beyond its tether, so it never starts that chase.
  if (def.archetype === 'guard' && beyondTether(state, def, target, homePx)) return;
  const base = temperamentNow(def, state.worldTick, provenTierOf(state, target));
  const t = ai.provoked && base !== 'passive' ? 'hostile' : base;
  switch (t) {
    case 'hostile':
      ai.target = target;
      enter(ai, 'notice');
      emit(state.events, { type: 'noticed', id, target });
      seen(state, id, def, target, 'hostile');
      break;
    case 'territorial': {
      const at = centerPx(state, target);
      if (!at || len({ x: at.x - homePx.x, y: at.y - homePx.y }) > territoryOf(def).radius) break;
      ai.target = target;
      enter(ai, 'warn');
      emit(state.events, { type: 'creatureWarn', id, target });
      seen(state, id, def, target, 'territorial');
      break;
    }
    case 'skittish':
      ai.target = target;
      enter(ai, 'flee');
      emit(state.events, { type: 'noticed', id, target });
      seen(state, id, def, target, 'skittish');
      break;
    case 'curious':
      ai.target = target;
      enter(ai, 'follow');
      seen(state, id, def, target, 'curious');
      break;
    // Defensive and passive never start anything.
    default:
      break;
  }
  if (def.archetype === 'swarm' && ai.state === 'notice') alertSwarm(state, id, def, target);
}

/** True if a guard's target stands farther than the tether from the guard's home. */
function beyondTether(state: SimState, def: CreatureDef, target: EntityId, homePx: Vec): boolean {
  const at = centerPx(state, target);
  return !!at && len({ x: at.x - homePx.x, y: at.y - homePx.y }) > (def.tether ?? def.leash);
}

/** A swarm member noticed: every packmate within the pack radius that is not busy turns on the same target. */
function alertSwarm(state: SimState, id: EntityId, def: CreatureDef, target: EntityId): void {
  const me = centerPx(state, id);
  if (!me || !def.pack) return;
  for (const other of query(state.entities, 'ai', 'pos')) {
    if (other === id) continue;
    const oai = getComp(state.entities, other, 'ai');
    const odef = oai ? CREATURES[oai.creature] : undefined;
    const o = centerPx(state, other);
    if (!oai || !odef || !o || odef.pack?.id !== def.pack.id) continue;
    if (oai.state !== 'idle' && oai.state !== 'wander') continue;
    if (getComp(state.entities, other, 'fighter')?.state === 'dead') continue;
    if (len({ x: o.x - me.x, y: o.y - me.y }) > def.pack.radius) continue;
    oai.target = target;
    enter(oai, 'notice');
    emit(state.events, { type: 'noticed', id: other, target });
  }
}

/**
 * Starts the best attack that reaches and is ready. Returns true if a strike began. A skirmisher
 * marks that it should back off once the strike is done.
 */
function tryAttack(
  state: SimState,
  id: EntityId,
  ai: Ai,
  def: CreatureDef,
  tpos: Vec,
  tdist: number,
): boolean {
  const pick = pickAttack(def, ai, tdist);
  if (pick < 0) return false;
  const a = def.attacks[pick] as { attack: string; cooldown: number };
  if (!startAttack(state, id, a.attack, tpos)) return false;
  ai.cooldowns[pick] = a.cooldown + (ATTACKS[a.attack]?.recover ?? 0);
  if (def.archetype === 'skirmisher') ai.skirm = true;
  return true;
}

/** A burrower goes under: unhurtable and passing under the tiles. */
function dive(state: SimState, id: EntityId, ai: Ai): void {
  const body = getComp(state.entities, id, 'body');
  const f = getComp(state.entities, id, 'fighter');
  if (body) {
    body.pass = true;
    body.solid = false;
  }
  if (f) f.invuln = Math.max(f.invuln, 2);
  enter(ai, 'burrow');
  emit(state.events, { type: 'burrowed', id });
}

/** Puts a burrower's body back on the ground: solid, tiles count again, open to hits. */
function surfaceBody(state: SimState, id: EntityId): void {
  const body = getComp(state.entities, id, 'body');
  const f = getComp(state.entities, id, 'fighter');
  if (body) {
    delete body.pass;
    body.solid = true;
  }
  if (f) f.invuln = 0;
}

/** True if the whole body stands on open ground, so a burrower can rise there without being pushed. */
function openGround(state: SimState, id: EntityId): boolean {
  const p = getComp(state.entities, id, 'pos');
  const body = getComp(state.entities, id, 'body');
  if (!p || !body || !state.world) return true;
  const half = body.w / 2;
  for (const dx of [-half, 0, half])
    for (const dy of [-1, -body.h + 1]) {
      const tx = Math.floor((p.x + dx) / SUBPX / 16);
      const ty = Math.floor((p.y + dy) / SUBPX / 16);
      if (state.world.solidAt(tx, ty) !== 0) return false;
    }
  return true;
}

/** A burrower rises to strike. */
function rise(state: SimState, id: EntityId, ai: Ai): void {
  surfaceBody(state, id);
  enter(ai, 'surface');
  emit(state.events, { type: 'surfaced', id });
}

/** The attack to use at `dist`: the shortest-ranged one that reaches and is ready. */
function pickAttack(def: CreatureDef, ai: Ai, dist: number): number {
  let best = -1;
  def.attacks.forEach((a, i) => {
    if ((a.phase ?? 0) > ai.phase || (ai.cooldowns[i] ?? 0) > 0 || dist > a.range) return;
    if (best < 0 || a.range < (def.attacks[best] as { range: number }).range) best = i;
  });
  return best;
}

/**
 * Creature brains. Notice, approach, flee, leash and wander live here. The telegraph, strike and
 * recovery are the fighter's attack state, so the same hit rules apply to creatures and players.
 * Runs before the combat system, so an attack decided this tick starts its wind-up this tick.
 */
export function aiSystem(state: SimState): void {
  // Creatures outside the active window are frozen (M4-03).
  const ids = query(state.entities, 'ai', 'fighter', 'pos', 'pools').filter((id) => {
    const p = getComp(state.entities, id, 'pos');
    return !p || !frozenAt(state, p.x, p.y);
  });

  // Engagement cap: attackers already swinging count first, then the nearest approachers.
  const attacking = new Map<EntityId, number>();
  const wanting = new Map<EntityId, { id: number; d: number }[]>();
  for (const id of ids) {
    const ai = getComp(state.entities, id, 'ai');
    const f = getComp(state.entities, id, 'fighter');
    if (!ai || !f || ai.target === null) continue;
    if (f.state === 'attack') attacking.set(ai.target, (attacking.get(ai.target) ?? 0) + 1);
    else if (ai.state === 'approach' && f.state === 'idle') {
      const me = centerPx(state, id);
      const t = centerPx(state, ai.target);
      if (!me || !t) continue;
      const list = wanting.get(ai.target) ?? [];
      list.push({ id, d: len({ x: t.x - me.x, y: t.y - me.y }) });
      wanting.set(ai.target, list);
    }
  }
  const permitted = new Set<EntityId>();
  for (const [target, list] of wanting) {
    list.sort((a, b) => a.d - b.d || a.id - b.id);
    const free = Math.max(0, MAX_ATTACKERS - (attacking.get(target) ?? 0));
    for (const w of list.slice(0, free)) permitted.add(w.id);
  }

  for (const id of ids) step(state, id, permitted.has(id));
}

function step(state: SimState, id: EntityId, mayAttack: boolean): void {
  const ai = getComp(state.entities, id, 'ai');
  const f = getComp(state.entities, id, 'fighter');
  const pos = getComp(state.entities, id, 'pos');
  const pools = getComp(state.entities, id, 'pools');
  const def = ai ? CREATURES[ai.creature] : undefined;
  const me = centerPx(state, id);
  if (!ai || !f || !pos || !pools || !def || !me) return;
  if (f.state === 'dead') return;
  if (def.archetype === 'dummy') {
    // A dummy is pinned to where it was placed, so knockback never moves it.
    pos.x = ai.home.x;
    pos.y = ai.home.y;
    return;
  }
  for (let i = 0; i < ai.cooldowns.length; i++)
    if ((ai.cooldowns[i] ?? 0) > 0) (ai.cooldowns[i] as number)--;
  // A burrower under ground cannot be hurt, whatever else is going on.
  if (ai.state === 'burrow') f.invuln = Math.max(f.invuln, 2);
  if (f.hitstop > 0 || f.state !== 'idle') return;
  ai.t++;
  // A skirmisher whose strike is done backs off.
  if (ai.skirm && ai.state === 'approach') {
    ai.skirm = false;
    enter(ai, 'retreat');
  }

  // Phases only add: a threshold crossed once stays crossed.
  const ph = def.phases ?? [];
  while (ai.phase < ph.length && pct(state, id) <= (ph[ai.phase] as { hpPct: number }).hpPct) {
    ai.phase++;
    emit(state.events, { type: 'phaseChanged', id, phase: ai.phase });
  }
  const speedPct = ai.phase > 0 ? (ph[ai.phase - 1] as { speedPct: number }).speedPct : 100;
  const speed = Math.round((def.speed * speedPct) / 100);
  const homePx = {
    x: ai.home.x / SUBPX,
    y: ai.home.y / SUBPX - (getComp(state.entities, id, 'body')?.h ?? 0) / SUBPX / 2,
  };

  const toHome = len({ x: homePx.x - me.x, y: homePx.y - me.y });
  if (ai.state !== 'leash' && toHome > def.leash) {
    if (ai.state === 'burrow') surfaceBody(state, id);
    enter(ai, 'leash');
    ai.target = null;
  }
  // A skittish creature fights once it is hurt below its flee Health, instead of running.
  if (
    def.temperament === 'skittish' &&
    def.fleeHpPct !== undefined &&
    pct(state, id) <= def.fleeHpPct
  )
    ai.provoked = true;
  if (
    def.fleeHpPct !== undefined &&
    def.temperament !== 'skittish' &&
    !ai.fled &&
    pct(state, id) <= def.fleeHpPct &&
    ai.state !== 'leash' &&
    ai.state !== 'flee'
  ) {
    enter(ai, 'flee');
    ai.fled = true;
  }

  // A calm creature (fed or soothed) notices nothing, and lets go of what it was after.
  const calmNow = ai.calmUntil !== undefined && state.worldTick < ai.calmUntil;
  if (!calmNow && ai.calmUntil !== undefined) delete ai.calmUntil;
  if (
    calmNow &&
    ai.state !== 'idle' &&
    ai.state !== 'wander' &&
    ai.state !== 'leash' &&
    ai.state !== 'flee'
  ) {
    if (ai.state === 'burrow') surfaceBody(state, id);
    ai.target = null;
    enter(ai, 'idle');
    return;
  }

  const tpos = ai.target === null ? null : centerPx(state, ai.target);
  const tf = ai.target === null ? null : getComp(state.entities, ai.target, 'fighter');
  const tdist = tpos ? len({ x: tpos.x - me.x, y: tpos.y - me.y }) : Infinity;
  const targetOk = !!tpos && !!tf && tf.state !== 'dead' && tdist <= def.lose;

  switch (ai.state) {
    case 'idle': {
      if (ai.provoked && ai.target !== null && targetOk) {
        enter(ai, 'notice');
        emit(state.events, { type: 'noticed', id, target: ai.target });
        seen(state, id, def, ai.target, 'provoked');
        break;
      }
      const t = calmNow ? null : acquire(state, me, def.notice, id);
      if (t !== null) {
        react(state, id, ai, def, t, homePx);
        if (ai.state !== 'idle') break;
      }
      if (def.wander && def.speed > 0 && int(state.rng.world, 0, 90) === 0) {
        ai.heading = int(state.rng.world, 0, 8);
        enter(ai, 'wander');
      }
      break;
    }
    case 'wander': {
      if (ai.provoked && ai.target !== null && targetOk) {
        enter(ai, 'notice');
        emit(state.events, { type: 'noticed', id, target: ai.target });
        seen(state, id, def, ai.target, 'provoked');
        break;
      }
      const t = calmNow ? null : acquire(state, me, def.notice, id);
      if (t !== null) {
        react(state, id, ai, def, t, homePx);
        if (ai.state !== 'wander') break;
      }
      // Drift near home: head back if the wander has taken it a third of the way to the leash.
      const dir =
        toHome > def.leash / 3
          ? { x: homePx.x - me.x, y: homePx.y - me.y }
          : dirStep((ai.heading % 8) as 0);
      walk(state, id, dir, Math.round(speed / 2));
      if (ai.t >= WANDER_TICKS) enter(ai, 'idle');
      break;
    }
    case 'warn': {
      // The warning runs while the target stays inside the territory. A step back cancels it.
      const terr = territoryOf(def);
      const now = temperamentNow(
        def,
        state.worldTick,
        ai.target === null ? 0 : provenTierOf(state, ai.target),
      );
      const inside =
        targetOk &&
        len({ x: (tpos as Vec).x - homePx.x, y: (tpos as Vec).y - homePx.y }) <= terr.radius;
      if (ai.provoked || now === 'hostile') {
        if (ai.target !== null) {
          enter(ai, 'notice');
          emit(state.events, { type: 'noticed', id, target: ai.target });
        }
      } else if (!inside || now !== 'territorial') {
        ai.target = null;
        enter(ai, 'idle');
      } else {
        f.aim = { x: (tpos as Vec).x - me.x, y: (tpos as Vec).y - me.y };
        if (ai.t >= terr.warnTicks) {
          enter(ai, 'notice');
          emit(state.events, { type: 'noticed', id, target: ai.target as number });
        }
      }
      break;
    }
    case 'follow': {
      const now = temperamentNow(
        def,
        state.worldTick,
        ai.target === null ? 0 : provenTierOf(state, ai.target),
      );
      if (ai.provoked && targetOk) {
        enter(ai, 'notice');
        emit(state.events, { type: 'noticed', id, target: ai.target as number });
      } else if (!targetOk || tdist > def.notice || now !== 'curious') {
        ai.target = null;
        enter(ai, 'idle');
      } else {
        const d = { x: (tpos as Vec).x - me.x, y: (tpos as Vec).y - me.y };
        f.aim = d;
        if (tdist > (def.approach ?? 0)) walk(state, id, d, Math.round(speed / 2));
      }
      break;
    }
    case 'notice':
      if (!targetOk) {
        ai.target = null;
        enter(ai, 'idle');
      } else {
        f.aim = { x: (tpos as Vec).x - me.x, y: (tpos as Vec).y - me.y };
        if (ai.t >= NOTICE_TICKS) enter(ai, 'approach');
      }
      break;
    case 'approach': {
      if (!targetOk) {
        // Lost the target: go home and reset.
        ai.target = null;
        enter(ai, 'leash');
        break;
      }
      const d = { x: (tpos as Vec).x - me.x, y: (tpos as Vec).y - me.y };
      f.aim = d;
      // A guard lets go of a target that has drawn it past its tether, and walks home.
      if (def.archetype === 'guard' && beyondTether(state, def, ai.target as number, homePx)) {
        ai.target = null;
        enter(ai, 'leash');
        break;
      }
      // A burrower goes under to close the gap, and rises when it is on top of the target.
      if (def.archetype === 'burrower' && tdist > AR.burrower.surfaceDist) {
        dive(state, id, ai);
        break;
      }
      const reach = Math.min(...def.attacks.map((a) => a.range));
      // A boss on a scripted pattern attacks when the pattern says (systems/boss.ts), not here.
      if (mayAttack && !patternDriven(state, id)) {
        if (tryAttack(state, id, ai, def, tpos as Vec, tdist)) break;
        if (pickAttack(def, ai, tdist) >= 0) break;
      }
      if (def.archetype === 'shooter') break;
      if (!mayAttack && tdist < RING + 12) {
        // Waiting for a slot: circle the target instead of piling on.
        const away = tdist < RING - 8 ? -1 : tdist > RING + 8 ? 1 : 0;
        const side = id % 2 === 0 ? 1 : -1;
        walk(
          state,
          id,
          { x: d.x * away - d.y * side * 0.8, y: d.y * away + d.x * side * 0.8 },
          speed,
        );
      } else if (tdist > reach * 0.85) walk(state, id, d, speed);
      break;
    }
    case 'retreat': {
      if (!targetOk) {
        ai.target = null;
        enter(ai, 'leash');
        break;
      }
      const away = { x: me.x - (tpos as Vec).x, y: me.y - (tpos as Vec).y };
      f.aim = { x: -away.x, y: -away.y };
      walk(state, id, away, Math.round((speed * AR.skirmisher.retreatSpeedPct) / 100));
      if (ai.t >= AR.skirmisher.retreatTicks) enter(ai, 'approach');
      break;
    }
    case 'burrow': {
      if (!targetOk) {
        surfaceBody(state, id);
        ai.target = null;
        enter(ai, 'leash');
        break;
      }
      const d = { x: (tpos as Vec).x - me.x, y: (tpos as Vec).y - me.y };
      f.aim = d;
      if (tdist > AR.burrower.surfaceDist) {
        walk(state, id, d, Math.round((speed * AR.burrower.tunnelSpeedPct) / 100));
        ai.t = 0;
      } else if (ai.t >= AR.burrower.digTicks && openGround(state, id)) rise(state, id, ai);
      else if (ai.t >= AR.burrower.digTicks) walk(state, id, d, Math.round(speed / 2));
      break;
    }
    case 'surface': {
      if (!targetOk) {
        ai.target = null;
        enter(ai, 'leash');
        break;
      }
      const d = { x: (tpos as Vec).x - me.x, y: (tpos as Vec).y - me.y };
      f.aim = d;
      // A risen burrower is not held to the six attacker cap: it came up to strike.
      if (tryAttack(state, id, ai, def, tpos as Vec, tdist)) {
        ai.skirm = false;
        // After the strike, sink again once it is done: the exposed clock restarts.
        ai.t = 0;
        break;
      }
      const reach = Math.max(...def.attacks.map((a) => a.range));
      if (ai.t >= AR.burrower.exposedTicks || tdist > reach * 2) dive(state, id, ai);
      break;
    }
    case 'leash': {
      walk(state, id, { x: homePx.x - me.x, y: homePx.y - me.y }, Math.round(speed * 1.2));
      if (toHome <= 3) {
        pools.hp = pools.hpMax;
        const s = getComp(state.entities, id, 'stagger');
        if (s) s.cur = 0;
        ai.cooldowns.fill(0);
        ai.fled = false;
        ai.provoked = false;
        enter(ai, 'idle');
        emit(state.events, { type: 'leashReset', id });
      }
      break;
    }
    case 'flee': {
      if (def.temperament === 'skittish' && ai.provoked && targetOk) {
        enter(ai, 'notice');
        break;
      }
      if (tpos) {
        const moved = walk(
          state,
          id,
          { x: me.x - tpos.x, y: me.y - tpos.y },
          Math.round(speed * 1.2),
        );
        // Cornered: no step away is possible, so a skittish creature turns and fights.
        if (!moved && def.temperament === 'skittish' && targetOk) {
          ai.provoked = true;
          enter(ai, 'notice');
          emit(state.events, { type: 'noticed', id, target: ai.target as number });
          break;
        }
      }
      if (ai.t >= TP.fleeTicks || !tpos) {
        ai.target = null;
        enter(ai, 'idle');
      }
      break;
    }
  }
}

/** A creature bolts from `from` for the flee spell: a bell, a fright. */
export function scare(state: SimState, id: EntityId, from: EntityId): void {
  const ai = getComp(state.entities, id, 'ai');
  if (!ai || ai.state === 'flee') return;
  ai.target = from;
  enter(ai, 'flee');
}

function enter(ai: Ai, next: Ai['state']): void {
  ai.state = next;
  ai.t = 0;
}
