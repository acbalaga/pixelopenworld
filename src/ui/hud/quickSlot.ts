import { ITEMS } from '../../content/items';
import type { Inventory } from '../../sim/state';

/**
 * The quick slot (G4 playtest, design/09 "quick-use slots"): one HUD button that uses a
 * consumable without opening the Bag. The player pins up to `MAX_PINNED` items from the Bag;
 * a long press on the button steps through the pinned ones held. With none pinned it offers
 * the first usable item in the Bag. Which item is pinned and picked are UI settings, outside the
 * save: the button only ever sends the ordinary `use` command for a bag slot.
 */
export const MAX_PINNED = 3;

/** What the quick slot remembers (in settings). */
export interface QuickPrefs {
  /** Pinned item ids, oldest first. */
  quickItems: readonly string[];
  /** The item showing on the button, or ''. */
  quickPick: string;
}

/** True for items the quick slot can hold: food, and gadgets other than the lantern. */
export function quickUsable(itemId: string): boolean {
  const d = ITEMS[itemId];
  return !!d && (!!d.food || (!!d.gadget && d.gadget !== 'lantern'));
}

/** Usable item ids in the Bag, in bag order, each once. */
export function quickCandidates(inv: Inventory | null | undefined): string[] {
  const out: string[] = [];
  for (const s of inv?.slots ?? [])
    if (s && s.qty > 0 && quickUsable(s.item) && !out.includes(s.item)) out.push(s.item);
  return out;
}

/** The items the button steps through: pinned ones held, or with none of those, every usable one. */
function pool(inv: Inventory | null | undefined, p: QuickPrefs): string[] {
  const held = quickCandidates(inv);
  const pinned = p.quickItems.filter((i) => held.includes(i));
  return pinned.length > 0 ? pinned : held;
}

/** The item on the button now, or null when the Bag holds nothing it can use. */
export function quickItem(inv: Inventory | null | undefined, p: QuickPrefs): string | null {
  const list = pool(inv, p);
  if (list.length === 0) return null;
  return list.includes(p.quickPick) ? p.quickPick : (list[0] as string);
}

/** The next item a long press moves to (wrapping), or null. */
export function quickNext(inv: Inventory | null | undefined, p: QuickPrefs): string | null {
  const list = pool(inv, p);
  if (list.length === 0) return null;
  const cur = quickItem(inv, p);
  return list[(list.indexOf(cur as string) + 1) % list.length] as string;
}

/** The bag slot to use for an item (the first stack of it), or -1. */
export function quickSlotOf(inv: Inventory | null | undefined, itemId: string): number {
  return inv?.slots.findIndex((s) => s !== null && s.item === itemId && s.qty > 0) ?? -1;
}

/** How many of an item the Bag holds, over all its stacks. */
export function quickCount(inv: Inventory | null | undefined, itemId: string): number {
  let n = 0;
  for (const s of inv?.slots ?? []) if (s && s.item === itemId) n += s.qty;
  return n;
}

/** Pins or unpins an item. Pinning a fourth drops the oldest. A newly pinned item is picked. */
export function togglePin(
  p: QuickPrefs,
  itemId: string,
): { quickItems: string[]; quickPick: string } {
  if (p.quickItems.includes(itemId))
    return {
      quickItems: p.quickItems.filter((i) => i !== itemId),
      quickPick: p.quickPick === itemId ? '' : p.quickPick,
    };
  return { quickItems: [...p.quickItems, itemId].slice(-MAX_PINNED), quickPick: itemId };
}
