import { describe, expect, it } from 'vitest';
import { SFX } from '../../src/content/audio/sfx';
import { WEAPONS } from '../../src/content/combat/attacks';
import { CREATURES } from '../../src/content/creatures';
import { ITEMS } from '../../src/content/items';
import { NODES, RECIPES } from '../../src/content/items/recipes';
import { SPRITES } from '../../src/content/sprites';
import { ITEM_STRINGS } from '../../src/content/strings/items';
import { validateItems, validateRealItems } from '../../tools/bake-assets/validateItems';

const sprites = new Set(SPRITES.map((s) => s.id));
const refs = { sprites, strings: ITEM_STRINGS, weapons: WEAPONS };
const check = (items = ITEMS, recipes = RECIPES, nodes = NODES) =>
  validateItems(items, recipes, nodes, CREATURES, refs);

describe('item content', () => {
  it('the real content is valid', () => {
    expect(validateRealItems(sprites)).toEqual([]);
  });
  // M3-12 added 19 recipes and 6 Whisperwood node kinds, so every item can be obtained.
  it('the set has about 140 items, 100 recipes and thirteen node kinds', () => {
    expect(Object.keys(ITEMS).length).toBeGreaterThanOrEqual(110);
    expect(Object.keys(RECIPES)).toHaveLength(101);
    expect(Object.keys(NODES)).toHaveLength(13);
    const count = (c: string) => Object.values(ITEMS).filter((i) => i.category === c).length;
    expect(
      Object.values(ITEMS).filter((i) => i.equip?.slot === 'main' && i.equip.weapon === 'sword'),
    ).toHaveLength(5);
    expect(Object.values(ITEMS).filter((i) => i.equip?.weapon === 'spear')).toHaveLength(4);
    expect(Object.values(ITEMS).filter((i) => i.equip?.slot === 'body')).toHaveLength(8);
    expect(count('consumable')).toBeGreaterThanOrEqual(6);
  });
  it('has a name and a description for every item, and an icon in the atlas', () => {
    for (const d of Object.values(ITEMS)) {
      expect(ITEM_STRINGS[d.nameKey], d.id).toBeTruthy();
      expect(ITEM_STRINGS[d.descKey], d.id).toBeTruthy();
      expect(sprites.has(d.icon), d.id).toBe(true);
    }
  });
  it('the pickup sound exists', () => {
    expect(SFX.some((s) => s.id === 'sfx.pickup')).toBe(true);
  });
  it('catches a missing icon, a missing text, an em dash, and a bad reference', () => {
    const base = ITEMS['item.sunwort']!;
    expect(check({ ...ITEMS, 'item.sunwort': { ...base, icon: 'icon.nope' } })).toEqual(
      expect.arrayContaining([expect.stringContaining('icon icon.nope')]),
    );
    expect(check({ ...ITEMS, 'item.sunwort': { ...base, nameKey: 'x.name' } })).toEqual(
      expect.arrayContaining([expect.stringContaining('x.name is missing')]),
    );
    const dashed = validateItems(ITEMS, RECIPES, NODES, CREATURES, {
      ...refs,
      strings: { ...ITEM_STRINGS, 'item.sunwort.desc': 'A herb — pale.' },
    });
    expect(dashed.some((e) => e.includes('em dash'))).toBe(true);
    expect(
      check(ITEMS, {
        ...RECIPES,
        'recipe.bad': {
          ...RECIPES['recipe.herb_tea']!,
          id: 'recipe.bad',
          ingredients: [{ item: 'item.ghost', qty: 1 }],
        },
      }).some((e) => e.includes('item.ghost')),
    ).toBe(true);
  });
  it('catches two recipes with the same ingredients', () => {
    const dup = {
      ...RECIPES,
      'recipe.dup': {
        ...RECIPES['recipe.herb_tea']!,
        id: 'recipe.dup',
        ingredients: [
          { item: 'item.dewmint', qty: 1 },
          { item: 'item.sunwort', qty: 1 },
        ],
      },
    };
    expect(check(ITEMS, dup).some((e) => e.includes('same ingredients'))).toBe(true);
  });
  it('catches gear that stacks and a main hand with no weapon', () => {
    const sword = ITEMS['item.sword_iron']!;
    expect(
      check({ ...ITEMS, 'item.sword_iron': { ...sword, stack: 5 } }).some((e) =>
        e.includes('must not stack'),
      ),
    ).toBe(true);
    expect(
      check({ ...ITEMS, 'item.sword_iron': { ...sword, equip: { slot: 'main' } } }).some((e) =>
        e.includes('known weapon'),
      ),
    ).toBe(true);
  });
});
