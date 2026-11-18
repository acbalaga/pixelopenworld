import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { createDemoState, deserializeState } from '../../src/sim/state';
import { plainFor } from '../support/saves';

describe('start kit integrity', () => {
  const sealed = (kit: 1 | 2, item: string): SavePlain => {
    const s = createDemoState(6, 0);
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y, 'Kit_1');
    s.ledger.startKit = kit;
    s.ledger.itemsMade.start = { ...s.ledger.itemsMade.start, [item]: 1 };
    s.entities.comps.inventory[me]!.equipment.head = { item, qty: 1 } as never;
    return plainFor(s);
  };
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);

  it('a kit 2 save holding a rusty sword from start fails START_KIT_MISMATCH', () => {
    expect(codes(sealed(2, 'item.sword_rusty'))).toContain('START_KIT_MISMATCH');
  });

  it('a kit 1 save holding one does not', () => {
    const s = createDemoState(6, 0);
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y);
    const inv = s.entities.comps.inventory[me]!;
    // Rebuild the kit 1 character: rusty sword, two bread.
    inv.equipment.main = { item: 'item.sword_rusty', qty: 1 } as never;
    inv.equipment.body = null;
    inv.slots[0] = { item: 'item.dish_bread', qty: 2 } as never;
    s.ledger.startKit = 1;
    s.ledger.itemsMade.start = { 'item.sword_rusty': 1, 'item.dish_bread': 2 };
    expect(codes(plainFor(s))).not.toContain('START_KIT_MISMATCH');
  });
});

describe('schema 17 to 18 migration', () => {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-17.json'), 'utf8'),
  ) as { plain: SavePlain };

  it('marks an old save as kit 1, adds the start stream, loads and passes integrity', async () => {
    expect(fixture.plain.schema).toBe(17);
    const decoded = await new JsonCodec().decode(
      new TextEncoder().encode(JSON.stringify(fixture.plain)),
    );
    const now = migrate(decoded);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(now.ledger.startKit).toBe(1);
    const s = deserializeState(now.sim);
    expect(s.ledger.startKit).toBe(1);
    expect(s.rng.start).toBeDefined();
    const me = findAvatar(s)!;
    // The save keeps what it had, rusty sword included.
    expect(s.entities.comps.inventory[me]!.equipment.main?.item).toBe('item.sword_rusty');
    expect(validateSave(now).reasons).toEqual([]);
  });
});
