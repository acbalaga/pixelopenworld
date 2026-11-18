import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../src/content/items/recipes';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { deserializeState } from '../../src/sim/state';
import { honestPlain, tamper } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-14.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 14 to 15 migration', () => {
  it('teaches the new start recipes and keeps the ones the avatar had', async () => {
    expect(fixture.plain.schema).toBe(14);
    const before = deserializeState(fixture.plain.sim);
    const me = before.entities.comps.avatar.findIndex((a) => a);
    const had = [...before.entities.comps.inventory[me]!.recipes];
    expect(had).toContain('recipe.herb_tea');
    expect(had).not.toContain('recipe.enchant_power_1');

    const now = migrate(
      await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(fixture.plain))),
    );
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const known = deserializeState(now.sim).entities.comps.inventory[me]!.recipes;
    for (const id of had) expect(known).toContain(id);
    for (const r of Object.values(RECIPES).filter((x) => x.learn === 'start'))
      expect(known).toContain(r.id);
    expect(known).toContain('recipe.enchant_power_1');
    expect(validateSave(now).reasons.filter((r) => r.code !== 'XP_IMPLAUSIBLE')).toEqual([]);
  });
});

describe('integrity: AFFIX_WITHOUT_ENCHANT', () => {
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
  const plain = honestPlain();
  const sword = (affixes: string[], crafts: number): SavePlain =>
    tamper(plain, (s, me) => {
      const inv = s.entities.comps.inventory[me]!;
      const st = inv.slots.find((x) => x?.item === 'item.dish_bread');
      void st;
      inv.equipment.main = { item: 'item.sword_rusty', qty: 1, dur: 20, affixes };
      if (crafts) s.ledger.crafts['recipe.enchant_power_1'] = crafts;
    });

  it('passes a save with no affixes and one whose affixes match its enchants', () => {
    expect(codes(plain)).not.toContain('AFFIX_WITHOUT_ENCHANT');
    expect(codes(sword(['affix.power_1'], 1))).not.toContain('AFFIX_WITHOUT_ENCHANT');
  });
  it('flags an affix that no enchant made, and more affixes than enchants', () => {
    expect(codes(sword(['affix.power_1'], 0))).toContain('AFFIX_WITHOUT_ENCHANT');
    expect(codes(sword(['affix.power_1', 'affix.crit_1'], 1))).toContain('AFFIX_WITHOUT_ENCHANT');
  });
});
