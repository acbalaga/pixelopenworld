import { describe, expect, it } from 'vitest';
import { validateSave } from '../../src/save/integrity';
import { honestPlain, tamper } from '../support/saves';

const codes = (p: ReturnType<typeof honestPlain>): string[] =>
  validateSave(p).reasons.map((x) => x.code);

describe('crafting integrity rules', () => {
  it('a Masterwork the ledger does not know is flagged, and an honest save is not', () => {
    expect(codes(honestPlain())).not.toContain('MASTERWORK_WITHOUT_CRAFT');
    const fake = tamper(honestPlain(), (s, me) => {
      s.entities.comps.inventory[me]!.slots[3] = { item: 'item.copper_ingot', qty: 1, q: 3 };
    });
    expect(codes(fake)).toContain('MASTERWORK_WITHOUT_CRAFT');
    // With the ledger saying it was made, the same stack is fine.
    const real = tamper(honestPlain(), (s, me) => {
      s.entities.comps.inventory[me]!.slots[3] = { item: 'item.copper_ingot', qty: 1, q: 3 };
      s.ledger.masterworks['item.copper_ingot'] = 1;
      s.ledger.itemsMade.craft = { 'item.copper_ingot': 1 };
      s.ledger.crafts['recipe.copper_ingot'] = 1;
    });
    expect(codes(real)).not.toContain('MASTERWORK_WITHOUT_CRAFT');
  });
  it('crafted counts must be the recipe quantity times its crafts', () => {
    const fake = tamper(honestPlain(), (s) => {
      s.ledger.itemsMade.craft = { 'item.copper_ingot': 5 };
      s.ledger.crafts['recipe.copper_ingot'] = 1;
    });
    expect(codes(fake)).toContain('CRAFT_MISMATCH');
    const fine = tamper(honestPlain(), (s) => {
      s.ledger.itemsMade.craft = { 'item.oak_plank': 4 };
      s.ledger.crafts['recipe.oak_plank'] = 2;
    });
    expect(codes(fine)).not.toContain('CRAFT_MISMATCH');
  });
});
