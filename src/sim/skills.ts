import { COMBAT as C } from '../content/balance/combat';
import { SKILLS_BALANCE as B } from '../content/balance/skills';
import { SKILLS, TRIALS, trialKey } from '../content/skills';
import { getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import type { SimState, Skills } from './state';

/** An avatar with no skill points. */
export function newSkills(): Skills {
  return { points: {}, xp: {}, passed: [], offered: [], seen: [], stride: { x: 0, y: 0, acc: 0 } };
}

/** XP needed to go from `points` to `points + 1`. Grows smoothly. */
export function xpToNext(points: number): number {
  const c = B.curve;
  return c.base + c.perPoint * points + Math.floor((points * points * c.quadPermille) / 1000);
}

/**
 * Pay for a target of `tier` at `points` skill, in percent (design/03). At or below par rank
 * the target is a fair fight and pays 100. Past par the pay falls in a straight line to the
 * floor at `farBelowPoints`. Targets above par pay more, capped.
 */
export function challengePct(tier: number, points: number): number {
  const ch = B.challenge;
  const par = ch.parRank[Math.min(Math.max(tier, 1), ch.parRank.length - 1)] ?? 0;
  const gap = points - par;
  if (gap <= 0) return Math.min(ch.ceilPct, 100 + -gap * ch.abovePctPerPoint);
  if (gap >= ch.farBelowPoints) return ch.floorPct;
  return 100 - Math.floor((gap * (100 - ch.floorPct)) / ch.farBelowPoints);
}

/** Mastery rank name for a number of points. */
export function masteryName(points: number): string {
  let name: string = B.mastery[0].name;
  for (const m of B.mastery) if (points >= m.points) name = m.name;
  return name;
}

/** Skill points, 0 if none yet. */
export function pointsOf(state: SimState, who: EntityId, skill: string): number {
  return getComp(state.entities, who, 'skills')?.points[skill] ?? 0;
}

/** True if the Trial for reaching `threshold` in `skill` has been passed. */
export function trialPassed(s: Skills, skill: string, threshold: number): boolean {
  return s.passed.includes(trialKey(skill, threshold));
}

/** The point the skill is waiting to reach, if it needs a Trial it has not passed. */
export function pendingTrial(s: Skills, skill: string): number | null {
  const next = (s.points[skill] ?? 0) + 1;
  if ((B.thresholds as readonly number[]).includes(next) && !trialPassed(s, skill, next))
    return next;
  return null;
}

/**
 * Sets Health, Stamina and Focus maxima from skill points (design/03) and the Fed buff. Gains
 * fill the pool too. Losses clamp it.
 */
export function recomputePools(state: SimState, who: EntityId): void {
  const s = getComp(state.entities, who, 'skills');
  const p = getComp(state.entities, who, 'pools');
  if (!s || !p) return;
  const sums = { hp: 0, sta: 0, foc: 0 };
  for (const id of Object.keys(s.points).sort()) {
    const def = SKILLS[id];
    if (!def) continue;
    const pts = s.points[id] ?? 0;
    for (const k of ['hp', 'sta', 'foc'] as const) {
      const a = B.attributes[k];
      if (
        (a.families as readonly string[]).includes(def.family) ||
        (a.skills as readonly string[]).includes(id)
      )
        sums[k] += pts * a.perPoint;
    }
  }
  const fed = getComp(state.entities, who, 'fed');
  const max = {
    hp: C.pools.hpMax + sums.hp + (fed?.hpMax ?? 0),
    sta: C.pools.staMax + sums.sta + (fed?.staMax ?? 0),
    foc: C.pools.focMax + sums.foc + (fed?.focMax ?? 0),
  };
  for (const k of ['hp', 'sta', 'foc'] as const) {
    const key = `${k}Max` as 'hpMax' | 'staMax' | 'focMax';
    const gain = Math.max(0, max[k] - p[key]);
    p[key] = max[k];
    p[k] = Math.min(max[k], p[k] + gain);
  }
}

/** Turns banked and fresh XP into points, stopping at a point that waits on a Trial. */
function settle(state: SimState, who: EntityId, skill: string): void {
  const s = getComp(state.entities, who, 'skills');
  if (!s) return;
  let changed = false;
  for (;;) {
    const p = s.points[skill] ?? 0;
    if (p >= B.maxPoints || pendingTrial(s, skill) !== null) break;
    const cost = xpToNext(p);
    const xp = s.xp[skill] ?? 0;
    if (xp < cost) break;
    s.xp[skill] = xp - cost;
    s.points[skill] = p + 1;
    changed = true;
    const reached = B.mastery.find((m) => m.points === p + 1);
    emit(state.events, {
      type: 'skillRankUp',
      id: who,
      skill,
      points: p + 1,
      mastery: reached ? reached.name : null,
    });
  }
  if (changed) recomputePools(state, who);
}

/** Adds XP to a skill. XP past a pending Trial is banked, not lost. */
export function addXp(state: SimState, who: EntityId, skill: string, amount: number): void {
  const s = getComp(state.entities, who, 'skills');
  if (!s || amount <= 0 || !SKILLS[skill]) return;
  const p = s.points[skill] ?? 0;
  if (p >= B.maxPoints) return;
  const before = s.xp[skill] ?? 0;
  s.xp[skill] = before + amount;
  emit(state.events, { type: 'skillXp', id: who, skill, amount });
  if (pendingTrial(s, skill) !== null) {
    const cost = xpToNext(p);
    if (before < cost && before + amount >= cost)
      emit(state.events, { type: 'skillBanked', id: who, skill });
    return;
  }
  settle(state, who, skill);
}

/** An NPC gives a Trial. It can then be passed. */
export function offerTrial(state: SimState, who: EntityId, trialId: string): boolean {
  const s = getComp(state.entities, who, 'skills');
  const t = TRIALS[trialId];
  if (!s || !t || s.offered.includes(trialId) || trialPassed(s, t.skill, t.threshold)) return false;
  s.offered.push(trialId);
  emit(state.events, { type: 'trialOffered', id: who, trial: trialId });
  return true;
}

/** Sets the Trial flag and releases the banked XP. Returns false if unknown or already passed. */
export function passTrial(state: SimState, who: EntityId, trialId: string): boolean {
  const s = getComp(state.entities, who, 'skills');
  const t = TRIALS[trialId];
  if (!s || !t || trialPassed(s, t.skill, t.threshold)) return false;
  s.passed.push(trialKey(t.skill, t.threshold));
  s.offered = s.offered.filter((o) => o !== trialId);
  emit(state.events, { type: 'trialPassed', id: who, trial: trialId });
  settle(state, who, t.skill);
  return true;
}
