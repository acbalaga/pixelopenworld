import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FISH_BY_ITEM } from '../../src/content/fishing/fish';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { give } from '../../src/sim/items';
import { newFishing } from '../../src/sim/fishState';
import { createDemoState, deserializeState, hashState } from '../../src/sim/state';
import { plainFor, tamper } from '../support/saves';

/**
 * Fishing and the save (POW-M6-05): the records are checked against the ledger and the species
 * table, and schema 36 saves gain an empty record book and a legend still out there. The fight
 * itself is in `tests/sim/fishing.test.ts`.
 */

describe('Fishing integrity (M6-05)', () => {
  /** An honest save: a river fish and a carp landed, each with its record. */
  function fished(): SavePlain {
    const s = createDemoState(3, 0);
    s.world = { solidAt: (): number => 0 };
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y);
    give(s, me, 'item.fish_river', 2, 'gather');
    give(s, me, 'item.fish_carp', 1, 'gather');
    s.fishing.records['item.fish_river'] = { n: 2, best: 24, where: 'lark' };
    s.fishing.records['item.fish_carp'] = { n: 1, best: 51, where: 'millbrook_pond' };
    s.tick = 3000;
    return plainFor(s, { playSeconds: 100, createdAt: 1_700_000_000_000 + 3 * 86_400_000 });
  }
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);

  it('an honest save with records passes every layer', () => {
    expect(validateSave(fished()).reasons).toEqual([]);
  });

  it('a record size past its species range is caught', () => {
    const big = tamper(fished(), (s) => {
      s.fishing.records['item.fish_river']!.best = 900;
    });
    expect(codes(big)).toContain('FISH_RECORD');
    const tiny = tamper(fished(), (s) => {
      s.fishing.records['item.fish_carp']!.best = FISH_BY_ITEM['item.fish_carp']!.size[0] - 1;
    });
    expect(codes(tiny)).toContain('FISH_RECORD');
  });

  it('a record for a catch the ledger never made, a made-up species or a made-up place is caught', () => {
    expect(
      codes(
        tamper(fished(), (s) => {
          s.fishing.records['item.fish_river']!.n = 40;
        }),
      ),
    ).toContain('FISH_RECORD');
    expect(
      codes(
        tamper(fished(), (s) => {
          s.fishing.records['item.fish_unicorn'] = { n: 1, best: 10, where: 'lark' };
        }),
      ),
    ).toContain('FISH_RECORD');
    expect(
      codes(
        tamper(fished(), (s) => {
          s.fishing.records['item.fish_river']!.where = 'the_moon';
        }),
      ),
    ).toContain('FISH_RECORD');
  });

  it('the legend flag and her record must agree, and she is landed once', () => {
    expect(
      codes(
        tamper(fished(), (s) => {
          s.fishing.gnarl = true;
        }),
      ),
    ).toContain('FISH_RECORD');
    expect(
      codes(
        tamper(fished(), (s, me) => {
          give(s, me, 'item.old_gnarl', 2, 'gather');
          s.fishing.records['item.old_gnarl'] = { n: 2, best: 130, where: 'millbrook_pond' };
          s.fishing.gnarl = true;
        }),
      ),
    ).toContain('FISH_RECORD');
  });

  it('a fish edited into the bag is caught', () => {
    const bad = tamper(fished(), (s, me) => {
      give(s, me, 'item.fish_pike', 5, 'gather');
      s.entities.comps.inventory[me]!.slots.forEach((st) => {
        if (st?.item === 'item.fish_pike') st.qty += 50;
      });
    });
    expect(codes(bad)).toContain('ITEMS_EXCEED_MADE');
  });
});

describe('the save (M6-05)', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-36.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };
  const decode = (): Promise<SavePlain> =>
    new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

  it('schema 36 to 37 gives an old save an empty record book and Old Gnarl still out there', async () => {
    expect(f.plain.schema).toBe(36);
    expect(JSON.parse(f.plain.sim)).not.toHaveProperty('fishing');
    const at37 = migrate(await decode(), MIGRATIONS, 37);
    expect(at37.schema).toBe(37);
    const s = deserializeState(at37.sim);
    expect(s.fishing).toEqual(newFishing());
    delete (s as { fishing?: unknown }).fishing;
    expect(hashState(s)).toBe(f.expectedHash);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });
});
