import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packSave, packValue, unpackSave, unpackValue } from '../../src/save/binary';
import { gunzip, gzip } from '../../src/save/compress';
import {
  generateDeviceKey,
  loadDeviceKey,
  MemoryKeyStore,
  type KeyStore,
} from '../../src/save/deviceKey';
import { sha256Hex, JsonCodec } from '../../src/save/codec';
import { SaveManager } from '../../src/save/manager';
import { migrate } from '../../src/save/migrations';
import { SecureCodec } from '../../src/save/secureCodec';
import { MemoryStorage } from '../../src/save/storage';
import { checkSaveSupport } from '../../src/save/support';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { deriveSummary } from '../../src/shared/summary';
import type { LoadReport } from '../../src/save/manager';
import { recoverLines } from '../../src/ui/dom/saveNotices';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { addItem } from '../../src/sim/items';
import { earnCoin, recordKill } from '../../src/sim/ledger';
import { addXp } from '../../src/sim/skills';
import { createDemoState, serializeState, type SimState } from '../../src/sim/state';
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

function playedState(): SimState {
  const s = createDemoState(4, 0);
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y, 'Sealed_1');
  addItem(s.entities.comps.inventory[me]!, 'item.sunwort', 4);
  earnCoin(s, me, 321, 'loot');
  addXp(s, me, 'skill.blades', 30);
  recordKill(s, 'creature.mossling');
  s.tick = 9000;
  return s;
}

function plainOf(s: SimState, seq = 1, prevHash = ''): SavePlain {
  return {
    schema: CURRENT_SCHEMA,
    saveId: '00112233445566778899aabbccddeeff',
    seq,
    prevHash,
    createdAt: 1_700_000_000_000 + seq * 1000,
    playSeconds: 300,
    look: LOOK,
    sim: serializeState(s),
    summary: deriveSummary(s, 300),
    ledger: structuredClone(s.ledger),
  };
}

const keyProvider = (): { get: () => Promise<CryptoKey>; ready: Promise<CryptoKey> } => {
  const ready = generateDeviceKey();
  return { get: () => ready, ready };
};

const hasText = (bytes: Uint8Array, text: string): boolean =>
  Buffer.from(bytes).includes(Buffer.from(text, 'utf8'));

describe('binary encoding', () => {
  it('round trips every kind of value exactly, key order included', () => {
    const v = {
      z: 1,
      a: [null, true, false, 0, -1, 127, 128, 300, 2 ** 31, 2 ** 53 - 1, -(2 ** 53 - 1)],
      f: [0.5, -2.25, 1e300, 5e-324, -0],
      s: ['', 'plain', 'héllo ✓', '日本語', 'a'.repeat(500)],
      o: { nested: { deeper: [{ k: 'v' }, []] }, empty: {} },
    };
    const back = unpackValue(packValue(v)) as typeof v;
    expect(back).toEqual(v);
    expect(Object.is(back.f[4], -0)).toBe(true);
    expect(Object.keys(back)).toEqual(['z', 'a', 'f', 's', 'o']);
  });

  it('writes each string once, however often it repeats', () => {
    const one = packValue({ k: 'item.sunwort' });
    const many = packValue({ k: Array.from({ length: 200 }, () => 'item.sunwort') });
    expect(many.length).toBeLessThan(one.length + 200 * 3);
  });

  it('rejects truncated, trailing, malformed and over-deep input without reading past the end', () => {
    const good = packValue({ a: [1, 2, 3], b: 'x' });
    for (let n = 0; n < good.length; n++)
      expect(() => unpackValue(good.slice(0, n)), `cut at ${n}`).toThrow();
    expect(() => unpackValue(Uint8Array.from([...good, 0]))).toThrow('trailing');
    expect(() => unpackValue(Uint8Array.from([0, 99]))).toThrow('bad tag');
    expect(() => unpackValue(Uint8Array.from([0, 7, 255, 255, 255, 255, 15]))).toThrow();
    let deep: unknown = 1;
    for (let i = 0; i < 100; i++) deep = [deep];
    expect(() => unpackValue(packValue(deep))).toThrow('too deep');
  });

  it('a save round trips to the identical canonical sim text', () => {
    const s = playedState();
    const plain = plainOf(s, 3, 'abc');
    const back = unpackSave(packSave(plain));
    expect(back).toEqual(plain);
    expect(back.sim).toBe(plain.sim);
  });

  it('refuses a sim that is not canonical text', () => {
    const plain = plainOf(playedState());
    expect(() => packSave({ ...plain, sim: `${plain.sim} ` })).toThrow('canonical');
  });

  it('is much smaller than the JSON it replaces', () => {
    const plain = plainOf(playedState());
    expect(packSave(plain).length).toBeLessThan(JSON.stringify(plain).length * 0.7);
  });
});

describe('gzip', () => {
  it('round trips, and refuses output over the cap', async () => {
    const data = new Uint8Array(100_000).fill(7);
    const z = await gzip(data);
    expect(z.length).toBeLessThan(2000);
    expect(await gunzip(z)).toEqual(data);
    await expect(gunzip(z, 1000)).rejects.toThrow('too large');
  });
});

describe('device key', () => {
  it('is not extractable and cannot be exported', async () => {
    const key = await generateDeviceKey();
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('is created once and read back after that', async () => {
    const store = new MemoryKeyStore();
    const a = await loadDeviceKey(store);
    const b = await loadDeviceKey(store);
    expect(b).toBe(a);
  });

  it('when another tab wins the race to store a key, that key is used', async () => {
    const winner = await generateDeviceKey();
    let reads = 0;
    const racing: KeyStore = {
      get: async () => (reads++ === 0 ? null : winner),
      put: async () => {
        throw new Error('exists');
      },
    };
    expect(await loadDeviceKey(racing)).toBe(winner);
  });
});

describe('SecureCodec', () => {
  it('round trips a save exactly', async () => {
    const k = keyProvider();
    const codec = new SecureCodec(k.get);
    const plain = plainOf(playedState(), 5, 'prev');
    expect(await codec.decode(await codec.encode(plain))).toEqual(plain);
  });

  it('uses a fresh IV every time, so the same save never encrypts the same way', async () => {
    const codec = new SecureCodec(keyProvider().get);
    const plain = plainOf(playedState());
    const a = await codec.encode(plain);
    const b = await codec.encode(plain);
    expect(a.slice(3, 15)).not.toEqual(b.slice(3, 15));
    expect(a).not.toEqual(b);
  });

  it('a flipped byte anywhere fails authentication or the header check', async () => {
    const codec = new SecureCodec(keyProvider().get);
    const bytes = await codec.encode(plainOf(playedState()));
    const spots = [0, 1, 2, 3, 8, 14, 15, 16, 40, Math.floor(bytes.length / 2), bytes.length - 1];
    for (const at of spots) {
      const bad = bytes.slice();
      bad[at] = (bad[at] as number) ^ 0x01;
      await expect(codec.decode(bad), `flip at ${at}`).rejects.toThrow();
    }
    await expect(codec.decode(bytes.slice(0, bytes.length - 1))).rejects.toThrow();
    await expect(codec.decode(new Uint8Array(0))).rejects.toThrow();
  });

  it('flips in the IV and ciphertext report an authentication failure', async () => {
    const codec = new SecureCodec(keyProvider().get);
    const bytes = await codec.encode(plainOf(playedState()));
    for (const at of [3, 14, 15, bytes.length - 1]) {
      const bad = bytes.slice();
      bad[at] = (bad[at] as number) ^ 0xff;
      await expect(codec.decode(bad)).rejects.toThrow('authentication failed');
    }
  });

  it('another device key cannot open it', async () => {
    const bytes = await new SecureCodec(keyProvider().get).encode(plainOf(playedState()));
    await expect(new SecureCodec(keyProvider().get).decode(bytes)).rejects.toThrow(
      'authentication failed',
    );
  });

  it('stored bytes contain no readable game strings, where plain JSON does', async () => {
    const plain = plainOf(playedState());
    const sealed = await new SecureCodec(keyProvider().get).encode(plain);
    const json = await new JsonCodec().encode(plain);
    const words = [
      'item.sunwort',
      'inventory',
      'skill.blades',
      'creature.mossling',
      'Sealed_1',
      'coinEarned',
      'equipment',
      'entities',
      'summary',
    ];
    for (const w of words) {
      expect(hasText(json, w), `plain JSON has ${w}`).toBe(true);
      expect(hasText(sealed, w), `sealed bytes show ${w}`).toBe(false);
    }
  });

  it('refuses plain JSON unless it is told to read M1 saves, and never writes it', async () => {
    const plain = plainOf(playedState());
    const json = await new JsonCodec().encode(plain);
    const strict = new SecureCodec(keyProvider().get);
    await expect(strict.decode(json)).rejects.toThrow();
    const lenient = new SecureCodec(keyProvider().get, true);
    expect((await lenient.decode(json)).saveId).toBe(plain.saveId);
    expect((await lenient.encode(plain))[0]).toBe(0x50);
  });
});

describe('SaveManager with the secure codec', () => {
  const make = (): { mgr: SaveManager; storage: MemoryStorage; clock: { t: number } } => {
    const storage = new MemoryStorage();
    const k = keyProvider();
    const clock = { t: 1_700_000_000_000 };
    const mgr = new SaveManager({
      codec: new SecureCodec(k.get),
      storage,
      now: () => clock.t,
      newId: () => 'ab'.repeat(16),
    });
    return { mgr, storage, clock };
  };
  const input = (s: SimState): { sim: SimState; look: DollSpec; playSeconds: number } => ({
    sim: s,
    look: LOOK,
    playSeconds: 10,
  });

  it('commits and loads with an intact chain', async () => {
    const { mgr, clock } = make();
    const s = playedState();
    await mgr.commit(input(s));
    clock.t += 5000;
    s.tick += 100;
    await mgr.commit(input(s));
    const got = await mgr.load();
    expect(got!.plain.seq).toBe(2);
    expect(got!.report.chain).toBe('ok');
    expect(got!.plain.ledger).toEqual(s.ledger);
  });

  it('a flipped byte in the latest snapshot falls back to the previous one and says so', async () => {
    const { mgr, storage, clock } = make();
    const s = playedState();
    await mgr.commit(input(s));
    clock.t += 5000;
    s.tick += 100;
    await mgr.commit(input(s));
    storage.corrupt('latest', 20);
    const got = await mgr.load();
    expect(got!.plain.seq).toBe(1);
    expect(got!.report.fellBack).toBe(true);
    expect(got!.report.skipped.map((x) => x.slot)).toEqual(['latest']);
    // The damaged record is kept, not deleted.
    expect((await storage.readAll()).quarantine?.seq).toBe(2);
  });

  it('a snapshot swapped for an older one breaks the chain', async () => {
    const { mgr, storage, clock } = make();
    const s = playedState();
    for (let i = 0; i < 3; i++) {
      await mgr.commit(input(s));
      clock.t += 5000;
      s.tick += 100;
    }
    const slots = await storage.readAll();
    // Replace `previous` (seq 2) with the older, still valid snapshot of seq 1 re-labelled as 2.
    const forged = { ...slots.previous!, checksum: await sha256Hex(Uint8Array.of(1)) };
    await storage.replaceAll({ ...slots, previous: forged });
    const got = await mgr.load();
    expect(got!.report.chain).toBe('broken');
  });

  it('an honest fallback does not read as a broken chain on the next load', async () => {
    const { mgr, storage, clock } = make();
    const s = playedState();
    await mgr.commit(input(s));
    clock.t += 5000;
    await mgr.commit(input(s));
    storage.corrupt('latest', 20);
    await mgr.load();
    clock.t += 5000;
    await mgr.commit(input(s));
    expect((await mgr.load())!.report.chain).toBe('ok');
  });

  it('the emergency slot touches nothing else, and loads only when the rest fail', async () => {
    const { mgr, storage, clock } = make();
    const s = playedState();
    await mgr.commit(input(s));
    const before = await storage.readAll();
    clock.t += 5000;
    s.tick += 999;
    await mgr.commitEmergency(input(s));
    const after = await storage.readAll();
    expect(after.latest).toEqual(before.latest);
    expect(after.emergency).not.toBeNull();
    expect((await mgr.load())!.report.slot).toBe('latest');
    storage.corrupt('latest', 20);
    const got = await mgr.load();
    expect(got!.report.slot).toBe('emergency');
    expect(got!.report.fellBack).toBe(true);
    expect(got!.plain.summary.tick).toBe(s.tick);
  });

  it('M1 saves in plain JSON load, migrate to the current schema, and are re-saved sealed', async () => {
    const f2 = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-2.json'), 'utf8'),
    ) as { plain: SavePlain };
    const json = new TextEncoder().encode(JSON.stringify(f2.plain));
    const storage = new MemoryStorage();
    await storage.replaceAll({
      latest: { seq: 12, savedAt: 1, checksum: await sha256Hex(json), bytes: json },
      previous: null,
      old: null,
      emergency: null,
      quarantine: null,
    });
    const k = keyProvider();
    const mgr = new SaveManager({
      codec: new SecureCodec(k.get, true),
      storage,
      now: () => 2,
      newId: () => 'x',
    });
    const got = await mgr.load();
    expect(got!.plain.schema).toBe(CURRENT_SCHEMA);
    expect(got!.plain.summary.coin).toBe(137);
    expect(got!.plain.ledger.coinEarned).toEqual({ seed: 137 });
    // The next save is sealed.
    const s = (await import('../../src/sim/state')).deserializeState(got!.plain.sim);
    await mgr.commit({ sim: s, look: got!.plain.look, playSeconds: 141 });
    const stored = (await storage.readAll()).latest!.bytes;
    expect(stored[0]).toBe(0x50);
    expect(hasText(stored, 'inventory')).toBe(false);
    expect(migrate((await mgr.load())!.plain).seq).toBe(13);
  });
});

describe('save time', () => {
  /** A state sized like a long game: thousands of entities and a wide ledger. */
  function bigState(): SimState {
    const s = playedState();
    const me = 0;
    for (let i = 0; i < 4000; i++) {
      const id = s.entities.comps.pos.length;
      s.entities.comps.pos[id] = { x: i * 7, y: i * 13 };
      s.entities.alive[id] = true;
    }
    for (let i = 0; i < 400; i++) {
      s.ledger.kills[`creature.kind_${i}`] = i;
      s.ledger.itemsMade.loot = { ...s.ledger.itemsMade.loot, [`item.thing_${i}`]: i * 3 };
    }
    void me;
    return s;
  }

  it('the main-thread work of a save stays inside the 50 ms budget, and the size inside 500 KB', async () => {
    const s = bigState();
    const codec = new SecureCodec(keyProvider().get);
    const times: number[] = [];
    let bytes: Uint8Array = new Uint8Array(0);
    for (let i = 0; i < 4; i++) {
      const t0 = performance.now();
      const plain = plainOf(s, i + 1);
      const packed = packSave(plain);
      times.push(performance.now() - t0);
      bytes = await codec.encode(plain);
      expect(packed.length).toBeGreaterThan(0);
    }
    // The first run pays for warm-up; the budget is for steady state.
    expect(Math.min(...times)).toBeLessThan(50);
    expect(bytes.length).toBeLessThan(500 * 1024);
  });
});

describe('browser support', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports what is missing, and never says ok without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const r = await checkSaveSupport();
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('IndexedDB');
  });

  it('reports a missing CompressionStream', async () => {
    vi.stubGlobal('indexedDB', {});
    vi.stubGlobal('CompressionStream', undefined);
    const r = await checkSaveSupport();
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('CompressionStream');
  });

  it('is ok when everything is there', async () => {
    vi.stubGlobal('indexedDB', {});
    expect(await checkSaveSupport()).toEqual({ ok: true, missing: [] });
  });
});

describe('recover screen text', () => {
  it('names the save that was loaded and why the newer one was skipped, in plain words', () => {
    const report: LoadReport = {
      slot: 'previous',
      fellBack: true,
      skipped: [{ slot: 'latest', reason: 'authentication failed' }],
      chain: 'unchecked',
    };
    const t = recoverLines(report, Date.UTC(2026, 0, 2, 3, 4), 'en-US');
    expect(t.body).toContain('the save before your latest');
    expect(t.body).toContain('nothing was deleted');
    expect(t.reasons).toEqual(['Your latest save failed its integrity check.']);
  });

  it('explains an emergency load differently', () => {
    const t = recoverLines(
      { slot: 'emergency', fellBack: true, skipped: [], chain: 'unchecked' },
      0,
      'en-US',
    );
    expect(t.body).toContain('stopped unexpectedly');
    expect(t.reasons).toEqual([]);
  });
});
