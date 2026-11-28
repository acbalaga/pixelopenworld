import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FARMING as F } from '../../src/content/balance/farming';
import { CROPS } from '../../src/content/farming/crops';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { DAY_TICKS, harvest, lease, needOf, newFarm, plant, till } from '../../src/sim/farming';
import { addItem, give } from '../../src/sim/items';
import { earnCoin, spendCoin } from '../../src/sim/ledger';
import { createDemoState, deserializeState, hashState } from '../../src/sim/state';
import { seasonOf } from '../../src/sim/time';
import { plainFor, tamper } from '../support/saves';

/**
 * Farming and the save (POW-M6-02): harvest is a ledger source with a bound, a crop stack edited up
 * is caught, and schema 35 saves gain an empty field. The rules themselves are in
 * `tests/sim/farming.test.ts`.
 */

describe('Farming integrity (M6-02)', () => {
  /** An honest save: a field leased and tilled, one turnip crop harvested, the tools paid for. */
  function farmed(): SavePlain {
    const s = createDemoState(3, 0);
    s.world = { solidAt: (): number => 0 };
    s.weatherOverride = 'clear';
    let t = 0;
    while (seasonOf(t) !== 'spring') t += DAY_TICKS;
    s.worldTick = t + DAY_TICKS / 2;
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y);
    earnCoin(s, me, 1000, 'seed');
    give(s, me, 'item.hoe', 1, 'shop');
    give(s, me, 'item.watering_can', 1, 'shop');
    give(s, me, 'item.seed_turnip', 1, 'shop');
    expect(lease(s, me, F.plots, F.lease.maxWeeks)).toBe(true);
    expect(till(s, me, 0)).toBe(true);
    const slot = s.entities.comps.inventory[me]!.slots.findIndex(
      (x) => x?.item === 'item.seed_turnip',
    );
    expect(plant(s, me, 0, slot)).toBe(true);
    s.worldTick += 2 * DAY_TICKS + 1;
    expect(harvest(s, me, 0)).toBe(true);
    // Pay for the hoe, the can and the seed the way a shop would have charged.
    spendCoin(s, me, 65, 'purchase');
    s.tick = 3000;
    return plainFor(s, { playSeconds: 100, createdAt: 1_700_000_000_000 + 3 * 86_400_000 });
  }
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);

  it('an honest farmed save passes every layer', () => {
    expect(validateSave(farmed()).reasons).toEqual([]);
  });

  it('a crop stack edited up is caught', () => {
    const bad = tamper(farmed(), (s, me) => {
      addItem(s.entities.comps.inventory[me]!, 'item.turnip', 50);
    });
    expect(codes(bad)).toContain('ITEMS_EXCEED_MADE');
  });

  it('harvests and their crops past what the field could grow are caught', () => {
    const many = tamper(farmed(), (s, me) => {
      s.ledger.harvests = 100_000;
      give(s, me, 'item.turnip', 5, 'harvest');
    });
    expect(codes(many)).toContain('HARVEST_IMPLAUSIBLE');
    const fat = tamper(farmed(), (s, me) => {
      give(s, me, 'item.turnip', 500, 'harvest');
    });
    expect(codes(fat)).toContain('HARVEST_IMPLAUSIBLE');
  });
});

describe('the save (M6-02)', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-35.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };
  const decode = (): Promise<SavePlain> =>
    new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

  it('schema 35 to 36 gives an old save a new, unleased field and nothing else changes', async () => {
    expect(f.plain.schema).toBe(35);
    expect(JSON.parse(f.plain.sim)).not.toHaveProperty('farm');
    const at36 = migrate(await decode(), MIGRATIONS, 36);
    expect(at36.schema).toBe(36);
    const s = deserializeState(at36.sim);
    expect(s.farm).toEqual(newFarm());
    expect(needOf(CROPS['crop.turnip']!)).toBe(DAY_TICKS * F.unitsPerTick);
    delete (s as { farm?: unknown }).farm;
    delete (s as { fishing?: unknown }).fishing;
    delete (s as { home?: unknown }).home;
    expect(hashState(s)).toBe(f.expectedHash);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });
});
