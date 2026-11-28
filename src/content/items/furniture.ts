import { PIECES } from '../furniture/pieces';
import { item } from './define';
import type { ItemDef } from './types';

/** Furniture pieces as items (POW-M6-07). They list under the Bag's "other" filter until placed. */
export const FURNITURE_ITEMS: readonly ItemDef[] = PIECES.map((p) =>
  item(p.item, 'misc', { value: p.value, tier: 1 }),
);
