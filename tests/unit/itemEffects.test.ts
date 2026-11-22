import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/content/items';
import { RECIPES } from '../../src/content/items/recipes';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { countItem, give } from '../../src/sim/items';
import type { SimState } from '../../src/sim/state';
import { createDemoState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { itemActions, itemDetail, itemName } from '../../src/ui/menu/model';

function setup(): { s: SimState; me: number; slotOf: (item: string) => number } {
  const s = createDemoState(5, 0);
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  const slotOf = (item: string): number =>
    s.entities.comps.inventory[me]!.slots.findIndex((x) => x?.item === item);
  return { s, me, slotOf };
}

describe('what an item tells the player (G4 playtest)', () => {
  it('says what a potion restores, in whole points', () => {
    const { s, me, slotOf } = setup();
    give(s, me, 'item.potion_stamina', 1, 'seed');
    const d = itemDetail(s, me, slotOf('item.potion_stamina'))!;
    expect(d.lines).toContain('Restores 40 Stamina');
  });

  it('says what a meal restores and for how long its buff lasts', () => {
    const { s, me, slotOf } = setup();
    give(s, me, 'item.hearty_stew', 1, 'seed');
    const lines = itemDetail(s, me, slotOf('item.hearty_stew'))!.lines.join('|');
    expect(lines).toMatch(/Restores .*Health/);
    expect(lines).toMatch(/Fed for \d+ min: .*max/);
  });

  it('says what a remedy cures and gives', () => {
    const { s, me, slotOf } = setup();
    give(s, me, 'item.fire_salve', 1, 'seed');
    const lines = itemDetail(s, me, slotOf('item.fire_salve'))!.lines.join('|');
    expect(lines).toContain('Cures Burning');
    expect(lines).toContain('Gives Warded for 10 s');
  });

  it('lists the recipes the player knows that use an item, and hides the ones not yet known', () => {
    const { s, me, slotOf } = setup();
    const inv = s.entities.comps.inventory[me]!;
    const user = Object.values(RECIPES).find(
      (r) => !r.enchant && r.ingredients.length > 0 && r.learn !== 'start',
    )!;
    const ing = user.ingredients[0]!.item;
    inv.recipes = inv.recipes.filter((id) => id !== user.id);
    give(s, me, ing, 1, 'seed');
    const before = itemDetail(s, me, slotOf(ing))!.lines.join('|');
    const resultName = itemName(user.result);
    expect(before).not.toContain(resultName);
    inv.recipes.push(user.id);
    const after = itemDetail(s, me, slotOf(ing))!.lines.join('|');
    expect(after).toContain(resultName);
  });

  it('shows where a known recipe is made and from what', () => {
    const { s, me, slotOf } = setup();
    const inv = s.entities.comps.inventory[me]!;
    const r = Object.values(RECIPES).find((x) => !x.enchant && inv.recipes.includes(x.id))!;
    give(s, me, r.result, 1, 'seed');
    const lines = itemDetail(s, me, slotOf(r.result))!.lines.join('|');
    expect(lines).toContain('You can make it at the');
  });
});

describe('throwing junk away (G4 playtest)', () => {
  const JUNK = ['item.burnt_mess', 'item.slag', 'item.wood_scraps', 'item.rags', 'item.sludge'];

  it('marks what a failed craft leaves as junk and offers Throw away instead of Drop', () => {
    for (const id of JUNK) {
      expect(ITEMS[id]?.junk, id).toBe(true);
      expect(itemActions(ITEMS[id]!)).toContain('trash');
      expect(itemActions(ITEMS[id]!)).not.toContain('drop');
    }
    expect(itemActions(ITEMS['item.sword_rusty']!)).toContain('drop');
  });

  it('removes a junk stack for good, leaving nothing on the ground', () => {
    const { s, me, slotOf } = setup();
    give(s, me, 'item.slag', 3, 'seed');
    const slot = slotOf('item.slag');
    const pickups = Object.keys(s.entities.comps.pickup).length;
    stepWorld(s, me, { commands: [{ type: 'trash', slot }] });
    expect(countItem(s.entities.comps.inventory[me]!, 'item.slag')).toBe(0);
    expect(Object.keys(s.entities.comps.pickup).length).toBe(pickups);
  });

  it('refuses to throw away anything that is not junk', () => {
    const { s, me, slotOf } = setup();
    give(s, me, 'item.dish_bread', 1, 'seed');
    const slot = slotOf('item.dish_bread');
    const had = countItem(s.entities.comps.inventory[me]!, 'item.dish_bread');
    stepWorld(s, me, { commands: [{ type: 'trash', slot }] });
    expect(countItem(s.entities.comps.inventory[me]!, 'item.dish_bread')).toBe(had);
  });
});
