import { newStack, recomputeGear } from '../../src/sim/items';
import { madeItems } from '../../src/sim/ledger';
import type { SimState } from '../../src/sim/state';

/**
 * Puts the pre-M4-14 starting weapon in a new avatar's hand: the rusty sword, which matches the
 * base sword stats the combat balance tests were written against. The wooden dagger a new
 * character wakes with is deliberately weaker.
 */
export function withRustySword(s: SimState, me: number): void {
  const inv = s.entities.comps.inventory[me]!;
  inv.equipment.main = newStack('item.sword_rusty', 1);
  inv.equipment.body = null;
  // Recorded as seeded, so the ledger still reconciles with what the avatar holds.
  madeItems(s, 'seed', 'item.sword_rusty', 1);
  recomputeGear(s, me);
}
