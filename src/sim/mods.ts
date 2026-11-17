import { AFFIXES, type Mod, type ModStat } from '../content/items/affixes';
import { EQUIP_SLOTS } from '../content/items/types';
import { getComp, type EntityId } from './kernel/entities';
import type { ItemStack, SimState } from './state';

/**
 * The one path every bonus takes (M3 rule 8). Gear affixes feed it now. Passives, Path gifts and
 * statuses add their own mods here in their tickets. Nothing else may change these numbers.
 */

/** The mods one item stack carries: its affixes, in order. An unknown affix id adds nothing. */
export function stackMods(stack: ItemStack | null | undefined): Mod[] {
  const out: Mod[] = [];
  for (const id of stack?.affixes ?? []) out.push(...(AFFIXES[id]?.mods ?? []));
  return out;
}

/** Every active mod for an entity: what is worn now. */
export function activeMods(state: SimState, who: EntityId): Mod[] {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv) return [];
  const out: Mod[] = [];
  for (const slot of EQUIP_SLOTS) out.push(...stackMods(inv.equipment[slot]));
  return out;
}

/** The flat total for a stat. */
export function modAdd(mods: readonly Mod[], stat: ModStat): number {
  let n = 0;
  for (const m of mods) if (m.stat === stat) n += m.add ?? 0;
  return n;
}

/** The percent total for a stat. */
export function modPct(mods: readonly Mod[], stat: ModStat): number {
  let n = 0;
  for (const m of mods) if (m.stat === stat) n += m.pct ?? 0;
  return n;
}

/** `base` changed by every mod for `stat`: `(base + adds) * (100 + pcts) / 100`, rounded down. */
export function applyMods(base: number, stat: ModStat, mods: readonly Mod[]): number {
  return Math.floor(((base + modAdd(mods, stat)) * (100 + modPct(mods, stat))) / 100);
}
