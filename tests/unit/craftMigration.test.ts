import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../src/content/items/recipes';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createStream } from '../../src/sim/kernel/rng';
import { deserializeState } from '../../src/sim/state';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-10.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 10 to 11 migration', () => {
  it('seeds the craft stream from the save seed, adds the craft component, and teaches the start recipes', async () => {
    expect(fixture.plain.schema).toBe(10);
    const before = deserializeState(fixture.plain.sim);
    expect((before.rng as unknown as Record<string, unknown>).craft).toBeUndefined();
    const now = migrate(
      await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(fixture.plain))),
    );
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    // The stream is the one createStreams would have made for this seed.
    expect(s.rng.craft).toEqual(createStream(s.seed, 'craft'));
    const me = s.entities.comps.avatar.findIndex((a) => a);
    expect(s.entities.comps.craft[me]).toBeNull();
    const known = s.entities.comps.inventory[me]!.recipes;
    for (const r of Object.values(RECIPES).filter((x) => x.learn === 'start'))
      expect(known).toContain(r.id);
    // What the save held, and its camp pot, are still there.
    expect(s.entities.comps.skills[me]!.points['skill.blades']).toBe(2);
    expect(known).toContain('recipe.herb_tea');
    expect(validateSave(now).reasons.filter((r) => r.code !== 'XP_IMPLAUSIBLE')).toEqual([]);
  });
});
