import type { EquipSlot } from './types';

/** A number a gear affix, passive, Path gift or status can change. Grows by ticket. */
export type ModStat =
  'power' | 'defense' | 'hpMax' | 'staMax' | 'focMax' | 'critPct' | 'gatherYield';

/** One change to a stat: a flat `add`, a `pct` of the base, or both. Stamina and Focus in tenths. */
export interface Mod {
  stat: ModStat;
  add?: number;
  pct?: number;
}

/**
 * An affix an item can carry (design/05). Enchanting applies them in M3-14. `slots` is where
 * the affix may sit, `tier` the gear tier it belongs to. Text is under `nameKey` in
 * `content/strings/items.ts`.
 */
export interface AffixDef {
  id: string;
  nameKey: string;
  slots: readonly EquipSlot[];
  tier: number;
  mods: readonly Mod[];
}

const WEARABLE: readonly EquipSlot[] = ['main', 'off', 'head', 'body', 'legs', 'accessory'];
const ARMOR: readonly EquipSlot[] = ['off', 'head', 'body', 'legs'];

/** The tier 1 affixes. Numbers are starting values for M3-12 to tune. */
export const AFFIXES: Readonly<Record<string, AffixDef>> = {
  'affix.power_1': {
    id: 'affix.power_1',
    nameKey: 'affix.power_1.name',
    slots: ['main'],
    tier: 1,
    mods: [{ stat: 'power', add: 2 }],
  },
  'affix.defense_1': {
    id: 'affix.defense_1',
    nameKey: 'affix.defense_1.name',
    slots: ARMOR,
    tier: 1,
    mods: [{ stat: 'defense', add: 1 }],
  },
  'affix.stamina_1': {
    id: 'affix.stamina_1',
    nameKey: 'affix.stamina_1.name',
    slots: WEARABLE,
    tier: 1,
    mods: [{ stat: 'staMax', add: 100 }],
  },
  'affix.focus_1': {
    id: 'affix.focus_1',
    nameKey: 'affix.focus_1.name',
    slots: WEARABLE,
    tier: 1,
    mods: [{ stat: 'focMax', add: 100 }],
  },
  'affix.crit_1': {
    id: 'affix.crit_1',
    nameKey: 'affix.crit_1.name',
    slots: ['main', 'accessory'],
    tier: 1,
    mods: [{ stat: 'critPct', add: 3 }],
  },
  'affix.gather_1': {
    id: 'affix.gather_1',
    nameKey: 'affix.gather_1.name',
    slots: ['accessory', 'body', 'legs'],
    tier: 1,
    mods: [{ stat: 'gatherYield', add: 1 }],
  },
};
