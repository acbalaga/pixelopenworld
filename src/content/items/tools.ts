import type { ItemDef, ToolKind } from './types';
import { item } from './define';

/** Pick, axe, sickle, rod and hammer at two tiers (M3-06 uses them to gather, M3-07 to craft). */
const tool = (id: string, kind: ToolKind, tier: number, value: number): ItemDef =>
  item(id, 'tool', {
    value,
    tier,
    quality: true,
    durability: tier === 1 ? 40 : 70,
    tool: { kind, tier },
  });

export const TOOL_ITEMS: readonly ItemDef[] = [
  tool('item.pick_copper', 'pick', 1, 30),
  tool('item.pick_iron', 'pick', 2, 80),
  tool('item.axe_copper', 'axe', 1, 30),
  tool('item.axe_iron', 'axe', 2, 80),
  tool('item.sickle_copper', 'sickle', 1, 24),
  tool('item.sickle_iron', 'sickle', 2, 64),
  tool('item.rod_ash', 'rod', 1, 22),
  tool('item.rod_yew', 'rod', 2, 60),
  tool('item.hammer_copper', 'hammer', 1, 34),
  tool('item.hammer_iron', 'hammer', 2, 90),
];
