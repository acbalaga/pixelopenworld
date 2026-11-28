/**
 * What the player sees of the fishing records (POW-M6-05): the biggest of each species landed and
 * where, in the order of the species table. A species never landed has no row, and so nothing
 * names a fish the player has not met.
 */
import { FISH } from '../../content/fishing/fish';
import { ITEMS } from '../../content/items';
import { fill } from '../../content/strings/skills';
import { ITEM_STRINGS } from '../../content/strings/items';
import { FISH_STRINGS } from '../../content/strings/fishing';
import type { SimState } from '../../sim/state';

export interface FishRowView {
  item: string;
  icon: string;
  name: string;
  /** "42 cm at the Lark, 6 landed". */
  line: string;
}

export interface FishView {
  rows: FishRowView[];
  /** "3 of 15 species landed". */
  count: string;
}

export function fishView(state: SimState): FishView {
  const rows: FishRowView[] = [];
  for (const f of FISH) {
    const r = state.fishing.records[f.item];
    if (!r) continue;
    const def = ITEMS[f.item];
    rows.push({
      item: f.item,
      icon: def?.icon ?? '',
      name: ITEM_STRINGS[def?.nameKey ?? ''] ?? f.item,
      line: fill(FISH_STRINGS.record, {
        cm: r.best,
        place: FISH_STRINGS.places[r.where] ?? r.where,
        n: r.n,
      }),
    });
  }
  return {
    rows,
    count: fill(FISH_STRINGS.count, { n: rows.length, of: FISH.length }),
  };
}
