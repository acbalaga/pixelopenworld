import { describe, expect, it } from 'vitest';
import { validateReachability } from '../../tools/bake-assets/validateReachability';
import { BUILDS } from '../../tools/fight-sim/builds';
import { fight } from '../../tools/fight-sim/harness';
import { ALLOWED } from '../../tools/bake-assets/reachabilityAllow';
import { ITEMS } from '../../src/content/items';
import { sourcesOf } from '../../src/save/integrity/sources';
import { Run } from '../support/bots';
import { FIGHT, GATHER, POLICIES } from '../../tools/sim-bot/policies';

describe('content reachability', () => {
  const items = { 'item.a': { tier: 1 }, 'item.b': { tier: 2 }, 'item.c': { tier: 3 } };

  it('passes the real content with the allowlist as it stands', () => {
    expect(validateReachability()).toEqual([]);
  });

  it('flags a tier 1 or 2 item with no source, and ignores tier 3', () => {
    const errs = validateReachability(items, () => [], {});
    expect(errs).toHaveLength(2);
    expect(errs.join()).toContain('item.a');
    expect(errs.join()).toContain('item.b');
  });

  it('buying back and the seed source are not sources', () => {
    expect(validateReachability(items, () => ['buyback', 'seed'], {})).toHaveLength(2);
    expect(validateReachability(items, () => ['loot'], {})).toEqual([]);
  });

  it('an allowlist entry covers an item, and a stale or unknown entry is an error', () => {
    expect(validateReachability(items, () => [], { 'item.a': 'why', 'item.b': 'why' })).toEqual([]);
    expect(validateReachability(items, () => ['shop'], { 'item.a': 'why' }).join()).toContain(
      'has a source',
    );
    expect(validateReachability(items, () => ['shop'], { 'item.zzz': 'why' }).join()).toContain(
      'unknown item',
    );
  });

  it('every allowlisted item is a real tier 1 or 2 item with no source', () => {
    for (const id of Object.keys(ALLOWED)) {
      expect(ITEMS[id], id).toBeDefined();
      expect(ITEMS[id]!.tier, id).toBeLessThanOrEqual(2);
      expect(
        sourcesOf(id).filter((s) => s !== 'buyback' && s !== 'seed'),
        id,
      ).toEqual([]);
    }
  });
});

describe('fight simulator', () => {
  it('is deterministic for a seed, and a fight ends in a kill or a death', () => {
    const blades = BUILDS.find((b) => b.id === 'blades')!;
    const a = fight(blades, 1, 0, 'creature.mossling', 3);
    const b = fight(blades, 1, 0, 'creature.mossling', 3);
    expect(b).toEqual(a);
    expect(a.ttk).not.toBeNull();
    expect(a.ttk!).toBeGreaterThan(1);
    expect(a.ttk!).toBeLessThan(20);
  });

  it('every build can kill a Mossling at both par ranks', () => {
    for (const build of BUILDS)
      for (const [tier, rank] of [
        [1, 0],
        [2, 15],
      ] as const) {
        const r = fight(build, tier, rank, 'creature.mossling', 1);
        expect(r.ttk, `${build.id} tier ${tier}`).not.toBeNull();
      }
  });
});

describe('sim bot policies', () => {
  it('there are four, and each pays XP in a short run and keeps the save Intact', async () => {
    expect(POLICIES.map((p) => p.id)).toEqual(['gather', 'fight', 'craft', 'request']);
    for (const policy of [GATHER, FIGHT]) {
      const run = new Run(policy.seed);
      policy.setup?.(run);
      for (let n = 0; n < 6; n++) policy.step(run, n);
      await run.save();
      expect(run.snapshots[0]!.loaded.plain.trust.state).toBe('intact');
      expect(Object.values(run.s.ledger.xpEarned).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
  });
});
