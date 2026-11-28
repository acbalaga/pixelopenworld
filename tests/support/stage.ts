import type { SimState } from '../../src/sim/state';
import { PLACE_LIST } from '../../src/sim/travelers/lists';
import { MIN_PER_DAY } from '../../src/sim/travelers/schedule';

/**
 * Staging for scenario tests (POW-M6-20). A staged test chooses its own cast instead of hoping a
 * seed's dice put the right Travelers in the right place: only the staged slots are online, all day,
 * and (when a place is given) they are there and social. Nothing here changes a rate, a weight or a
 * template, so a new roll anywhere in the chat or social dice cannot move a staged test.
 *
 * Call `hold` every in-game minute or so. It reapplies the cast, because the crowd reloads sessions
 * at real midnight and a Traveler's activity can run out.
 */
export interface Cast {
  slots: readonly number[];
  /** Keep them social at this place (a `PLACE_LIST` id), arrived. */
  place?: string;
}

export function hold(s: SimState, cast: Cast): void {
  const c = s.crowd;
  if (!c) return;
  const on = new Set(cast.slots);
  for (let slot = 0; slot < s.travelers.length; slot++) {
    c.today[slot] = on.has(slot) ? [{ start: 0, end: MIN_PER_DAY }] : [];
    c.yesterday[slot] = [];
  }
  if (cast.place === undefined) return;
  const to = PLACE_LIST.indexOf(cast.place);
  if (to < 0) throw new Error(`stage: unknown place ${cast.place}`);
  for (const slot of cast.slots) {
    const d = c.doing[slot];
    if (d && d.kind === 'social' && d.place === to && d.eta === 0) {
      if (d.left < 60) d.left = 600;
      continue;
    }
    c.doing[slot] = {
      kind: 'social',
      place: to,
      left: 600,
      eta: 0,
      from: to,
      total: 0,
      skill: -1,
      thing: '',
    };
  }
}

/** A Traveler's highest skill points. */
export function topPoints(s: SimState, slot: number): number {
  let t = 0;
  for (const [, p] of s.travelers[slot]!.build) t = Math.max(t, p);
  return t;
}

/**
 * Seeds a staged test runs on. Three by default, so CI stays quick. `STAGED_SEEDS=20 npm run test`
 * runs twenty in a row (the POW-M6-20 acceptance loop).
 */
export function stagedSeeds(): number[] {
  const n = Number(process.env.STAGED_SEEDS ?? 3);
  return Array.from({ length: Number.isFinite(n) && n > 0 ? n : 3 }, (_, i) => 101 + i * 7);
}
