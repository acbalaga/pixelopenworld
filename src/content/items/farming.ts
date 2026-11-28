import { CROP_LIST } from '../farming/crops';
import { item } from './define';
import type { ItemDef } from './types';

/**
 * Farming items (POW-M6-02), made from the crop table: each new crop, every seed, compost, the hoe
 * and the watering can. Crops carry a quality; seeds do not. Crops whose item already exists
 * (flax fiber, sunwort, dewmint, glowcap) keep it.
 */
export const FARMING_ITEMS: readonly ItemDef[] = [
  ...CROP_LIST.filter((c) => c.value !== undefined).map((c) =>
    item(c.result, 'material', { value: c.value as number, tier: c.tier, quality: true }),
  ),
  ...CROP_LIST.map((c) => item(c.seed, 'material', { value: c.seedValue, tier: c.tier })),
  item('item.compost', 'material', { value: 4 }),
  item('item.hoe', 'tool', { value: 20, tier: 1, durability: 60, tool: { kind: 'hoe', tier: 1 } }),
  item('item.watering_can', 'tool', {
    value: 24,
    tier: 1,
    durability: 60,
    tool: { kind: 'can', tier: 1 },
  }),
];
