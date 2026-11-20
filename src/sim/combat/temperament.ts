import { TEMPERAMENT as TB } from '../../content/balance/temperament';
import { CREATURES } from '../../content/creatures';
import type { CreatureDef, Temperament } from '../../content/creatures/types';
import { getComp, query } from '../kernel/entities';
import { SUBPX } from '../kernel/fixed';
import type { SimState } from '../state';
import { dayPhase } from '../time';

/**
 * Pure temperament rules (design/04, D20). Nothing here touches the clock or a random source, so
 * offline settlement and the tests can ask the same questions the live sim does.
 */

/** Journal flag a boss ticket sets when a field or regional boss falls: `boss:<creature id>`. */
export const BOSS_FLAG = 'boss:';

/**
 * The highest tier the avatar has proven: a passed Trial (threshold n proves tier n+1 of the
 * list, so rank 15 proves tier 1) or a beaten field or regional boss (its tier). 0 when nothing
 * is proven yet.
 */
export function provenTier(passed: readonly string[], flags: readonly string[]): number {
  let best = 0;
  for (const p of passed) {
    const at = Number(p.slice(p.lastIndexOf('@') + 1));
    const i = TB.provenTrialThresholds.indexOf(at as never);
    if (i >= 0) best = Math.max(best, i + 1);
  }
  for (const f of flags) {
    if (!f.startsWith(BOSS_FLAG)) continue;
    const tier = CREATURES[f.slice(BOSS_FLAG.length)]?.tier;
    if (tier) best = Math.max(best, tier);
  }
  return best;
}

/** The avatar's proven tier, read from its skills and journal. */
export function provenTierOf(state: SimState, who: number): number {
  const sk = getComp(state.entities, who, 'skills');
  const j = getComp(state.entities, who, 'journal');
  return provenTier(sk?.passed ?? [], j?.flags ?? []);
}

/** One rung more aggressive. Passive and skittish are never stepped. */
export function stepUp(t: Temperament): Temperament {
  switch (t) {
    case 'defensive':
    case 'curious':
      return 'territorial';
    case 'territorial':
      return 'hostile';
    default:
      return t;
  }
}

/**
 * The territory a creature guards. A creature stepped up from a gentler nature has none in its
 * data, so it guards three quarters of its notice range for the shortest legal warning.
 */
export function territoryOf(def: CreatureDef): { radius: number; warnTicks: number } {
  return (
    def.territory ?? {
      radius: Math.floor((def.notice * 3) / 4),
      warnTicks: TB.warnMinTicksTier1 + 6,
    }
  );
}

/** True from dusk to dawn. */
export function isDark(tick: number): boolean {
  const p = dayPhase(tick);
  return p === 'dusk' || p === 'night';
}

/**
 * The temperament a creature acts on right now: its night one in the dark, then a rung up when its
 * tier is at least `tierGap` above the target's proven tier. Provocation is separate (see `ai.ts`).
 */
export function temperamentNow(def: CreatureDef, worldTick: number, proven: number): Temperament {
  let t = def.night && isDark(worldTick) ? def.night : def.temperament;
  if (def.tier - proven >= TB.tierGap) t = stepUp(t);
  return t;
}

/**
 * A hit on creature `dst` by `src`. A creature that fights back is provoked until it resets, and
 * so is every packmate of the same pack within the pack radius. Passive creatures never are.
 */
export function provoke(state: SimState, dst: number, src: number): void {
  const ai = getComp(state.entities, dst, 'ai');
  const def = ai ? CREATURES[ai.creature] : undefined;
  if (!ai || !def) return;
  mark(state, dst, src);
  if (!def.pack) return;
  const at = getComp(state.entities, dst, 'pos');
  if (!at) return;
  const reach = def.pack.radius * SUBPX;
  for (const o of query(state.entities, 'ai', 'pos')) {
    if (o === dst) continue;
    const oai = getComp(state.entities, o, 'ai');
    const op = getComp(state.entities, o, 'pos');
    if (!oai || !op || CREATURES[oai.creature]?.pack?.id !== def.pack.id) continue;
    if (Math.hypot(op.x - at.x, op.y - at.y) <= reach) mark(state, o, src);
  }
}

function mark(state: SimState, id: number, src: number): void {
  const ai = getComp(state.entities, id, 'ai');
  const def = ai ? CREATURES[ai.creature] : undefined;
  const f = getComp(state.entities, id, 'fighter');
  // A hit ends the calm of a fed creature, whatever its temperament.
  if (ai) delete ai.calmUntil;
  // Passive creatures never fight back. Skittish ones run when hit, and fight only when cornered.
  if (!ai || !def || def.temperament === 'passive' || def.temperament === 'skittish') return;
  if (f?.state === 'dead') return;
  ai.provoked = true;
  if (ai.target === null) ai.target = src;
}
