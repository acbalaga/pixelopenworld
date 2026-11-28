// CLI: `tsx tools/dish-icon-variants.ts`. Picks, for each dish of POW-M6-04, the first icon
// variant that passes the look-alike check against every other item icon and the dishes already
// placed, and writes the result into `DISH_ICON_VARIANT` in src/content/sprites/gen/dishIcons.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { ITEMS } from '../src/content/items';
import { DISHES } from '../src/content/items/dishes';
import { SPRITES } from '../src/content/sprites';
import { DISH_VARIANTS, dishIcon } from '../src/content/sprites/gen/dishIcons';
import type { SpriteDef } from '../src/content/sprites/types';
import { LOOKALIKE_MIN, pixelDistance } from './bake-assets/lookalike';

const MAX_V = DISH_VARIANTS;
const dishIds = new Set(DISHES.map((d) => `icon.${d.key}`));
const byId = new Map(SPRITES.map((s) => [s.id, s]));
const fixed: SpriteDef[] = [...new Set(Object.values(ITEMS).map((i) => i.icon))]
  .filter((id) => !dishIds.has(id))
  .map((id) => byId.get(id))
  .filter((s): s is SpriteDef => !!s);
const placed: SpriteDef[] = [];
const out: Record<string, number> = {};
const stuck: string[] = [];
for (const d of DISHES) {
  let chosen = -1;
  for (let v = 0; v < MAX_V && chosen < 0; v++) {
    const s = dishIcon(d, v);
    if ([...fixed, ...placed].every((o) => pixelDistance(s, o) >= LOOKALIKE_MIN)) chosen = v;
  }
  if (chosen < 0) {
    stuck.push(d.key);
    chosen = 0;
  }
  placed.push(dishIcon(d, chosen));
  if (chosen > 0) out[d.key] = chosen;
}
const file = 'src/content/sprites/gen/dishIcons.ts';
const body = Object.entries(out)
  .map(([k, v]) => `  ${k}: ${v},`)
  .join('\n');
const src = readFileSync(file, 'utf8').replace(
  /export const DISH_ICON_VARIANT: Readonly<Record<string, number>> = \{[^}]*\};/,
  `export const DISH_ICON_VARIANT: Readonly<Record<string, number>> = {${body ? `\n${body}\n` : ''}};`,
);
writeFileSync(file, src);
console.log(`dish-icon-variants: ${Object.keys(out).length} dishes moved off variant 0`);
if (stuck.length > 0) {
  console.log(`no passing variant for: ${stuck.join(', ')}`);
  process.exitCode = 1;
}
