import type { EquipSlot } from './types';

/** A number a gear affix, passive, Path gift or status can change. Grows by ticket. */
export type ModStat =
  | 'power'
  | 'defense'
  | 'hpMax'
  | 'staMax'
  | 'focMax'
  | 'critPct'
  | 'gatherYield'
  /** Walking speed, percent (statuses). */
  | 'moveSpeed'
  /** Skill XP, percent (Rested). */
  | 'xp'
  /** Stamina regeneration, percent (Hum of Courage). */
  | 'staRegen'
  /** Stamina cost of a dodge, percent (Tailwind). */
  | 'dodgeCost'
  /** Ticks added to the perfect dodge window (Light Feet). */
  | 'perfectWindow'
  // Path gifts (M3-08). Percent stats are `pct`, tick counts and flags `add`.
  | 'blockStaPct'
  | 'fedTicksPct'
  | 'rawFoodPct'
  | 'buyPct'
  | 'purseRegenPct'
  | 'songTicksPct'
  | 'hideSpeedPct'
  | 'wetTicksPct'
  | 'emberFocPct'
  | 'durabilityLossPct'
  | 'repairMaterialFree'
  | 'noAggroCreature'
  | 'tierDamagePct'
  | 'dodgeRecoverTicks';

/** One change to a stat: a flat `add`, a `pct` of the base, or both. Stamina and Focus in tenths. */
export interface Mod {
  stat: ModStat;
  /** Narrows the mod: a node tag, a creature kind, a creature tier. Absent means everywhere. */
  arg?: string;
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
  // Tier 2: stronger versions of the two staples (M3-14).
  'affix.power_2': {
    id: 'affix.power_2',
    nameKey: 'affix.power_2.name',
    slots: ['main'],
    tier: 2,
    mods: [{ stat: 'power', add: 4 }],
  },
  'affix.defense_2': {
    id: 'affix.defense_2',
    nameKey: 'affix.defense_2.name',
    slots: ARMOR,
    tier: 2,
    mods: [{ stat: 'defense', add: 2 }],
  },
};

/**
 * An affix on a stack is stored as its id, or `id~q` when its enchant came out Fine (1), Superior
 * (2) or Masterwork (3): the strength follows the quality rule (`CRAFTING.affixStrengthPct`).
 */
export function parseAffix(key: string): { id: string; q: number } {
  const i = key.indexOf('~');
  if (i < 0) return { id: key, q: 0 };
  return { id: key.slice(0, i), q: Number(key.slice(i + 1)) };
}

/** The stored form of an affix at a quality. Common is the bare id. */
export function affixKey(id: string, q: number): string {
  return q > 0 ? `${id}~${q}` : id;
}

/** True if the stored key names a real affix at a real quality. */
export function validAffix(key: string): boolean {
  const { id, q } = parseAffix(key);
  return AFFIXES[id] !== undefined && Number.isInteger(q) && q >= 0 && q <= 3;
}
