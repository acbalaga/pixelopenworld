import { describe, expect, it } from 'vitest';
import { validateReachability } from '../../tools/bake-assets/validateReachability';
import { validateRegions } from '../../tools/bake-assets/validateRegions';
import { BUILDS } from '../../tools/fight-sim/builds';
import { fight } from '../../tools/fight-sim/harness';
import { ALLOWED } from '../../tools/bake-assets/reachabilityAllow';
import { ITEMS } from '../../src/content/items';
import { sourcesOf } from '../../src/save/integrity/sources';
import { Run } from '../support/bots';
import { FIGHT, FISH, GATHER, POLICIES, SURVIVE } from '../../tools/sim-bot/policies';

describe('content reachability', () => {
  const items = { 'item.a': { tier: 1 }, 'item.b': { tier: 2 }, 'item.c': { tier: 3 } };
  const none = new Set<string>();

  it('passes the real content, with an allowlist that is empty', () => {
    expect(validateReachability()).toEqual([]);
    expect(Object.keys(ALLOWED)).toEqual([]);
  });

  it('flags a tier 1 or 2 item with no source, and ignores tier 3', () => {
    const errs = validateReachability(items, () => [], [], none, {});
    expect(errs).toHaveLength(2);
    expect(errs.join()).toContain('item.a');
    expect(errs.join()).toContain('item.b');
  });

  it('buying back and the seed source are not sources, and a crafted item needs a recipe', () => {
    expect(validateReachability(items, () => ['buyback', 'seed'], [], none, {})).toHaveLength(2);
    expect(validateReachability(items, () => ['craft'], [], none, {})).toHaveLength(2);
    expect(validateReachability(items, () => ['loot'], [], none, {})).toEqual([]);
  });

  it('a recipe counts only when its ingredients can be obtained', () => {
    const src = (i: string): string[] => (i === 'item.b' ? ['loot'] : []);
    // a is made from b, and b drops: both reachable.
    const ok = [{ result: 'item.a', ingredients: [{ item: 'item.b' }] }];
    expect(validateReachability(items, src, ok, none, {})).toEqual([]);
    // a is made from c, which nothing supplies (c is tier 3, so only a is reported).
    const bad = [{ result: 'item.a', ingredients: [{ item: 'item.c' }] }];
    expect(validateReachability(items, src, bad, none, {}).join()).toContain('item.a');
    // A chain: a from b from c, with c dropped.
    const chain = [
      { result: 'item.a', ingredients: [{ item: 'item.b' }] },
      { result: 'item.b', ingredients: [{ item: 'item.c' }] },
    ];
    expect(
      validateReachability(items, (i) => (i === 'item.c' ? ['loot'] : []), chain, none, {}),
    ).toEqual([]);
  });

  it('the leftovers of a failed craft are a source', () => {
    expect(validateReachability(items, () => [], [], new Set(['item.a', 'item.b']), {})).toEqual(
      [],
    );
  });

  it('an allowlist entry covers an item, and a stale or unknown entry is an error', () => {
    expect(
      validateReachability(items, () => [], [], none, { 'item.a': 'why', 'item.b': 'why' }),
    ).toEqual([]);
    expect(
      validateReachability(items, () => ['shop'], [], none, { 'item.a': 'why' }).join(),
    ).toContain('can be obtained');
    expect(
      validateReachability(items, () => ['shop'], [], none, { 'item.zzz': 'why' }).join(),
    ).toContain('unknown item');
  });

  it('every allowlisted item is a real tier 1 or 2 item', () => {
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

describe('regions and supply', () => {
  it('passes the real content', () => {
    expect(validateRegions()).toEqual([]);
  });

  it('flags content that belongs to no region, or to two, or that does not exist', () => {
    const r = (id: string, nodes: string[], status: 'built' | 'planned' = 'planned') => ({
      id,
      name: id,
      tier: 1,
      status,
      supply: { nodes, spawners: [], chests: [] },
    });
    expect(validateRegions([r('x', [])], ['node.a'], [], [], [])[0]).toContain('no region');
    expect(
      validateRegions([r('x', ['node.a']), r('y', ['node.a'])], ['node.a'], [], [], []).join(),
    ).toContain('more than one');
    expect(validateRegions([r('x', ['node.zz'])], [], [], [], []).join()).toContain('unknown node');
  });

  it('a built region supplies exactly what its map places', () => {
    const built = {
      id: 'home',
      name: 'Home',
      tier: 1,
      status: 'built' as const,
      supply: { nodes: ['node.a'], spawners: [], chests: [] },
    };
    expect(validateRegions([built], ['node.a', 'node.b'], [], [], ['node.a']).join()).toContain(
      'node.b',
    );
    expect(validateRegions([built], ['node.a'], [], [], []).join()).toContain('does not place');
    expect(
      validateRegions([built], ['node.a', 'node.b'], [], [], ['node.a', 'node.b']).join(),
    ).toContain('not in its supply');
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
  it('there are six, and each pays XP in a short run and keeps the save Intact', async () => {
    expect(POLICIES.map((p) => p.id)).toEqual([
      'gather',
      'fight',
      'craft',
      'request',
      'fish',
      'survive',
    ]);
    for (const policy of [GATHER, FIGHT, FISH, SURVIVE]) {
      const run = new Run(policy.seed);
      policy.setup?.(run);
      for (let n = 0; n < 6; n++) policy.step(run, n);
      await run.save();
      expect(run.snapshots[0]!.loaded.plain.trust.state).toBe('intact');
      expect(Object.values(run.s.ledger.xpEarned).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
  });
});
