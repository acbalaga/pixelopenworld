import { SKILLS_BALANCE } from '../../content/balance/skills';
import { soothe } from '../creatureCare';
import { TECHNIQUE_BALANCE as TB } from '../../content/balance/techniques';
import { ATTACKS, WEAPONS } from '../../content/combat/attacks';
import {
  INSTRUMENTS,
  TECHNIQUE_LIST,
  TECHNIQUES,
  type TechniqueDef,
  type TechniqueEffect,
} from '../../content/combat/techniques';
import { ITEMS } from '../../content/items';
import { FIXTURES } from '../../content/world/fixtures';
import { equip } from '../items';
import { inFight } from '../fight';
import { getComp, query, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { dirStep, SUBPX, type Direction, type Vec } from '../kernel/fixed';
import { activeMods, applyMods, hasStatus } from '../mods';
import type { SimState } from '../state';
import { applyStatus, clearStatus } from '../statuses';
import { spawnFixture } from '../systems/fixtures';
import { centerPx, nearestInArc, spend, startAttack } from './fighter';
import { len } from './geometry';
import { hasShield } from './guard';
import { knows, learnedFlag, syncSignature } from './knowledge';
import { awaken } from '../skills';

/**
 * Techniques (M3-13): which are known, what the slots hold, using one, channels and loadouts.
 * A technique is data (`content/combat/techniques.ts`); this is the rules that run it.
 */

export { knows, syncSignature } from './knowledge';

/** Every technique the avatar knows, in table order. */
export function knownTechniques(state: SimState, who: EntityId): TechniqueDef[] {
  return TECHNIQUE_LIST.filter((t) => knows(state, who, t));
}

/** How a technique was learned. A request reward counts as being taught. */
export type LearnVia = 'insight' | 'manual' | 'taught' | 'request';

/**
 * Teaches a technique (a person, a manual, an insight or a request). It awakens the skill, writes
 * the learned flag, and takes the first free slot after the weapon's own (slots 2 to 4) if it is
 * an active. Known ones are skipped.
 */
export function learnTechnique(
  state: SimState,
  who: EntityId,
  technique: string,
  via: LearnVia = 'taught',
): void {
  const t = TECHNIQUES[technique];
  const f = getComp(state.entities, who, 'fighter');
  const j = getComp(state.entities, who, 'journal');
  if (!t || !f || !j) return;
  const flag = learnedFlag(t.id);
  if (j.flags.includes(flag)) return;
  awaken(state, who, t.skill);
  j.flags.push(flag);
  j.learnedVia[t.id] = via === 'request' ? 'taught' : via;
  emit(state.events, { type: 'techniqueLearned', who, technique, via });
  // The weapon's own technique goes in slot 1 once it is known.
  syncSignature(state, who);
  if (t.kind === 'active' && !f.slots.includes(technique)) {
    const free = f.slots.findIndex((s, i) => i > 0 && s === null);
    if (free >= 0) assign(state, who, free, technique);
  }
}

/**
 * Counts one use toward an insight technique (design/03). Reaching the count in
 * `SKILLS_BALANCE.insight` learns it. Counts stop once it is known.
 */
export function countInsight(state: SimState, who: EntityId, t: TechniqueDef): void {
  const s = getComp(state.entities, who, 'skills');
  const need = SKILLS_BALANCE.insight[t.id];
  if (!s || need === undefined || knows(state, who, t)) return;
  const j = getComp(state.entities, who, 'journal');
  if (j?.flags.includes(learnedFlag(t.id))) return;
  const n = (s.insight[t.id] ?? 0) + 1;
  s.insight[t.id] = n;
  if (n >= need) learnTechnique(state, who, t.id, 'insight');
}

/** Puts a known active technique in slot 1, 2 or 3 (the second, third and fourth button), or empties it. */
export function assign(state: SimState, who: EntityId, slot: number, id: string | null): boolean {
  const f = getComp(state.entities, who, 'fighter');
  const ld = getComp(state.entities, who, 'loadouts');
  if (!f || slot < 1 || slot > 3) return false;
  if (id !== null) {
    const t = TECHNIQUES[id];
    if (!t || t.kind !== 'active' || !knows(state, who, t)) return false;
    // One copy at a time: moving it clears the slot it was in.
    f.slots.forEach((s, i) => {
      if (s === id && i > 0) f.slots[i] = null;
    });
  }
  f.slots[slot] = id;
  if (ld) ld.sets[ld.active].slots = [...f.slots];
  return true;
}

/** What the fighter's slots hold, copied into the active loadout so a swap can restore them. */
function syncActive(state: SimState, who: EntityId): void {
  const f = getComp(state.entities, who, 'fighter');
  const ld = getComp(state.entities, who, 'loadouts');
  if (f && ld) ld.sets[ld.active].slots = [...f.slots];
}

/**
 * Swaps to the other loadout: wields the weapon and off-hand item it names (bag slot indexes,
 * checked against what is there now), and takes its technique slots. Out of combat it is instant.
 * In a fight it applies and then every technique slot and the basic attack lock for
 * `loadoutLockTicks`.
 */
export function swapLoadout(state: SimState, who: EntityId): boolean {
  const f = getComp(state.entities, who, 'fighter');
  const ld = getComp(state.entities, who, 'loadouts');
  const inv = getComp(state.entities, who, 'inventory');
  if (!f || !ld || !inv || f.state !== 'idle' || getComp(state.entities, who, 'channel'))
    return false;
  syncActive(state, who);
  const from = ld.sets[ld.active];
  const to = ld.sets[ld.active === 0 ? 1 : 0] as (typeof ld.sets)[number];
  for (const hand of ['main', 'off'] as const) {
    const idx = to[hand];
    const stack = idx === null ? undefined : inv.slots[idx];
    // The index is only a hint: use it if that slot still holds something this hand can wear.
    if (idx !== null && stack && ITEMS[stack.item]?.equip?.slot === hand) {
      equip(state, who, idx);
      from[hand] = idx;
    }
  }
  ld.active = ld.active === 0 ? 1 : 0;
  const keep0 = f.slots[0] ?? null;
  f.slots = [keep0, to.slots[1] ?? null, to.slots[2] ?? null, to.slots[3] ?? null];
  f.cooldowns = [0, 0, 0, 0];
  const fighting = inFight(state, who);
  if (fighting) f.lockUntil = state.tick + TB.loadoutLockTicks;
  emit(state.events, { type: 'loadoutSwapped', who, active: ld.active, locked: fighting });
  return true;
}

/** True while a swap in combat has the slots and the basic attack locked. */
export function lockedOut(state: SimState, who: EntityId): boolean {
  const f = getComp(state.entities, who, 'fighter');
  return !!f && state.tick < (f.lockUntil ?? 0);
}

/** Whether the technique's requirements are met right now. */
export function requirementsMet(state: SimState, who: EntityId, t: TechniqueDef): boolean {
  const r = t.requires;
  if (!r) return true;
  const cb = getComp(state.entities, who, 'combatant');
  const f = getComp(state.entities, who, 'fighter');
  const inv = getComp(state.entities, who, 'inventory');
  if (r.main && WEAPONS[cb?.weapon ?? '']?.family !== r.main) return false;
  if (r.off === 'shield' && !hasShield(state, who)) return false;
  if (r.off === 'instrument' && !INSTRUMENTS.includes(inv?.equipment.off?.item ?? '')) return false;
  if (r.outOfCombat && inFight(state, who)) return false;
  if (r.hidden && !hasStatus(state, who, 'hidden')) return false;
  if (r.target && (f?.lock ?? null) === null) return false;
  return true;
}

/** Applies one effect of a technique. */
function applyEffect(state: SimState, who: EntityId, e: TechniqueEffect): void {
  if (e.kind === 'selfStatus') {
    applyStatus(state, who, e.status, who, e.ticks !== undefined ? { ticks: e.ticks } : {});
  } else if (e.kind === 'spawnFixture') {
    const a = getComp(state.entities, who, 'avatar');
    const p = getComp(state.entities, who, 'pos');
    if (!a || !p || !FIXTURES[e.fixture]) return;
    const d = dirStep(a.facing);
    const id = spawnFixture(state, e.fixture, 0, 0);
    const pos = getComp(state.entities, id, 'pos');
    const fx = getComp(state.entities, id, 'fixture');
    if (!pos || !fx) return;
    pos.x = p.x + d.x * e.ahead * SUBPX;
    pos.y = p.y + d.y * e.ahead * SUBPX;
    fx.home = { ...pos };
    fx.temp = true;
    fx.until = state.worldTick + e.ticks;
  } else if (e.kind === 'shadowstep') {
    const f = getComp(state.entities, who, 'fighter');
    const p = getComp(state.entities, who, 'pos');
    const me = centerPx(state, who);
    const target = f?.lock ?? null;
    const t = target === null ? null : centerPx(state, target);
    const tp = target === null ? undefined : getComp(state.entities, target, 'pos');
    if (!f || !p || !me || !t || !tp) return;
    const away = { x: t.x - me.x, y: t.y - me.y };
    const l = len(away) || 1;
    const dest = {
      x: tp.x + Math.round((away.x / l) * TB.shadowstep.behind * SUBPX),
      y: tp.y + Math.round((away.y / l) * TB.shadowstep.behind * SUBPX),
    };
    const grid = state.world;
    if (
      grid &&
      grid.solidAt(Math.floor(dest.x / SUBPX / 16), Math.floor((dest.y / SUBPX - 1) / 16)) !== 0
    )
      return;
    p.x = dest.x;
    p.y = dest.y;
    f.invuln = Math.max(f.invuln, TB.shadowstep.iframes);
    const a = getComp(state.entities, who, 'avatar');
    if (a) a.facing = cardinalToward(away);
  }
}

function cardinalToward(v: Vec): 0 | 2 | 4 | 6 {
  return Math.abs(v.x) >= Math.abs(v.y) ? (v.x >= 0 ? 2 : 6) : v.y >= 0 ? 4 : 0;
}

/** Creatures of `maxTier` or lower within `radius` of the caster are Dazed. */
function dazeNear(
  state: SimState,
  who: EntityId,
  e: Extract<TechniqueEffect, { kind: 'dazeNear' }>,
): void {
  const me = centerPx(state, who);
  if (!me) return;
  for (const id of query(state.entities, 'fighter', 'combatant', 'pos')) {
    const f = getComp(state.entities, id, 'fighter');
    const cb = getComp(state.entities, id, 'combatant');
    const c = centerPx(state, id);
    if (!f || !cb || !c || f.team === 0 || f.state === 'dead' || cb.tier > e.maxTier) continue;
    if (len({ x: c.x - me.x, y: c.y - me.y }) <= e.radius) {
      applyStatus(state, id, 'dazed', who, { ticks: e.ticks });
      soothe(state, id);
    }
  }
}

/** Fires a technique from a slot, if it is off cooldown, allowed, affordable and the fighter is free. */
export function fireTechnique(
  state: SimState,
  who: EntityId,
  slot: number,
  aim: Direction | null,
): void {
  const f = getComp(state.entities, who, 'fighter');
  const techId = f?.slots[slot];
  const tech = techId ? TECHNIQUES[techId] : undefined;
  if (!f || !tech || tech.kind !== 'active' || f.state !== 'idle') return;
  if (getComp(state.entities, who, 'channel')) return;
  if (lockedOut(state, who)) {
    emit(state.events, { type: 'denied', id: who, reason: 'locked' });
    return;
  }
  if ((f.cooldowns[slot] ?? 0) > 0) {
    emit(state.events, { type: 'denied', id: who, reason: 'cooldown' });
    return;
  }
  if (!requirementsMet(state, who, tech) || hasStatus(state, who, 'dazed')) {
    emit(state.events, { type: 'denied', id: who, reason: 'requires' });
    return;
  }
  const me = centerPx(state, who);
  const a = getComp(state.entities, who, 'avatar');
  if (!me || !a) return;
  // Aim: the held aim direction, else the lock, else the nearest foe in front, else facing.
  let point: Vec | null = f.lock === null ? null : centerPx(state, f.lock);
  if (aim !== null) {
    const d = dirStep(aim);
    point = { x: me.x + d.x * 100, y: me.y + d.y * 100 };
  } else if (!point) {
    const near = nearestInArc(state, who, dirStep(a.facing), 160, 0);
    point = near === null ? null : centerPx(state, near);
  }
  // Emberhand makes Ember techniques cheaper in Focus.
  const gift = activeMods(state, who);
  const cost = tech.cost
    ? tech.skill === 'skill.ember' && tech.cost.pool === 'foc'
      ? applyMods(tech.cost.amount, 'emberFocPct', gift)
      : tech.cost.amount
    : 0;
  if (tech.cost && !spend(state, who, tech.cost.pool, cost)) return;
  f.cooldowns[slot] = tech.cooldown ?? 0;
  emit(state.events, { type: 'techniqueUsed', who, technique: tech.id });
  if (tech.attack && ATTACKS[tech.attack]) startAttack(state, who, tech.attack, point, tech.id);
  if (tech.channel) {
    // Busker: songs last longer.
    const channel = applyMods(tech.channel, 'songTicksPct', gift);
    state.entities.comps.channel[who] = {
      slot,
      technique: tech.id,
      until: state.tick + channel,
    };
    // A song's own effect (courage) starts with it, and ends if it is cut short.
    for (const e of tech.effects ?? []) if (e.kind === 'selfStatus') applyEffect(state, who, e);
    emit(state.events, { type: 'channelStarted', who, technique: tech.id, ticks: channel });
    return;
  }
  for (const e of tech.effects ?? []) applyEffect(state, who, e);
}

/** A song ends when its time is up, and is cut short by moving, a hit or another action. */
export function channelSystem(state: SimState): void {
  for (const who of query(state.entities, 'channel')) {
    const ch = getComp(state.entities, who, 'channel');
    const f = getComp(state.entities, who, 'fighter');
    const a = getComp(state.entities, who, 'avatar');
    const tech = ch ? TECHNIQUES[ch.technique] : undefined;
    if (!ch || !f || !tech) {
      state.entities.comps.channel[who] = null;
      continue;
    }
    const cut =
      f.state !== 'idle' ||
      (a !== undefined && a.intent !== null) ||
      !requirementsMet(state, who, tech);
    if (cut) {
      state.entities.comps.channel[who] = null;
      for (const e of tech.effects ?? [])
        if (e.kind === 'selfStatus') clearStatus(state, who, e.status);
      emit(state.events, { type: 'channelCancelled', who, technique: tech.id });
      continue;
    }
    if (state.tick < ch.until) continue;
    state.entities.comps.channel[who] = null;
    for (const e of tech.effects ?? []) if (e.kind === 'dazeNear') dazeNear(state, who, e);
    emit(state.events, { type: 'perform', who, technique: tech.id });
  }
}
