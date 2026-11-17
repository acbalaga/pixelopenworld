import { describe, expect, it } from 'vitest';
import { sealSave } from '../../src/save/powsave';
import { loadCommitted } from '../../src/save/seal/registry';
import type { SealSource } from '../../src/save/seal/source';
import { runBattery } from '../../tools/tamper/lib';
import { honestPlain } from '../support/saves';

const committed = async (): Promise<SealSource> => {
  const v1 = (await loadCommitted(1))!;
  return { current: 1, fragments: async (v) => (v === 1 ? v1 : null) };
};

describe('tools/tamper: the hand-edit battery', () => {
  it('every blind edit of an export is refused, and a re-sealed edit is Flagged', async () => {
    const src = await committed();
    const file = await sealSave(honestPlain(), src);
    const outcomes = await runBattery(file, undefined, src);
    expect(outcomes.length).toBeGreaterThan(30);
    expect(outcomes.filter((o) => !o.ok).map((o) => `${o.name}: ${o.detail}`)).toEqual([]);
    // The control opens, so the refusals above are about the edits and not a broken file.
    expect(outcomes[0]).toMatchObject({ group: 'control', result: 'accepted' });
    // Every kind of attempt is represented.
    expect(new Set(outcomes.map((o) => o.group))).toEqual(
      new Set(['control', 'flip', 'truncate', 'extend', 'header', 'splice', 'reseal']),
    );
    const reseal = outcomes.find((o) => o.group === 'reseal');
    expect(reseal?.detail).toMatch(/^flagged: .*COIN_RECONCILE/);
  }, 120_000);

  it('splicing in a second, real export is refused too', async () => {
    const src = await committed();
    const a = await sealSave(honestPlain(), src);
    const b = await sealSave({ ...honestPlain(), seq: 9 }, src);
    const outcomes = await runBattery(a, b, src);
    expect(outcomes.filter((o) => o.group === 'splice').every((o) => o.result === 'rejected')).toBe(
      true,
    );
  }, 120_000);
});
