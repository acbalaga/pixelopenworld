import { asSchema5 } from '../support/saves';
import { normalizeDoll } from '../../src/content/dolls/parts';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveSummary, findAvatar } from '../../src/shared/summary';
import { HINTS } from '../../src/content/hints';
import {
  AutoSaver,
  CURRENT_SCHEMA,
  JsonCodec,
  MemoryStorage,
  OLD_SNAPSHOT_MS,
  SaveManager,
  migrate,
  sha256Hex,
  type SavePlain,
} from '../../src/save';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { addItem } from '../../src/sim/items';
import { addXp } from '../../src/sim/skills';
import { createDemoState, deserializeState, hashState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import type { DollSpec } from '../../src/content/dolls/parts';

const LOOK: DollSpec = {
  body: 'a',
  skin: 'light',
  hair: 'short',
  hairColor: 'brown',
  top: 'tunic',
  topColor: 'blue',
  bottom: 'trousers',
  bottomColor: 'brown',
  mainHand: 'sword',
  offHand: 'none',
};

function game(): { s: SimState; me: number } {
  const s = createDemoState(5, 0);
  s.world = { solidAt: () => 0 };
  const f = feetAt(10, 10);
  const me = createAvatar(s, f.x, f.y);
  return { s, me };
}

function mk(): { m: SaveManager; storage: MemoryStorage; clock: { t: number } } {
  const storage = new MemoryStorage();
  const clock = { t: 1_700_000_000_000 };
  let n = 0;
  const m = new SaveManager({
    codec: new JsonCodec(),
    storage,
    now: () => clock.t,
    newId: () => `id${n++}`,
  });
  return { m, storage, clock };
}

/** A manager over the same storage, as after a page reload. */
function reload(storage: MemoryStorage, clock: { t: number }): SaveManager {
  return new SaveManager({ codec: new JsonCodec(), storage, now: () => clock.t, newId: () => 'x' });
}

const input = (s: SimState): { sim: SimState; look: DollSpec; playSeconds: number } => ({
  sim: s,
  look: LOOK,
  playSeconds: s.tick / 30,
});

describe('save and load', () => {
  it('a reload gives back the same state: hashState is equal, and the look comes along', async () => {
    const { s, me } = game();
    addItem(s.entities.comps.inventory[me]!, 'item.dish_bread', 3);
    addXp(s, me, 'skill.blades', 500);
    for (let i = 0; i < 60; i++) stepWorld(s, me, { commands: [] });
    const { m, storage, clock } = mk();
    await m.commit(input(s));

    const got = await reload(storage, clock).load();
    expect(got).not.toBeNull();
    expect(got!.report).toMatchObject({ slot: 'latest', fellBack: false, skipped: [] });
    expect(got!.plain.look).toEqual(LOOK);
    expect(got!.plain.summary).toEqual(deriveSummary(s, s.tick / 30));
    expect(hashState(deserializeState(got!.plain.sim))).toBe(hashState(s));
  });

  it('there is nothing to load before the first save', async () => {
    expect(await mk().m.load()).toBeNull();
  });

  it('seq counts up, saveId stays, and prevHash chains the encoded bytes', async () => {
    const { s } = game();
    const { m, storage, clock } = mk();
    await m.commit(input(s));
    const first = (await storage.readAll()).latest!;
    await m.commit(input(s));
    const slots = await storage.readAll();
    const second = await new JsonCodec().decode(slots.latest!.bytes);
    expect(second.seq).toBe(2);
    expect(second.prevHash).toBe(await sha256Hex(first.bytes));
    expect(second.saveId).toBe((await new JsonCodec().decode(first.bytes)).saveId);
    // After a reload the chain and the count carry on.
    const again = reload(storage, clock);
    await again.load();
    await again.commit(input(s));
    const third = await new JsonCodec().decode((await storage.readAll()).latest!.bytes);
    expect(third.seq).toBe(3);
    expect(third.prevHash).toBe(slots.latest!.checksum);
  });

  it('keeps latest and previous, and an old one at least 30 minutes behind', async () => {
    const { s } = game();
    const { m, storage, clock } = mk();
    await m.commit(input(s)); // seq 1 at t0
    clock.t += 60_000;
    await m.commit(input(s)); // seq 2
    clock.t += 60_000;
    await m.commit(input(s)); // seq 3
    let slots = await storage.readAll();
    expect([slots.latest!.seq, slots.previous!.seq]).toEqual([3, 2]);
    // Nothing is 30 minutes old yet, so the old slot is still empty or recent.
    expect(slots.old === null || slots.old.savedAt > clock.t - OLD_SNAPSHOT_MS).toBe(true);
    clock.t += OLD_SNAPSHOT_MS;
    await m.commit(input(s)); // seq 4, 30 minutes after seq 2 and 3
    slots = await storage.readAll();
    expect(slots.latest!.seq).toBe(4);
    expect(slots.old).not.toBeNull();
    expect(slots.latest!.savedAt - slots.old!.savedAt).toBeGreaterThanOrEqual(OLD_SNAPSHOT_MS);
  });
});

describe('damaged saves', () => {
  it('a corrupted latest snapshot falls back to the previous one, and says so', async () => {
    const { s, me } = game();
    const { m, storage, clock } = mk();
    await m.commit(input(s));
    const goodHash = hashState(s);
    addItem(s.entities.comps.inventory[me]!, 'item.dish_bread', 1);
    await m.commit(input(s));
    storage.corrupt('latest', 10);

    const loader = reload(storage, clock);
    const got = await loader.load();
    expect(got!.report.slot).toBe('previous');
    expect(got!.report.fellBack).toBe(true);
    expect(got!.report.skipped).toEqual([{ slot: 'latest', reason: 'checksum mismatch' }]);
    expect(hashState(deserializeState(got!.plain.sim))).toBe(goodHash);
    // The bad snapshot is kept in quarantine, not thrown away.
    const slots = await storage.readAll();
    expect(slots.quarantine?.seq).toBe(2);
  });

  it('a snapshot that passes its checksum but is not a save is skipped too', async () => {
    const { s } = game();
    const { m, storage, clock } = mk();
    await m.commit(input(s));
    await m.commit(input(s));
    const slots = await storage.readAll();
    const junk = new TextEncoder().encode('{"hello":1}');
    slots.latest = { ...slots.latest!, bytes: junk, checksum: await sha256Hex(junk) };
    await storage.replaceAll(slots);
    const got = await reload(storage, clock).load();
    expect(got!.report.slot).toBe('previous');
    expect(got!.report.skipped[0]!.slot).toBe('latest');
  });

  it('when every snapshot is bad there is no save, and the newest bad one is kept', async () => {
    const { s } = game();
    const { m, storage, clock } = mk();
    await m.commit(input(s));
    await m.commit(input(s));
    storage.corrupt('latest');
    storage.corrupt('previous');
    expect(await reload(storage, clock).load()).toBeNull();
    expect((await storage.readAll()).quarantine?.seq).toBe(2);
  });

  it('a commit after a fallback keeps the quarantined record', async () => {
    const { s } = game();
    const { m, storage, clock } = mk();
    await m.commit(input(s));
    await m.commit(input(s));
    storage.corrupt('latest');
    const loader = reload(storage, clock);
    await loader.load();
    await loader.commit(input(s));
    const slots = await storage.readAll();
    expect(slots.quarantine?.seq).toBe(2);
    expect(slots.latest!.seq).toBe(3);
  });

  it('a save killed partway never leaves an unreadable latest', async () => {
    const { s, me } = game();
    const { m, storage, clock } = mk();
    await m.commit(input(s));
    const before = hashState(s);
    addItem(s.entities.comps.inventory[me]!, 'item.dish_bread', 5);
    storage.failNext = true;
    await expect(m.commit(input(s))).rejects.toThrow('aborted');
    const got = await reload(storage, clock).load();
    expect(got!.report).toMatchObject({ slot: 'latest', fellBack: false, skipped: [] });
    expect(hashState(deserializeState(got!.plain.sim))).toBe(before);
    // And the next save goes through.
    await m.commit(input(s));
    expect((await storage.readAll()).latest!.seq).toBe(2);
  });
});

describe('migrations', () => {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-1.json'), 'utf8'),
  ) as { expectedHash: string; plain: SavePlain };

  it('the schema 1 fixture migrates to the current schema: same game, new fields filled in', async () => {
    expect(fixture.plain.schema).toBe(1);
    const bytes = new TextEncoder().encode(JSON.stringify(fixture.plain));
    const decoded = await new JsonCodec().decode(bytes);
    const now = migrate(decoded);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(now.saveId).toBe(fixture.plain.saveId);
    // The look is kept as it was, with the newer parts at their neutral entry.
    expect(now.look).toEqual(normalizeDoll(fixture.plain.look));
    const s = deserializeState(now.sim);
    const me = findAvatar(s)!;
    // The upgrade adds a handle, and marks every hint as seen: an old save is not a new player.
    expect(s.entities.comps.avatar[me]!.handle).toBe('Traveler');
    expect(s.entities.comps.journal[me]!.hint).toBeNull();
    expect(s.entities.comps.journal[me]!.hints).toEqual(
      expect.arrayContaining(HINTS.map((h) => h.id)),
    );
    // Everything else is untouched: remove the new fields and the old hash comes back.
    s.entities.comps.avatar[me] = { ...s.entities.comps.avatar[me]!, handle: undefined as never };
    delete (s.entities.comps.avatar[me] as { handle?: string }).handle;
    const j = s.entities.comps.journal[me] as { hints?: unknown; hint?: unknown };
    delete j.hints;
    delete j.hint;
    delete (s as { ledger?: unknown }).ledger;
    expect(hashState(asSchema5(s))).toBe(fixture.expectedHash);
  });

  it('the schema 2 fixture gains a ledger seeded from what the avatar holds', async () => {
    const f2 = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-2.json'), 'utf8'),
    ) as { expectedHash: string; plain: SavePlain };
    expect(f2.plain.schema).toBe(2);
    const bytes = new TextEncoder().encode(JSON.stringify(f2.plain));
    const now = migrate(await new JsonCodec().decode(bytes));
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    expect(s.ledger).toEqual(now.ledger);
    const me = findAvatar(s)!;
    // Coin held equals earned minus spent: the whole 137 is seeded as earned.
    expect(s.entities.comps.avatar[me]!.coin).toBe(137);
    expect(now.ledger.coinEarned).toEqual({ seed: 137 });
    expect(now.ledger.coinSpent).toEqual({});
    // Every item held, worn or in the bag, is seeded as made.
    expect(now.ledger.itemsMade.seed?.['item.raw_meat']).toBe(3);
    expect(now.ledger.itemsMade.seed?.['item.sunwort']).toBe(2);
    expect(now.ledger.xpEarned['skill.blades']).toBe(25);
    // Everything else is untouched: remove the ledger and the old hash comes back.
    delete (s as { ledger?: unknown }).ledger;
    expect(hashState(asSchema5(s))).toBe(f2.expectedHash);
    expect(now.playSeconds).toBe(f2.plain.playSeconds);
    expect(now.look).toEqual(normalizeDoll(f2.plain.look));
  });

  it('the fixture also loads through the manager, from storage', async () => {
    const storage = new MemoryStorage();
    const bytes = new TextEncoder().encode(JSON.stringify(fixture.plain));
    await storage.replaceAll({
      latest: { seq: 7, savedAt: 1, checksum: await sha256Hex(bytes), bytes },
      previous: null,
      old: null,
      emergency: null,
      replaced: null,
      quarantine: null,
    });
    const got = await new SaveManager({
      codec: new JsonCodec(),
      storage,
      now: () => 2,
      newId: () => 'x',
    }).load();
    expect(got!.plain.summary.coin).toBe(42);
    expect(got!.plain.schema).toBe(CURRENT_SCHEMA);
  });

  it('runs steps in order, one schema at a time (the pattern for future migrations)', () => {
    const table = {
      1: (o: SavePlain): SavePlain => ({ ...o, schema: 2, playSeconds: o.playSeconds + 1 }),
      2: (o: SavePlain): SavePlain => ({ ...o, schema: 3, playSeconds: o.playSeconds * 10 }),
    };
    const out = migrate(fixture.plain, table, 3);
    expect(out.schema).toBe(3);
    expect(out.playSeconds).toBe((fixture.plain.playSeconds + 1) * 10);
  });

  it('refuses a save from a newer version, a missing step, and a step that skips', () => {
    expect(() => migrate({ ...fixture.plain, schema: CURRENT_SCHEMA + 1 })).toThrow(/newer/);
    expect(() => migrate(fixture.plain, {}, 2)).toThrow(/no migration from schema 1/);
    expect(() => migrate(fixture.plain, { 1: (o) => ({ ...o, schema: 3 }) }, 3)).toThrow(
      /produced schema 3/,
    );
  });
});

describe('AutoSaver', () => {
  it('never overlaps saves, and runs once more for requests made meanwhile', async () => {
    let active = 0;
    let maxActive = 0;
    let runs = 0;
    const saver = new AutoSaver(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      runs++;
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    saver.request('timer');
    saver.request('transition');
    saver.request('hidden');
    await saver.idle();
    expect(maxActive).toBe(1);
    expect(runs).toBe(2);
    expect(saver.lastReason).toBe('timer');
  });

  it('reports a failure and keeps working', async () => {
    const errors: unknown[] = [];
    let fail = true;
    const saver = new AutoSaver(
      async () => {
        if (fail) throw new Error('disk full');
      },
      (e) => errors.push(e),
    );
    saver.request('timer');
    await saver.idle();
    expect(errors).toHaveLength(1);
    fail = false;
    saver.request('timer');
    await saver.idle();
    expect(saver.lastReason).toBe('timer');
  });
});

describe('retiring a character', () => {
  it('clears the working slots, keeps the last snapshot in replaced, and a new character starts clean', async () => {
    const { s } = game();
    const { m, storage, clock } = mk();
    await m.commit(input(s));
    await m.commit(input(s));
    const kept = (await storage.readAll()).latest;

    expect(await m.retire()).toBe(true);
    const after = await storage.readAll();
    expect(after.latest).toBeNull();
    expect(after.previous).toBeNull();
    expect(after.old).toBeNull();
    expect(after.replaced?.checksum).toBe(kept?.checksum);
    // The title would find no save.
    expect(await reload(storage, clock).load()).toBeNull();

    // The next character commits as a fresh chain and loads back.
    const { s: s2 } = game();
    clock.t += 1000;
    await m.commit(input(s2));
    const got = await reload(storage, clock).load();
    expect(got?.plain.saveId).not.toBe('id0');
    // The retired character is still there, untouched.
    expect((await storage.readAll()).replaced?.checksum).toBe(kept?.checksum);
  });

  it('with nothing saved it keeps an earlier replaced snapshot and reports nothing kept', async () => {
    const { m, storage } = mk();
    expect(await m.retire()).toBe(false);
    expect((await storage.readAll()).replaced).toBeNull();
  });
});
