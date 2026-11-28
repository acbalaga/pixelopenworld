/**
 * Tier 1 and 2 items that cannot be obtained yet, each with the reason (POW-M3-12). The list
 * exists to be emptied: an entry goes when the thing that supplies the item lands, and the check
 * fails if an entry is obtainable by then.
 */
const HUSBANDRY = 'Animal goods come from the pens of POW-M6-03 (Husbandry).';
const ANIMAL_DISH = 'A dish of animal goods (POW-M6-04): cookable once POW-M6-03 adds the pens.';

export const ALLOWED: Readonly<Record<string, string>> = {
  'item.egg': HUSBANDRY,
  'item.duck_egg': HUSBANDRY,
  'item.milk': HUSBANDRY,
  'item.goat_milk': HUSBANDRY,
  'item.omelette': ANIMAL_DISH,
  'item.pancakes': ANIMAL_DISH,
  'item.milk_bread': ANIMAL_DISH,
  'item.goat_porridge': ANIMAL_DISH,
};
