import { PIT } from '../../content/balance/travelers';
import { PLACE_SPOTS } from '../../content/people/placeSpots';
import { findAvatar } from '../../shared/summary';
import { getComp } from '../kernel/entities';
import { SUBPX } from '../kernel/fixed';
import type { SimState } from '../state';

/**
 * The Pit's flags (POW-M5-29). They are strings in the player's journal, which is already saved, so
 * a flag needs no new save field. Pure: it reads the state and, for the visit check, writes one flag.
 */

const journalOf = (state: SimState) => {
  const me = findAvatar(state);
  return me === null ? undefined : getComp(state.entities, me, 'journal');
};

/** True if the player's journal has the flag. */
export const hasFlag = (state: SimState, flag: string): boolean =>
  journalOf(state)?.flags.includes(flag) === true;

/** Adds a flag to the player's journal once. */
export function addFlag(state: SimState, flag: string): void {
  const j = journalOf(state);
  if (j && !j.flags.includes(flag)) j.flags.push(flag);
}

/** The crates have been slid aside. */
export const pitOpen = (state: SimState): boolean => hasFlag(state, PIT.flags.open);

/** True if every flag a trail rumor needs is set. */
export const gateOpen = (state: SimState, needs: readonly string[]): boolean =>
  needs.every((f) => hasFlag(state, f));

/** Once a second: standing in or near the quarry counts as having been to the quarry. */
export function pitSystem(state: SimState): void {
  if (state.tick % 30 !== 0) return;
  const me = findAvatar(state);
  const p = me === null ? undefined : state.entities.comps.pos[me];
  const r = PLACE_SPOTS[PIT.visitPlace]?.rect;
  if (!p || !r || hasFlag(state, PIT.flags.quarry)) return;
  const tx = Math.floor(p.x / SUBPX / 16);
  const ty = Math.floor(p.y / SUBPX / 16);
  const k = PIT.visitRadius;
  if (tx >= r.x - k && tx < r.x + r.w + k && ty >= r.y - k && ty < r.y + r.h + k)
    addFlag(state, PIT.flags.quarry);
}
