import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAP_BALANCE } from '../../src/content/balance/map';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate, MIGRATIONS } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { addXp, pointsOf, xpToNext } from '../../src/sim/skills';
import { deserializeState } from '../../src/sim/state';
import { countRevealed } from '../../src/sim/world/fog';

const f = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-27.json'), 'utf8'),
) as { plain: SavePlain; expectedHash: string };

async function decoded(): Promise<SavePlain> {
  return new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
}

/** Points plus banked XP, as XP. */
function totalXp(s: ReturnType<typeof deserializeState>, me: number): number {
  const sk = s.entities.comps.skills[me]!;
  let t = sk.xp['skill.cartography'] ?? 0;
  for (let p = 0; p < pointsOf(s, me, 'skill.cartography'); p++) t += xpToNext(p);
  return t;
}

describe('schema 27 to 28 migration (the map pays Cartography)', () => {
  it('pays the revealed blocks, exactly, and passes every integrity layer', async () => {
    expect(f.plain.schema).toBe(27);
    const before = deserializeState(f.plain.sim);
    const blocks = Object.values(before.map.fog).reduce((n, g) => n + countRevealed(g), 0);
    expect(blocks).toBeGreaterThan(1000);
    expect(before.ledger.xpEarned['skill.cartography']).toBeUndefined();

    const at28 = migrate(await decoded(), MIGRATIONS, 28);
    expect(at28.schema).toBe(28);
    const s = deserializeState(at28.sim);
    const me = s.entities.comps.avatar.findIndex((a) => a);
    expect(totalXp(s, me)).toBe(blocks * MAP_BALANCE.xpPerBlock);
    expect(s.ledger.xpEarned['skill.cartography']).toBe(blocks * MAP_BALANCE.xpPerBlock);
    expect(at28.ledger).toEqual(s.ledger);
    expect(pointsOf(s, me, 'skill.cartography')).toBeGreaterThan(0);
  });

  it('reaches the current schema with the seal and every layer intact', async () => {
    const now = migrate(await decoded());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });

  it('does not pay twice for XP the ledger already records', async () => {
    const plain = await decoded();
    const s = deserializeState(plain.sim);
    const me = s.entities.comps.avatar.findIndex((a) => a);
    const blocks = Object.values(s.map.fog).reduce((n, g) => n + countRevealed(g), 0);
    const owedAll = blocks * MAP_BALANCE.xpPerBlock;
    addXp(s, me, 'skill.cartography', 100);
    const held = s.ledger.xpEarned['skill.cartography'] ?? 0;
    expect(held).toBeGreaterThan(0);
    const { serializeState } = await import('../../src/sim/state');
    const at28 = migrate(
      { ...plain, sim: serializeState(s), ledger: structuredClone(s.ledger) },
      MIGRATIONS,
      28,
    );
    const after = deserializeState(at28.sim);
    expect(after.ledger.xpEarned['skill.cartography']).toBe(owedAll);
    // A save already at or above what the fog is worth gains nothing.
    const rich = deserializeState(at28.sim);
    const again = migrate({ ...at28, schema: 27, sim: at28.sim }, MIGRATIONS, 28);
    expect(deserializeState(again.sim).ledger.xpEarned['skill.cartography']).toBe(owedAll);
    expect(rich.ledger.xpEarned['skill.cartography']).toBe(owedAll);
  });
});
