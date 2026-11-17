import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { deserializeState } from '../../src/sim/state';
import { honestPlain } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-8.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 8 to 9 migration', () => {
  it('gives every fighter a lowered guard and a zero stood-still count', async () => {
    expect(fixture.plain.schema).toBe(8);
    const bytes = new TextEncoder().encode(JSON.stringify(fixture.plain));
    const now = migrate(await new JsonCodec().decode(bytes));
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const fighters = s.entities.comps.fighter.filter((f) => f);
    // The avatar and the Mossling the fixture was exported with.
    expect(fighters).toHaveLength(2);
    for (const f of fighters) expect(f).toMatchObject({ guard: false, guardT: 0, still: 0 });
    // What the save held is still there.
    const me = s.entities.comps.avatar.findIndex((a) => a);
    expect(s.entities.comps.skills[me]!.points['skill.blades']).toBe(2);
    expect(s.entities.comps.inventory[me]!.equipment.main?.item).toBe('item.sword_rusty');
    expect(validateSave(now).reasons.filter((r) => r.code !== 'XP_IMPLAUSIBLE')).toEqual([]);
  });

  it('a save made now is at the current schema and reloads with guards intact', () => {
    const p = honestPlain();
    expect(p.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(p.sim);
    for (const f of s.entities.comps.fighter) if (f) expect(f.guard).toBe(false);
  });
});
