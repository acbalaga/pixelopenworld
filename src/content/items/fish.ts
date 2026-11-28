import { FISH } from '../fishing/fish';
import { item } from './define';
import type { ItemDef } from './types';

/**
 * Fish (POW-M6-05), from the species table. Value follows difficulty. The two fish that existed
 * before the minigame, and the ones the placeholder paid, keep their items in `materials.ts`.
 */
const VALUE: Readonly<Record<number, number>> = { 1: 6, 2: 13, 3: 24, 4: 52, 5: 0 };
const OLD = new Set(['item.fish_river', 'item.fish_silver']);

export const FISH_ITEMS: readonly ItemDef[] = [
  ...FISH.filter((f) => !OLD.has(f.item) && !f.legend).map((f) =>
    item(f.item, 'material', {
      value: VALUE[f.difficulty] ?? 6,
      tier: f.difficulty >= 3 ? 2 : 1,
      quality: true,
    }),
  ),
  // The legend never stacks twice (once per save) and carries no quality: it is the fish.
  ...FISH.filter((f) => f.legend).map((f) =>
    item(f.item, 'misc', { value: 400, tier: 3, stack: 1 }),
  ),
];
