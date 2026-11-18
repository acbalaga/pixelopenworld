import { AFFIXES, type Mod, type ModStat } from '../content/items/affixes';
import { EQUIP_SLOTS } from '../content/items/types';
import { ITEMS } from '../content/items';
import { STATUSES, type StatusId } from '../content/combat/statuses';
import { TECHNIQUE_LIST } from '../content/combat/techniques';
import { getComp, type EntityId } from './kernel/entities';
import type { ItemStack, SimState, StatusEntry } from './state';

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

/** The unit's active statuses, or an empty list. */
export function statusesOf(state: SimState, who: EntityId): readonly StatusEntry[] {
  return getComp(state.entities, who, 'statuses') ?? [];
}

/** True if the unit has the status. */
export function hasStatus(state: SimState, who: EntityId, id: StatusId): boolean {
  return statusesOf(state, who).some((s) => s.id === id);
}

/**
 * The mods of every status on an entity. A Fed status takes its pool bonuses from the meal that
 * started it. Statuses of any unit, avatar or creature, go through this one path.
 */
export function statusMods(state: SimState, who: EntityId): Mod[] {
  const list = getComp(state.entities, who, 'statuses');
  if (!list) return [];
  const out: Mod[] = [];
  for (const st of list) {
    const def = STATUSES[st.id as StatusId];
    if (!def) continue;
    if (def.mods) out.push(...def.mods);
    const fed = st.id === 'fed' && st.item ? ITEMS[st.item]?.food?.fed : undefined;
    if (fed) {
      out.push(
        { stat: 'hpMax', add: fed.hpMax },
        { stat: 'staMax', add: fed.staMax },
        { stat: 'focMax', add: fed.focMax },
      );
    }
  }
  return out;
}

/** The mods of passive techniques the entity's skill points have reached. */
export function passiveMods(state: SimState, who: EntityId): Mod[] {
  const s = getComp(state.entities, who, 'skills');
  if (!s) return [];
  const out: Mod[] = [];
  for (const t of TECHNIQUE_LIST)
    if (t.kind === 'passive' && t.passive && (s.points[t.skill] ?? 0) >= t.band)
      out.push(...t.passive);
  return out;
}

/** Every active mod for an entity: what is worn now, and what its statuses do. */
export function activeMods(state: SimState, who: EntityId): Mod[] {
  const out: Mod[] = [];
  const inv = getComp(state.entities, who, 'inventory');
  if (inv) for (const slot of EQUIP_SLOTS) out.push(...stackMods(inv.equipment[slot]));
  out.push(...statusMods(state, who));
  out.push(...passiveMods(state, who));
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
