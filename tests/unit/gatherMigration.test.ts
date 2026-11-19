import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import type { SavePlain } from '../../src/save/types';
import { madeItems } from '../../src/sim/ledger';
import { addItem } from '../../src/sim/items';
import { deserializeState } from '../../src/sim/state';
import { honestPlain, tamper } from '../support/saves';
import { LAST_SLICE_SCHEMA } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-9.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 9 to 10 migration', () => {
  it('makes every node ready, because readyAt is now in world ticks', async () => {
    expect(fixture.plain.schema).toBe(9);
    const before = deserializeState(fixture.plain.sim);
    // The fixture was exported with a spent node and a ready one.
    expect(before.entities.comps.node.filter((n) => n && n.readyAt > 0)).toHaveLength(1);
    const now = migrate(
      await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(fixture.plain))),
      MIGRATIONS,
      LAST_SLICE_SCHEMA,
    );
    expect(now.schema).toBe(LAST_SLICE_SCHEMA);
    const s = deserializeState(now.sim);
    const nodes = s.entities.comps.node.filter((n) => n);
    expect(nodes).toHaveLength(2);
    for (const n of nodes) expect(n!.readyAt).toBe(0);
    // What the save held is still there.
    const me = s.entities.comps.avatar.findIndex((a) => a);
    expect(s.entities.comps.skills[me]!.points['skill.blades']).toBe(2);
    expect(validateSave(now).reasons.filter((r) => r.code !== 'XP_IMPLAUSIBLE')).toEqual([]);
  });
});

describe('GATHER_RATE', () => {
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
  it('is quiet for honest totals and fires for far too many gathered items in 100 seconds', () => {
    const base = honestPlain();
    expect(codes(base)).not.toContain('GATHER_RATE');
    const many = tamper(base, (s, me) => {
      madeItems(s, 'gather', 'item.copper_ore', 5000);
      addItem(s.entities.comps.inventory[me]!, 'item.copper_ore', 100);
    });
    expect(codes(many)).toContain('GATHER_RATE');
  });
});
