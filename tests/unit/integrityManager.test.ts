import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JsonCodec, sha256Hex } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { SaveManager } from '../../src/save/manager';
import { migrate } from '../../src/save/migrations';
import { MemoryStorage } from '../../src/save/storage';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { deserializeState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { LOOK, T0, honestState } from '../support/saves';

function setup(audit?: (p: SavePlain) => void) {
  const storage = new MemoryStorage();
  const clock = { t: T0 };
  const mgr = new SaveManager({
    codec: new JsonCodec(),
    storage,
    now: () => clock.t,
    newId: () => 'cc'.repeat(16),
    ...(audit ? { audit } : {}),
  });
  return { storage, clock, mgr };
}

const fixture = (name: string): { plain: SavePlain } =>
  JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'saves', name), 'utf8'));

describe('trust through the save manager', () => {
  it('an honest save is Intact after a load', async () => {
    const { mgr, clock } = setup();
    const s = honestState();
    await mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    clock.t += 1000;
    const got = await mgr.load();
    expect(got!.plain.trust).toEqual({ state: 'intact', reasons: [], flaggedAt: null });
  });

  it('an edited save loads Flagged with the reason, and plays on', async () => {
    const { mgr, clock } = setup();
    const s = honestState();
    s.entities.comps.avatar[findAvatar(s)!]!.coin += 1_000_000;
    await mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    clock.t += 5000;
    const got = await mgr.load();
    expect(got!.plain.trust.state).toBe('flagged');
    expect(got!.plain.trust.reasons).toContain('COIN_RECONCILE');
    expect(got!.plain.trust.flaggedAt).toBe(clock.t);
    // It still loads as a game and runs.
    const sim = deserializeState(got!.plain.sim);
    const me = findAvatar(sim)!;
    for (let i = 0; i < 30; i++) stepWorld(sim, me, { commands: [] });
    expect(sim.tick).toBe(s.tick + 30);
  });

  it('a Flagged save saves again and stays Flagged, even once the edit is undone', async () => {
    const { mgr, clock } = setup();
    const s = honestState();
    const me = findAvatar(s)!;
    s.entities.comps.avatar[me]!.coin += 1_000_000;
    await mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    clock.t += 5000;
    const first = (await mgr.load())!.plain.trust;
    expect(first.state).toBe('flagged');

    // Play on from the loaded save, with the extra coin taken away again, and save twice.
    const sim = deserializeState((await mgr.load())!.plain.sim);
    sim.entities.comps.avatar[me]!.coin -= 1_000_000;
    for (let i = 0; i < 3; i++) {
      clock.t += 5000;
      sim.tick += 30;
      await mgr.commit({ sim, look: LOOK, playSeconds: sim.tick / 30 });
    }
    clock.t += 5000;
    const later = (await mgr.load())!.plain;
    expect(validateSave(later).ok).toBe(true);
    expect(later.trust).toEqual(first);
    expect(mgr.currentTrust()).toEqual(first);
  });

  it('a Flagged save loaded by a fresh manager stays Flagged and keeps saving as Flagged', async () => {
    const a = setup();
    const s = honestState();
    s.entities.comps.avatar[findAvatar(s)!]!.coin += 7;
    await a.mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    const b = new SaveManager({
      codec: new JsonCodec(),
      storage: a.storage,
      now: () => T0 + 99_000,
      newId: () => 'dd'.repeat(16),
    });
    const got = await b.load();
    expect(got!.plain.trust.state).toBe('flagged');
    s.tick += 30;
    await b.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    expect((await b.load())!.plain.trust.state).toBe('flagged');
  });

  it("a new character does not inherit the old save's Flagged mark", async () => {
    const { mgr, clock } = setup();
    const s = honestState();
    s.entities.comps.avatar[findAvatar(s)!]!.coin += 1_000_000;
    await mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    clock.t += 5000;
    expect((await mgr.load())!.plain.trust.state).toBe('flagged');

    // The saved character could not be used, and a new one begins.
    mgr.startFresh();
    expect(mgr.currentTrust().state).toBe('intact');
    const fresh = honestState();
    clock.t += 5000;
    await mgr.commit({ sim: fresh, look: LOOK, playSeconds: fresh.tick / 30 });
    clock.t += 5000;
    const got = await mgr.load();
    expect(got!.plain.trust).toEqual({ state: 'intact', reasons: [], flaggedAt: null });
    expect(got!.plain.startedAt).toBeGreaterThan(T0);
    // The old character stays in rotation as a backup, and the chain carries on.
    expect(got!.report.chain).toBe('ok');
  });

  it('a broken snapshot chain flags the save', async () => {
    const { mgr, storage, clock } = setup();
    const s = honestState();
    for (let i = 0; i < 3; i++) {
      await mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
      clock.t += 5000;
      s.tick += 30;
    }
    const slots = await storage.readAll();
    await storage.replaceAll({
      ...slots,
      previous: { ...slots.previous!, checksum: await sha256Hex(Uint8Array.of(9)) },
    });
    const got = await mgr.load();
    expect(got!.report.chain).toBe('broken');
    expect(got!.plain.trust.reasons).toContain('CHAIN_BROKEN');
  });

  it('an honest fallback after a damaged write does not flag the save', async () => {
    const { mgr, storage, clock } = setup();
    const s = honestState();
    for (let i = 0; i < 2; i++) {
      await mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
      clock.t += 5000;
      s.tick += 30;
    }
    storage.corrupt('latest', 5);
    const got = await mgr.load();
    expect(got!.report.fellBack).toBe(true);
    expect(got!.plain.trust.state).toBe('intact');
  });

  it('the audit hook sees every committed save, so dev builds can warn on each one', async () => {
    const audit = vi.fn();
    const { mgr } = setup(audit);
    const s = honestState();
    await mgr.commit({ sim: s, look: LOOK, playSeconds: s.tick / 30 });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(validateSave(audit.mock.calls[0]![0] as SavePlain).ok).toBe(true);
  });
});

describe('older saves migrate to the current schema and validate clean', () => {
  it('schema 3 gains a start time and an Intact trust', () => {
    const f = fixture('schema-3.json').plain;
    expect(f.schema).toBe(3);
    const now = migrate(f);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(now.startedAt).toBe(f.createdAt - f.playSeconds * 1000);
    expect(now.trust).toEqual({ state: 'intact', reasons: [], flaggedAt: null });
    expect(now.sim).toBe(f.sim);
    expect(validateSave(now).reasons).toEqual([]);
  });

  it('schema 2 goes all the way and validates clean', () => {
    const f = fixture('schema-2.json').plain;
    const now = migrate(f);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });

  it('schema 1 goes all the way and validates clean', () => {
    const f = fixture('schema-1.json').plain;
    expect(validateSave(migrate(f)).reasons).toEqual([]);
  });
});
