import { ITEM_STRINGS } from '../../src/content/strings/items';
import { CREATURES } from '../../src/content/creatures';
import { ITEMS } from '../../src/content/items';
import { NODES, RECIPES } from '../../src/content/items/recipes';
import { SKILLS } from '../../src/content/skills';
import { WEAPONS } from '../../src/content/combat/attacks';
import type { ItemDef, NodeDef, RecipeDef } from '../../src/content/items/types';
import type { CreatureDef } from '../../src/content/creatures/types';

/** What items may point at. Passed in so tests can break one thing at a time. */
export interface ItemRefs {
  sprites: ReadonlySet<string>;
  strings: Readonly<Record<string, string>>;
  weapons: Readonly<Record<string, unknown>>;
}

/**
 * Validates item, recipe and node data and what points at them. Returns readable errors. Empty
 * means valid. Item data is plain typed data, so this checks shape and cross references.
 */
export function validateItems(
  items: Readonly<Record<string, ItemDef>>,
  recipes: Readonly<Record<string, RecipeDef>>,
  nodes: Readonly<Record<string, NodeDef>>,
  creatures: Readonly<Record<string, CreatureDef>>,
  refs: ItemRefs,
): string[] {
  const errors: string[] = [];
  const known = (id: string): boolean => items[id] !== undefined;
  for (const [key, d] of Object.entries(items)) {
    const l = `item ${key}`;
    if (d.id !== key) errors.push(`${l}: id ${d.id} does not match its key`);
    if (!/^item\.[a-z0-9_]+$/.test(d.id)) errors.push(`${l}: bad id`);
    if (!refs.sprites.has(d.icon)) errors.push(`${l}: icon ${d.icon} does not exist`);
    for (const k of [d.nameKey, d.descKey]) {
      const t = refs.strings[k];
      if (!t) errors.push(`${l}: text ${k} is missing`);
      else if (t.includes('—')) errors.push(`${l}: text ${k} has an em dash`);
    }
    if (!Number.isInteger(d.stack) || d.stack < 1) errors.push(`${l}: stack must be 1 or more`);
    if (d.tier < 1 || d.tier > 8) errors.push(`${l}: tier ${d.tier} outside 1 to 8`);
    if (d.value < 0) errors.push(`${l}: negative value`);
    if (d.equip) {
      if (d.stack !== 1) errors.push(`${l}: gear must not stack`);
      if (d.equip.slot === 'main') {
        if (!d.equip.weapon || !refs.weapons[d.equip.weapon])
          errors.push(`${l}: main hand needs a known weapon`);
        if (!d.equip.power || d.equip.power <= 0) errors.push(`${l}: main hand needs power`);
      }
    }
    if (d.tool && d.stack !== 1) errors.push(`${l}: tools must not stack`);
    if (d.durability !== undefined && !(d.equip || d.tool))
      errors.push(`${l}: only gear and tools have durability`);
    if ((d.equip || d.tool) && (d.durability === undefined || d.durability < 1))
      errors.push(`${l}: gear and tools need durability`);
    if ((d.affixSlots ?? 0) > 0 && !d.equip) errors.push(`${l}: only gear has affix slots`);
    if (d.quality && d.category === 'currency') errors.push(`${l}: currency has no quality`);
    if (!['gear', 'tools', 'food', 'materials', 'other'].includes(d.bag))
      errors.push(`${l}: unknown bag filter ${d.bag}`);
    if (d.food && (d.food.hp < 0 || d.food.sta < 0 || d.food.foc < 0))
      errors.push(`${l}: food restores a negative amount`);
    if (d.food?.fed && d.food.fed.ticks <= 0) errors.push(`${l}: fed buff needs a duration`);
  }
  for (const [key, r] of Object.entries(recipes)) {
    const l = `recipe ${key}`;
    if (r.id !== key) errors.push(`${l}: id does not match its key`);
    if (r.ingredients.length < 1 || r.ingredients.length > 3)
      errors.push(`${l}: needs 1 to 3 ingredients`);
    for (const i of r.ingredients)
      if (!known(i)) errors.push(`${l}: ingredient ${i} does not exist`);
    if (!known(r.result)) errors.push(`${l}: result ${r.result} does not exist`);
  }
  const seen = new Map<string, string>();
  for (const r of Object.values(recipes)) {
    const k = [...r.ingredients].sort().join(',');
    const other = seen.get(k);
    if (other) errors.push(`recipe ${r.id}: same ingredients as ${other}`);
    seen.set(k, r.id);
  }
  for (const [key, n] of Object.entries(nodes)) {
    const l = `node ${key}`;
    if (n.yields.length === 0) errors.push(`${l}: no yields`);
    for (const y of n.yields)
      if (!known(y.item)) errors.push(`${l}: yield ${y.item} does not exist`);
    for (const s of [n.sprite.ready, n.sprite.spent])
      if (!refs.sprites.has(s)) errors.push(`${l}: sprite ${s} does not exist`);
    if (n.respawn <= 0) errors.push(`${l}: respawn must be positive`);
  }
  for (const c of Object.values(creatures))
    for (const d of c.drops)
      if (!known(d.item)) errors.push(`creature ${c.id}: drop ${d.item} does not exist`);
  return errors;
}

/** The real content, for the CLI. */
export function validateRealItems(sprites: ReadonlySet<string>): string[] {
  const errors = validateItems(ITEMS, RECIPES, NODES, CREATURES, {
    sprites,
    strings: ITEM_STRINGS,
    weapons: WEAPONS,
  });
  const tag = new Set(Object.values(SKILLS).flatMap((s) => s.sources.map((x) => x.tag)));
  for (const n of Object.values(NODES))
    if (!tag.has(n.tag)) errors.push(`node ${n.id}: no skill pays for tag ${n.tag}`);
  return errors;
}
