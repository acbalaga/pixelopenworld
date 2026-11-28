import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INN_ROOM } from '../../src/content/world/interiors';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { lowestBuy } from '../../src/sim/economy';
import { earnCoin, spendCoin } from '../../src/sim/ledger';
import { doorTiles } from '../../src/sim/home';
import { newHome } from '../../src/sim/homeState';
import { addItem, give } from '../../src/sim/items';
import { createDemoState, deserializeState, hashState } from '../../src/sim/state';
import { plainFor, tamper } from '../support/saves';

/**
 * Rooms and the save (POW-M6-07): a layout is checked against the rules of its room and its pieces
 * against the ledger, and schema 37 saves gain the inn room as it begins. The rules and commands are
 * in `tests/sim/home.test.ts`.
 */

describe('Room integrity (M6-07)', () => {
  function honest(): SavePlain {
    const s = createDemoState(3, 0);
    s.world = { solidAt: (): number => 0 };
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y);
    // A crafted stool, placed; a bought lantern held in the bag.
    // Both bought from Pell, at the lowest price a haggle can reach.
    earnCoin(s, me, 1000, 'seed');
    give(s, me, 'item.furn_stool', 1, 'shop');
    give(s, me, 'item.furn_lantern', 1, 'shop');
    spendCoin(s, me, lowestBuy('item.furn_stool') + lowestBuy('item.furn_lantern'), 'purchase');
    const bag = s.entities.comps.inventory[me]!;
    const slot = bag.slots.findIndex((x) => x?.item === 'item.furn_stool');
    bag.slots[slot] = null;
    s.home.rooms['interior.inn_room']!.push({ piece: 'stool', x: 0, y: 3, rot: 0, e: 0 });
    s.tick = 3000;
    return plainFor(s, { playSeconds: 100, createdAt: 1_700_000_000_000 + 3 * 86_400_000 });
  }
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);

  it('an honest save with a furnished room passes every layer', () => {
    expect(validateSave(honest()).reasons).toEqual([]);
  });

  it("storing the room's own bed and chest in the bag is honest", () => {
    const p = tamper(honest(), (s, me) => {
      const list = s.home.rooms['interior.inn_room']!;
      s.home.rooms['interior.inn_room'] = list.filter((o) => o.piece !== 'straw_bed');
      addItem(s.entities.comps.inventory[me]!, 'item.furn_straw_bed', 1);
    });
    expect(codes(p)).toEqual([]);
  });

  it('a piece edited into a room, or the bag, is caught', () => {
    const inRoom = tamper(honest(), (s) => {
      s.home.rooms['interior.inn_room']!.push({ piece: 'wardrobe', x: 1, y: 1, rot: 0, e: 0 });
    });
    expect(codes(inRoom)).toContain('ITEMS_EXCEED_MADE');
    const inBag = tamper(honest(), (s, me) => {
      addItem(s.entities.comps.inventory[me]!, 'item.furn_lantern', 30);
    });
    expect(codes(inBag)).toContain('ITEMS_EXCEED_MADE');
  });

  it('a piece in the doorway, off the floor, on another piece, or unknown breaks the room rules', () => {
    const [door] = doorTiles(INN_ROOM);
    const bad = (push: { piece: string; x: number; y: number; rot: number }): string[] =>
      codes(
        tamper(honest(), (s, me) => {
          give(s, me, `item.furn_${push.piece}`, 1, 'shop');
          s.home.rooms['interior.inn_room']!.push({ ...push, e: 0 });
        }),
      );
    expect(bad({ piece: 'candle', x: door!.x, y: door!.y, rot: 0 })).toContain('HOME_LAYOUT');
    expect(bad({ piece: 'candle', x: 9, y: 0, rot: 0 })).toContain('HOME_LAYOUT');
    // The stool stands at 0,3 in the honest save.
    expect(bad({ piece: 'candle', x: 0, y: 3, rot: 0 })).toContain('HOME_LAYOUT');
    const unknown = tamper(honest(), (s) => {
      s.home.rooms['interior.inn_room']!.push({ piece: 'throne', x: 1, y: 1, rot: 0, e: 0 });
    });
    expect(codes(unknown)).toContain('HOME_LAYOUT');
    const nowhere = tamper(honest(), (s) => {
      s.home.rooms['interior.moon_room'] = [];
    });
    expect(codes(nowhere)).toContain('HOME_LAYOUT');
  });
});

describe('the save (M6-07)', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-37.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };
  const decode = (): Promise<SavePlain> =>
    new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

  it('schema 37 to 38 gives an old save the inn room as it begins and nothing else changes', async () => {
    expect(f.plain.schema).toBe(37);
    expect(JSON.parse(f.plain.sim)).not.toHaveProperty('home');
    const at38 = migrate(await decode(), MIGRATIONS, 38);
    expect(at38.schema).toBe(38);
    const s = deserializeState(at38.sim);
    expect(s.home).toEqual(newHome());
    delete (s as { home?: unknown }).home;
    expect(hashState(s)).toBe(f.expectedHash);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });
});
