import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeFragments, writeVersion } from '../../tools/gen-seal-material';
import { JsonCodec } from '../../src/save/codec';
import { ImportError, exportBytes, exportFileName, planImport } from '../../src/save/exportImport';
import { validateSave } from '../../src/save/integrity';
import { SaveManager } from '../../src/save/manager';
import { migrate } from '../../src/save/migrations';
import { HEADER_BYTES, MAX_FILE_BYTES, sealSave } from '../../src/save/powsave';
import { PBKDF2_ITERATIONS, combineFragments, sealKey } from '../../src/save/seal/derive';
import { loadCommitted } from '../../src/save/seal/registry';
import type { SealSource } from '../../src/save/seal/source';
import { MemoryStorage } from '../../src/save/storage';
import type { SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { deserializeState, hashState } from '../../src/sim/state';
import { LOOK, honestPlain, honestState, plainFor, tamper } from '../support/saves';

/** The committed version 1, as the game's own source. */
const committed = async (): Promise<SealSource> => {
  const v1 = (await loadCommitted(1))!;
  return { current: 1, fragments: async (v) => (v === 1 ? v1 : null) };
};

const flip = (b: Uint8Array, at: number): Uint8Array => {
  const out = b.slice();
  out[at] = (out[at] as number) ^ 0x01;
  return out;
};

const failure = async (p: Promise<unknown>): Promise<ImportError> => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ImportError);
    return e as ImportError;
  }
  throw new Error('expected the import to be refused');
};

describe('the .powsave file', () => {
  it('round trips to the identical save, state hash included', async () => {
    const src = await committed();
    const plain = honestPlain();
    const bytes = await exportBytes(plain, src);
    const plan = await planImport(bytes, src);
    expect(plan.plain).toEqual(plain);
    const before = hashState(deserializeState(plain.sim));
    expect(hashState(deserializeState(plan.plain.sim))).toBe(before);
    expect(plan.handle).toBe('Honest_1');
    expect(plan.playSeconds).toBe(plain.playSeconds);
    expect(plan.trust.state).toBe('intact');
  });

  it('has the documented layout: magic, format, seal version, salt, IV, ciphertext', async () => {
    const bytes = await exportBytes(honestPlain(), await committed());
    expect(Buffer.from(bytes.slice(0, 4)).toString('latin1')).toBe('POWS');
    expect(bytes[4]).toBe(1);
    expect((bytes[5]! << 8) | bytes[6]!).toBe(1);
    expect(HEADER_BYTES).toBe(4 + 1 + 2 + 16 + 12);
    expect(bytes.length).toBeGreaterThan(HEADER_BYTES + 16);
  });

  it('uses a fresh salt and IV for every export', async () => {
    const src = await committed();
    const plain = honestPlain();
    const a = await exportBytes(plain, src);
    const b = await exportBytes(plain, src);
    expect(a.slice(7, 23)).not.toEqual(b.slice(7, 23));
    expect(a.slice(23, 35)).not.toEqual(b.slice(23, 35));
  });

  it('contains no readable game strings, handle included', async () => {
    const bytes = Buffer.from(await exportBytes(honestPlain(), await committed()));
    for (const w of [
      'item.',
      'inventory',
      'skill.',
      'creature.',
      'Honest_1',
      'coinEarned',
      'entities',
      'trust',
    ])
      expect(bytes.includes(Buffer.from(w)), w).toBe(false);
  });

  it('a flipped byte in the header is refused, each with its own reason', async () => {
    const src = await committed();
    const bytes = await exportBytes(honestPlain(), src);
    const expected = (i: number): string =>
      i < 4 ? 'not_a_save' : i === 4 ? 'unknown_format' : i < 7 ? 'unknown_seal' : 'damaged';
    for (let i = 0; i < HEADER_BYTES; i++) {
      const err = await failure(planImport(flip(bytes, i), src));
      expect(err.code, `header byte ${i}`).toBe(expected(i));
    }
  }, 60_000);

  it('a flipped byte anywhere in the ciphertext is refused', async () => {
    const src = await committed();
    const bytes = await exportBytes(honestPlain(), src);
    const spots = [
      HEADER_BYTES,
      HEADER_BYTES + 1,
      100,
      Math.floor(bytes.length / 2),
      bytes.length - 17,
      bytes.length - 16,
      bytes.length - 1,
    ];
    for (const at of spots) {
      const err = await failure(planImport(flip(bytes, at), src));
      expect(err.code, `byte ${at}`).toBe('damaged');
    }
  }, 60_000);

  it('truncated, extended and foreign files are refused before any key work', async () => {
    const src = await committed();
    const bytes = await exportBytes(honestPlain(), src);
    for (const n of [0, 1, 10, HEADER_BYTES, HEADER_BYTES + 15])
      expect((await failure(planImport(bytes.slice(0, n), src))).code, `cut ${n}`).toBe(
        'too_short',
      );
    expect((await failure(planImport(bytes.slice(0, bytes.length - 1), src))).code).toBe('damaged');
    expect((await failure(planImport(Uint8Array.from([...bytes, 0]), src))).code).toBe('damaged');
    expect(
      (await failure(planImport(new TextEncoder().encode('{"hello":"world"}'.repeat(10)), src)))
        .code,
    ).toBe('not_a_save');
  });

  it('refuses a file over the 4 MB cap without reading it', async () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set([0x50, 0x4f, 0x57, 0x53, 1, 0, 1]);
    expect((await failure(planImport(big, await committed()))).code).toBe('too_large');
    const at = new Uint8Array(MAX_FILE_BYTES);
    at.set([0x50, 0x4f, 0x57, 0x53, 1, 0, 1]);
    expect((await failure(planImport(at, await committed()))).code).toBe('damaged');
  });
});

describe('seal versions', () => {
  it('a file sealed with version 1 still imports after version 2 becomes current', async () => {
    const v1 = (await loadCommitted(1))!;
    const v2 = makeFragments();
    const before: SealSource = { current: 1, fragments: async (v) => (v === 1 ? v1 : null) };
    const after: SealSource = {
      current: 2,
      fragments: async (v) => (v === 1 ? v1 : v === 2 ? v2 : null),
    };
    const plain = honestPlain();
    const oldFile = await sealSave(plain, before);
    const newFile = await sealSave(plain, after);
    expect((oldFile[5]! << 8) | oldFile[6]!).toBe(1);
    expect((newFile[5]! << 8) | newFile[6]!).toBe(2);
    expect((await planImport(oldFile, after)).plain).toEqual(plain);
    expect((await planImport(newFile, after)).plain).toEqual(plain);
    // An older build that does not know version 2 says so plainly.
    expect((await failure(planImport(newFile, before))).code).toBe('unknown_seal');
  });

  it('a file under different material for the same version does not open', async () => {
    const other: SealSource = { current: 1, fragments: async () => makeFragments() };
    const file = await sealSave(honestPlain(), other);
    expect((await failure(planImport(file, await committed()))).code).toBe('damaged');
  });

  it('the generator writes a new version beside the old ones and refuses to overwrite one', () => {
    const root = mkdtempSync(join(tmpdir(), 'pow-seal-'));
    try {
      const fixed = (n: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => i);
      writeVersion(root, 1, makeFragments(fixed));
      writeVersion(root, 2);
      expect(readdirSync(root).sort()).toEqual(['registry.ts', 'v1', 'v2']);
      expect(readdirSync(join(root, 'v2')).sort()).toEqual([
        'f0.ts',
        'f1.ts',
        'f2.ts',
        'f3.ts',
        'index.ts',
      ]);
      const registry = readFileSync(join(root, 'registry.ts'), 'utf8');
      expect(registry).toContain('SEAL_VERSIONS: readonly number[] = [1, 2]');
      expect(registry).toContain('CURRENT_SEAL_VERSION = 2');
      expect(() => writeVersion(root, 1)).toThrow('already exists');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('key derivation', () => {
  it('uses at least 150,000 PBKDF2 iterations and yields a key that cannot be exported', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(150_000);
    const frags = makeFragments();
    const key = await sealKey(frags, 1, new Uint8Array(16));
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('combines the fragments the same way every time, and a different version or fragment changes it', async () => {
    const f = makeFragments();
    const a = await combineFragments(f, 1);
    expect(a.length).toBe(32);
    expect(await combineFragments(f, 1)).toEqual(a);
    expect(await combineFragments(f, 2)).not.toEqual(a);
    const g = f.map((x) => x.slice());
    g[2]![0] = (g[2]![0] as number) ^ 1;
    expect(await combineFragments(g, 1)).not.toEqual(a);
  });

  it('does not change the fragments it is given', async () => {
    const f = makeFragments();
    const copy = f.map((x) => x.slice());
    await sealKey(f, 1, new Uint8Array(16));
    expect(f).toEqual(copy);
  });
});

describe('importing', () => {
  afterEach(() => undefined);

  it('an older save inside a file is migrated to the current schema', async () => {
    const src = await committed();
    const old = JSON.parse(
      readFileSync(join(process.cwd(), 'tests', 'fixtures', 'saves', 'schema-2.json'), 'utf8'),
    ).plain as SavePlain;
    const plan = await planImport(await sealSave(old, src), src);
    expect(plan.plain.schema).toBe(migrate(old).schema);
    expect(plan.handle).toBe('Fixture_2');
    expect(validateSave(plan.plain).ok).toBe(true);
  });

  it('a save from a newer game is refused', async () => {
    const src = await committed();
    const plain = { ...honestPlain(), schema: 99 };
    expect((await failure(planImport(await sealSave(plain, src), src))).code).toBe('too_new');
  });

  it('a file that opens but is not a game state is refused', async () => {
    const src = await committed();
    const bad = { ...honestPlain(), sim: '{"entities":{}}' };
    expect((await failure(planImport(await sealSave(bad, src), src))).code).toBe('unplayable');
  });

  it('a Flagged save stays Flagged through export and import, with its reasons', async () => {
    const src = await committed();
    const plain = honestPlain();
    plain.trust = { state: 'flagged', reasons: ['COIN_RECONCILE'], flaggedAt: 1234 };
    const plan = await planImport(await sealSave(plain, src), src);
    expect(plan.trust).toEqual({ state: 'flagged', reasons: ['COIN_RECONCILE'], flaggedAt: 1234 });
  });

  it('an edit that is decrypted and re-sealed with the right key is still flagged', async () => {
    // T3 in tech/02: someone with the tooling edits coin and seals it again.
    const src = await committed();
    const edited = tamper(honestPlain(), (s, me) => {
      s.entities.comps.avatar[me]!.coin += 1_000_000;
    });
    const plan = await planImport(await sealSave(edited, src), src);
    expect(plan.trust.state).toBe('flagged');
    expect(plan.trust.reasons).toContain('COIN_RECONCILE');
    // It is still importable: Flagged has no effect on play.
    expect(plan.plain.sim).toBe(edited.sim);
  });

  it('names the file after the handle and the date', () => {
    expect(exportFileName('Fred_77', new Date(2026, 0, 5))).toBe('pow-Fred_77-2026-01-05.powsave');
    expect(exportFileName('we ird/name!', new Date(2026, 10, 17))).toBe(
      'pow-weirdname-2026-11-17.powsave',
    );
    expect(exportFileName('', new Date(2026, 0, 1))).toBe('pow-save-2026-01-01.powsave');
  });
});

describe('the save manager and imports', () => {
  const make = () => {
    const storage = new MemoryStorage();
    const clock = { t: 1_700_000_000_000 };
    const mgr = new SaveManager({
      codec: new JsonCodec(),
      storage,
      now: () => clock.t,
      newId: () => 'ee'.repeat(16),
    });
    return { storage, clock, mgr };
  };

  it('exports the latest snapshot, and an import on a fresh device gives the identical state', async () => {
    const src = await committed();
    const a = make();
    const s = honestState();
    await a.mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    const file = await exportBytes((await a.mgr.latestPlain())!, src);

    const b = make();
    const plan = await planImport(file, src);
    await b.mgr.importSave(plan.plain);
    const got = await b.mgr.load();
    expect(hashState(deserializeState(got!.plain.sim))).toBe(hashState(s));
    expect(got!.plain.trust.state).toBe('intact');
    expect(got!.plain.look).toEqual(LOOK);
    expect(got!.plain.saveId).toBe(plan.plain.saveId);
  });

  it('replacing a save keeps the old one as a snapshot and in the replaced slot', async () => {
    const src = await committed();
    const a = make();
    const mine = honestState();
    const myId = findAvatar(mine)!;
    mine.entities.comps.avatar[myId]!.handle = 'Mine_1';
    await a.mgr.commit({ sim: mine, look: LOOK, playSeconds: mine.tick / 30 });
    const mineHash = hashState(mine);

    const theirs = honestState();
    theirs.entities.comps.avatar[findAvatar(theirs)!]!.handle = 'Theirs_1';
    const plan = await planImport(await sealSave(plainFor(theirs, { seq: 9 }), src), src);
    await a.mgr.importSave(plan.plain);

    const slots = await a.storage.readAll();
    const codec = new JsonCodec();
    const now = await codec.decode(slots.latest!.bytes);
    const prev = await codec.decode(slots.previous!.bytes);
    const kept = await codec.decode(slots.replaced!.bytes);
    expect(
      deserializeState(now.sim).entities.comps.avatar[findAvatar(deserializeState(now.sim))!]!
        .handle,
    ).toBe('Theirs_1');
    expect(hashState(deserializeState(prev.sim))).toBe(mineHash);
    expect(hashState(deserializeState(kept.sim))).toBe(mineHash);

    // Playing on rotates the snapshots, but the replaced save stays put.
    for (let i = 0; i < 5; i++) {
      a.clock.t += 5000;
      theirs.tick += 30;
      await a.mgr.commit({ sim: theirs, look: LOOK, playSeconds: theirs.tick / 30 });
    }
    const later = await a.storage.readAll();
    expect(later.replaced!.seq).toBe(slots.replaced!.seq);
    expect(hashState(deserializeState((await codec.decode(later.replaced!.bytes)).sim))).toBe(
      mineHash,
    );
  });

  it('the chain continues across an import, so the next load is not flagged for it', async () => {
    const src = await committed();
    const a = make();
    const s = honestState();
    await a.mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    const other = honestState();
    const plan = await planImport(await sealSave(plainFor(other), src), src);
    await a.mgr.importSave(plan.plain);
    a.clock.t += 5000;
    expect((await a.mgr.load())!.report.chain).toBe('ok');
  });

  it('a refused file leaves storage exactly as it was', async () => {
    const src = await committed();
    const a = make();
    const s = honestState();
    await a.mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    const before = JSON.stringify(
      Object.entries(await a.storage.readAll()).map(([k, v]) => [k, v?.checksum]),
    );
    const bytes = await exportBytes(honestPlain(), src);
    await failure(planImport(flip(bytes, 200), src));
    await failure(planImport(new Uint8Array(30), src));
    const after = JSON.stringify(
      Object.entries(await a.storage.readAll()).map(([k, v]) => [k, v?.checksum]),
    );
    expect(after).toBe(before);
  }, 30_000);

  it('latestPlain is null with no save, and nothing is written by reading it', async () => {
    const a = make();
    expect(await a.mgr.latestPlain()).toBeNull();
    expect((await a.storage.readAll()).latest).toBeNull();
  });
});
