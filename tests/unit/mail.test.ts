import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAIL } from '../../src/content/balance/mail';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { createAvatar } from '../../src/sim/avatar';
import { countItem } from '../../src/sim/items';
import { px } from '../../src/sim/kernel/fixed';
import {
  claimLetter,
  deliver,
  giftsLeft,
  newMailbox,
  readLetter,
  unreadCount,
} from '../../src/sim/mail';
import {
  createDemoState,
  deserializeState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { honestPlain, plainFor, tamper } from '../support/saves';

/**
 * The mailbox (POW-M5-12): letters, one claim each, the `mailGift` ledger entry and its bound, and
 * the schema 31 migration.
 */
const gift = (day = 100) => ({
  slot: 3,
  tpl: 'gift.coin',
  day,
  subject: 0,
  item: '',
  qty: 0,
  coin: 20,
});

function world(): { s: SimState; me: number } {
  const s = createDemoState(9, 0);
  s.world = { solidAt: (): number => 0 };
  const me = createAvatar(s, px(100), px(100));
  return { s, me };
}

describe('schema 30 to 31', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-30.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };
  const decode = (): Promise<SavePlain> =>
    new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

  it('gives an old save an empty mailbox and nothing else changes', async () => {
    expect(f.plain.schema).toBe(30);
    expect(JSON.parse(f.plain.sim)).not.toHaveProperty('mail');
    const before = deserializeState(f.plain.sim);
    const at31 = migrate(await decode(), MIGRATIONS, 31);
    expect(at31.schema).toBe(31);
    const s = deserializeState(at31.sim);
    expect(s.mail).toEqual(newMailbox());
    expect(s.travelers).toEqual(before.travelers);
    expect(s.seed).toBe(before.seed);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });
});

describe('claiming a gift', () => {
  it('pays once: the second claim does nothing, and the ledger names the source', () => {
    const { s, me } = world();
    deliver(s, { ...gift(), item: 'item.copper_ore', qty: 2 });
    const id = s.mail.letters[0]!.id;
    expect(claimLetter(s, me, id)).toBe(true);
    expect(s.entities.comps.avatar[me]!.coin).toBe(20);
    expect(countItem(s.entities.comps.inventory[me]!, 'item.copper_ore')).toBe(2);
    expect(s.ledger.coinEarned.mailGift).toBe(20);
    expect(s.ledger.itemsMade.mailGift?.['item.copper_ore']).toBe(2);
    expect(claimLetter(s, me, id)).toBe(false);
    expect(s.entities.comps.avatar[me]!.coin).toBe(20);
    expect(countItem(s.entities.comps.inventory[me]!, 'item.copper_ore')).toBe(2);
    expect(s.ledger.coinEarned.mailGift).toBe(20);
  });

  it('cannot be claimed twice by reloading between the claim and the next save', () => {
    const { s, me } = world();
    deliver(s, gift());
    const id = s.mail.letters[0]!.id;
    const saved = serializeState(s);
    claimLetter(s, me, id);
    expect(s.entities.comps.avatar[me]!.coin).toBe(20);
    // The game closes before it saves: the next load is the earlier save, with the letter unclaimed
    // and the coin not yet paid. Claiming again pays the one gift, not two.
    const again = deserializeState(saved);
    const me2 = findAvatar(again)!;
    expect(again.mail.letters[0]!.claimed).toBe(false);
    expect(again.entities.comps.avatar[me2]!.coin).toBe(0);
    claimLetter(again, me2, id);
    claimLetter(again, me2, id);
    expect(again.entities.comps.avatar[me2]!.coin).toBe(20);
    expect(again.ledger.coinEarned.mailGift).toBe(20);
  });

  it('keeps the claim through a save and load', () => {
    const { s, me } = world();
    deliver(s, gift());
    claimLetter(s, me, s.mail.letters[0]!.id);
    const back = deserializeState(serializeState(s));
    expect(back.mail.letters[0]!.claimed).toBe(true);
    expect(claimLetter(back, findAvatar(back)!, back.mail.letters[0]!.id)).toBe(false);
  });

  it('cannot be doubled by importing an older save: the older save has the older purse too', () => {
    const { s, me } = world();
    deliver(s, gift());
    const older = serializeState(s);
    claimLetter(s, me, s.mail.letters[0]!.id);
    const newer = serializeState(s);
    expect(newer).not.toBe(older);
    // Import the older save: unclaimed letter, coin 0, ledger 0. Claiming once gives the same state as
    // the newer save, never more.
    const imp = deserializeState(older);
    claimLetter(imp, findAvatar(imp)!, imp.mail.letters[0]!.id);
    claimLetter(imp, findAvatar(imp)!, imp.mail.letters[0]!.id);
    expect(imp.entities.comps.avatar[findAvatar(imp)!]!.coin).toBe(
      s.entities.comps.avatar[me]!.coin,
    );
    expect(imp.ledger.coinEarned.mailGift).toBe(s.ledger.coinEarned.mailGift);
  });

  it('passes the integrity check, and a made-up gift does not', () => {
    const { s, me } = world();
    deliver(s, { ...gift(), item: 'item.copper_ore', qty: 2 });
    claimLetter(s, me, s.mail.letters[0]!.id);
    const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
    expect(codes(plainFor(s))).not.toContain('MAIL_IMPLAUSIBLE');
    // A purse with mail coin far past what the days played allow is flagged.
    const rich = tamper(honestPlain(), (st, who) => {
      st.entities.comps.avatar[who]!.coin += 50_000;
      st.ledger.coinEarned.mailGift = 50_000;
    });
    expect(codes(rich)).toContain('MAIL_IMPLAUSIBLE');
    // Items with no ledger entry for them are flagged by the existing reconcile.
    const stolen = tamper(honestPlain(), (st, who) => {
      st.entities.comps.inventory[who]!.slots[7] = { item: 'item.copper_ingot', qty: 40 };
    });
    expect(codes(stolen)).toContain('ITEMS_EXCEED_MADE');
  });
});

describe('the mailbox', () => {
  it('holds at most the cap, pushes out a read and claimed letter first, and delivers no gift past the daily cap', () => {
    const { s } = world();
    for (let i = 0; i < MAIL.cap; i++)
      expect(
        deliver(s, {
          slot: 1,
          tpl: 'letter.hello',
          day: 100 + i,
          subject: 0,
          item: '',
          qty: 0,
          coin: 0,
        }),
      ).toBe(true);
    // Full of unread letters: the next is not delivered, and the sender keeps what they had.
    expect(
      deliver(s, { slot: 2, tpl: 'letter.hello', day: 200, subject: 0, item: '', qty: 0, coin: 0 }),
    ).toBe(false);
    readLetter(s, s.mail.letters[0]!.id);
    expect(
      deliver(s, { slot: 2, tpl: 'letter.hello', day: 200, subject: 0, item: '', qty: 0, coin: 0 }),
    ).toBe(true);
    expect(s.mail.letters).toHaveLength(MAIL.cap);
    expect(unreadCount(s.mail)).toBe(MAIL.cap);
    const t = world().s;
    for (let i = 0; i < MAIL.giftCapPerDay; i++) expect(deliver(t, gift(300))).toBe(true);
    expect(giftsLeft(t.mail, 300)).toBe(0);
    expect(deliver(t, gift(300))).toBe(false);
    // A new day starts the count again.
    expect(deliver(t, gift(301))).toBe(true);
  });
});
