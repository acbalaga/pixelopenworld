import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import type { SavePlain } from '../../src/save/types';
import { buyPrice, lowestBuy } from '../../src/sim/economy';
import { createStream } from '../../src/sim/kernel/rng';
import { deserializeState } from '../../src/sim/state';
import { SHOPS } from '../../src/content/dialogue';
import { honestPlain, tamper } from '../support/saves';
import { LAST_SLICE_SCHEMA } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-12.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 12 to 13 migration', () => {
  it('seeds the trade stream, adds the haggle component and itemsSold, and stocks each shopkeeper', async () => {
    expect(fixture.plain.schema).toBe(12);
    const before = deserializeState(fixture.plain.sim);
    const k = before.entities.comps.npc.findIndex((n) => n?.id === 'npc.shopkeeper');
    expect(before.entities.comps.npc[k]!.purse).toBe(70);
    expect((before.rng as unknown as Record<string, unknown>).trade).toBeUndefined();

    const now = migrate(
      await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(fixture.plain))),
      MIGRATIONS,
      LAST_SLICE_SCHEMA,
    );
    expect(now.schema).toBe(LAST_SLICE_SCHEMA);
    const s = deserializeState(now.sim);
    expect(s.rng.trade).toEqual(createStream(s.seed, 'trade'));
    const me = s.entities.comps.avatar.findIndex((a) => a);
    expect(s.entities.comps.haggle[me]).toBeNull();
    const n = s.entities.comps.npc[k]!;
    expect(n.purse).toBe(70);
    expect(n.locked).toEqual([]);
    expect(n.buyback).toEqual([]);
    for (const st of SHOPS['shop.brin']!.stock) expect(n.stock[st.item]).toBe(st.max);
    expect(s.ledger.itemsSold).toEqual({});
    expect(now.ledger.itemsSold).toEqual({});
    // What the save held is still there, and it validates.
    expect(s.entities.comps.skills[me]!.points['skill.blades']).toBe(2);
    expect(validateSave(now).reasons.filter((r) => r.code !== 'XP_IMPLAUSIBLE')).toEqual([]);
  });
});

describe('trade integrity', () => {
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
  const plain = honestPlain();
  const bread = 'item.dish_bread';

  /** Re-prices the honest save's one bread purchase to `paid` coin, keeping the books balanced. */
  const paying = (paid: number): SavePlain =>
    tamper(plain, (s, me) => {
      const was = s.ledger.coinSpent.purchase ?? 0;
      s.ledger.coinSpent.purchase = paid;
      s.entities.comps.avatar[me]!.coin += was - paid;
    });

  it('accepts a purchase at the opening price and at the lowest haggled price', () => {
    expect(codes(plain)).not.toContain('PURCHASE_MISMATCH');
    expect(codes(paying(lowestBuy(bread)))).not.toContain('PURCHASE_MISMATCH');
  });
  it('flags a purchase above the opening price or below the lowest reachable', () => {
    expect(codes(paying(buyPrice(bread) + 1))).toContain('PURCHASE_MISMATCH');
    expect(codes(paying(Math.max(0, lowestBuy(bread) - 1)))).toContain('PURCHASE_MISMATCH');
  });
  it('flags buyback of more than was ever sold, and accepts what was', () => {
    const bought = (n: number, sold: number): SavePlain =>
      tamper(plain, (s, me) => {
        s.ledger.itemsMade.buyback = { 'item.moss_tuft': n };
        s.ledger.itemsSold = { 'item.moss_tuft': sold };
        s.ledger.coinSpent.buyback = 1;
        s.entities.comps.avatar[me]!.coin -= 1;
      });
    expect(codes(bought(1, 1))).not.toContain('BUYBACK_EXCEEDS_SOLD');
    expect(codes(bought(2, 1))).toContain('BUYBACK_EXCEEDS_SOLD');
  });
  it('flags sale coin past what the purses could pay, under its own code', () => {
    const big = tamper(plain, (s, me) => {
      s.ledger.coinEarned.sale = 1_000_000;
      s.entities.comps.avatar[me]!.coin += 1_000_000;
    });
    expect(codes(big)).toContain('SALE_RATE');
  });
  it('flags a sink or source it does not know', () => {
    const odd = tamper(plain, (s) => {
      (s.ledger.coinSpent as Record<string, number>).bribe = 1;
    });
    expect(codes(odd).length).toBeGreaterThan(0);
  });
});
