import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../src/content/items/recipes';
import { validateSave } from '../../src/save/integrity';
import { give, learnRecipe } from '../../src/sim/items';
import { earnCoin } from '../../src/sim/ledger';
import { unitsOf } from '../../src/sim/crafting';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { Run, S } from '../support/bots';

const count = (run: Run, item: string): number => run.count(item);

/** Crafts a recipe at the anvil in front of the avatar, letting the steps run out. */
function craft(run: Run, id: string): void {
  run.tick({ type: 'craft', items: unitsOf(RECIPES[id]!) });
  for (let i = 0; i < 300 && run.s.entities.comps.craft[run.me]; i++) run.tick();
}

describe('buying iron ore, smelting and forging (POW-M4-23D)', () => {
  it('keeps the seal and every integrity layer through a save and a reload', async () => {
    const run = new Run(41);
    // A purse for the ore, as the ledger records it.
    earnCoin(run.s, run.me, 200, 'seed');
    run.buy('item.iron_ore', 4);
    expect(count(run, 'item.iron_ore')).toBe(4);
    // Coal and a plank are seeded for this test. The ore is Brin's.
    give(run.s, run.me, 'item.coal', 2, 'seed');
    give(run.s, run.me, 'item.oak_plank', 1, 'seed');
    learnRecipe(run.s, run.me, 'recipe.sword_iron');
    spawnFixture(run.s, 'fixture.anvil', 40, 41);
    run.stand(40, 40, S);
    run.tick({ type: 'move', dir: S });
    run.tick({ type: 'move', dir: null });
    craft(run, 'recipe.iron_ingot');
    craft(run, 'recipe.iron_ingot');
    expect(count(run, 'item.iron_ingot')).toBe(2);
    craft(run, 'recipe.sword_iron');
    expect(count(run, 'item.sword_iron')).toBe(1);
    await run.save();
    const snap = run.snapshots.at(-1)!;
    expect(snap.loaded.plain.trust.reasons).toEqual([]);
    expect(snap.loaded.plain.trust.state).toBe('intact');
    const verdict = validateSave(snap.loaded.plain);
    expect(verdict.reasons).toEqual([]);
    expect(verdict.ok).toBe(true);
  });
});
