import { ITEMS } from '../../src/content/items';
import { ICON_VARIANT_GROUPS } from '../../src/content/sprites/gen/itemGroups';
import { ITEM_STRINGS } from '../../src/content/strings/items';
import type { SpriteDef } from '../../src/content/sprites/types';
import { LOOKALIKE_MIN, LOOKALIKE_VARIANT_MIN, differingRamps, pixelDistance } from './lookalike';

/**
 * Every item has its own icon, its own name, and an icon you can tell from every other
 * (POW-M4-22F). A failure names the pair and its distance, so it says what to redraw.
 */
export function validateItemIcons(sprites: readonly SpriteDef[]): string[] {
  const errors: string[] = [];
  const byId = new Map(sprites.map((s) => [s.id, s]));
  const items = Object.values(ITEMS);

  const byIcon = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const i of items) {
    byIcon.set(i.icon, [...(byIcon.get(i.icon) ?? []), i.id]);
    const name = ITEM_STRINGS[i.nameKey] ?? '';
    byName.set(name, [...(byName.get(name) ?? []), i.id]);
  }
  for (const [icon, ids] of byIcon)
    if (ids.length > 1) errors.push(`icon ${icon} is shared by ${ids.join(', ')}`);
  for (const [name, ids] of byName)
    if (ids.length > 1) errors.push(`display name "${name}" is shared by ${ids.join(', ')}`);

  const sameGroup = (a: string, b: string): boolean =>
    ICON_VARIANT_GROUPS.some((g) => g.includes(a) && g.includes(b));
  const icons = [...byIcon.keys()]
    .map((id) => byId.get(id))
    .filter((s): s is SpriteDef => s !== undefined);
  for (const i of byIcon.keys())
    if (!byId.has(i)) errors.push(`icon ${i} is not a sprite (${byIcon.get(i)?.join(', ')})`);
  for (let i = 0; i < icons.length; i++)
    for (let j = i + 1; j < icons.length; j++) {
      const a = icons[i] as SpriteDef;
      const b = icons[j] as SpriteDef;
      const d = pixelDistance(a, b);
      if (sameGroup(a.id, b.id)) {
        const [ra, rb] = differingRamps(a, b);
        if (d < LOOKALIKE_VARIANT_MIN)
          errors.push(`tier variants ${a.id} and ${b.id} differ by ${d.toFixed(2)}, need 0.10`);
        else if (ra === rb)
          errors.push(`tier variants ${a.id} and ${b.id} differ only within the ${ra} ramp`);
      } else if (d < LOOKALIKE_MIN)
        errors.push(`${a.id} and ${b.id} look alike (d = ${d.toFixed(2)}, need 0.20)`);
    }
  return errors;
}
