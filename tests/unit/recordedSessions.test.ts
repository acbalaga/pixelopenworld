import { describe, expect, it } from 'vitest';
import { validateSave } from '../../src/save/integrity';
import { tamper } from '../support/saves';
import { BOAR, BOSS, MOSSLING, Run, SPITBLOOM, TPS } from '../support/bots';

/** 30 simulated minutes, the shortest session the ticket asks for. */
const MINUTES_30 = 30 * 60 * TPS;

/** What went wrong, in words, or 'ok'. Every snapshot of a run is checked, not only the last. */
function report(run: Run): string {
  const flagged = run.snapshots.filter((s) => s.loaded.plain.trust.state === 'flagged');
  const first = flagged[0];
  if (!first) return 'ok';
  return `flagged at tick ${first.tick}: ${first.loaded.plain.trust.reasons.join(', ')}\n${validateSave(
    first.loaded.plain,
  )
    .reasons.map((r) => `${r.code}: ${r.detail}`)
    .join('\n')}`;
}

describe('recorded sessions: honest play is never flagged', () => {
  it('hunter: fights, loots, sells, buys, takes and finishes the request', async () => {
    const run = new Run(101);
    await run.save();
    run.talk('npc.guard', 'ask', -1);
    run.talk('npc.guard', 'ask', 0);
    let loops = 0;
    while (run.ticks < MINUTES_30) {
      run.fight(MOSSLING, { eatBelow: 40 });
      if (run.dead) run.recover();
      if (++loops % 4 === 0) {
        run.talk('npc.guard', 'report', -1);
        run.sellAll('item.moss_tuft');
        run.buy('item.dish_bread', 1);
        run.wearBest();
      }
      if (loops % 6 === 0) run.sprint(120);
      run.run(120);
      await run.autosave();
    }
    await run.save();

    // The run did real things, so zero flags is not an empty result.
    const l = run.s.ledger;
    expect(run.snapshots.length).toBeGreaterThan(25);
    expect(l.kills[MOSSLING]).toBeGreaterThan(100);
    expect(l.coinEarned.loot).toBeGreaterThan(0);
    expect(l.coinEarned.sale).toBeGreaterThan(0);
    expect(l.coinSpent.purchase).toBeGreaterThan(0);
    expect(l.coinEarned.request).toBe(50);
    expect(l.xpEarned['skill.blades']).toBeGreaterThan(0);
    expect(report(run)).toBe('ok');
  }, 120_000);

  it('gatherer and cook: forages, cooks recipes and experiments, eats, with a night offline', async () => {
    const run = new Run(202);
    await run.save();
    const nodes: [number, number, 'herb' | 'berry'][] = [
      [25, 30, 'herb'],
      [25, 32, 'herb'],
      [25, 34, 'herb'],
      [21, 30, 'berry'],
      [21, 32, 'berry'],
    ];
    let loops = 0;
    let closed = false;
    while (run.ticks < MINUTES_30) {
      const [x, y] = nodes[loops % nodes.length]!;
      run.gather(x, y, loops % 2 === 0);
      if (run.count('item.sunwort') >= 1 && run.count('item.dewmint') >= 1)
        run.cook(['item.sunwort', 'item.dewmint']);
      if (run.count('item.berry_red') >= 1 && run.count('item.berry_blue') >= 1)
        run.cook(['item.berry_red', 'item.berry_blue']);
      if (loops % 7 === 6 && run.count('item.sunwort') >= 1 && run.count('item.berry_red') >= 1)
        run.cook(['item.sunwort', 'item.berry_red']); // an experiment: burnt, or a discovery
      if (loops % 5 === 4) run.eat();
      if (loops % 9 === 8) run.fight(MOSSLING, { eatBelow: 30 });
      if (run.dead) run.recover();
      run.run(400);
      // A night with the game closed: wall time passes, play time does not.
      if (!closed && run.ticks > MINUTES_30 / 2) {
        await run.save();
        run.closeFor(8);
        closed = true;
      }
      loops++;
      await run.autosave();
    }
    await run.save();

    const l = run.s.ledger;
    expect(closed).toBe(true);
    expect(l.itemsMade.gather).toBeDefined();
    expect(Object.keys(l.crafts).length).toBeGreaterThan(0);
    expect(l.xpEarned['skill.foraging']).toBeGreaterThan(0);
    expect(report(run)).toBe('ok');
  }, 120_000);

  it('adventurer: dies and takes its echo back, opens a chest, fights a boar, a shooter and the boss', async () => {
    const run = new Run(303);
    await run.save();
    // Coin to lose, so that dying leaves an echo.
    run.talk('npc.guard', 'ask', -1);
    run.talk('npc.guard', 'ask', 0);
    for (let i = 0; i < 5; i++) run.fight(MOSSLING, { eatBelow: 40 });
    run.talk('npc.guard', 'report', -1);
    run.openChest();
    run.wearBest();
    let loops = 0;
    let died = 0;
    let bossDown = false;
    while (run.ticks < MINUTES_30) {
      // Carry some coin into the fight, so that dying leaves an echo behind.
      for (let i = 0; i < 6; i++) run.fight(MOSSLING, { eatBelow: 40 });
      run.sellAll('item.moss_tuft');
      // A boar with no eating: dying is allowed, and then the echo is walked back to.
      run.fight(BOAR, { maxTicks: 600 });
      if (run.dead) {
        died++;
        run.recover();
      }
      run.fight(SPITBLOOM, { eatBelow: 40 });
      if (run.dead) run.recover();
      if (!bossDown && loops === 3) {
        // Rested, and the boss already worn down: the fight itself is the real combat system.
        const pools = run.s.entities.comps.pools[run.me]!;
        pools.hp = pools.hpMax;
        run.fight(BOSS, { hpOverride: 20, eatBelow: 40 });
        bossDown = true;
        if (run.dead) run.recover();
      }
      run.sellAll('item.raw_meat');
      run.sellAll('item.boar_hide');
      run.sellAll('item.seed_pod');
      run.run(200);
      loops++;
      await run.autosave();
    }
    await run.save();

    const l = run.s.ledger;
    expect(died).toBeGreaterThan(0);
    expect(l.coinSpent.echo).toBeGreaterThan(0);
    expect(l.coinEarned.chest).toBeGreaterThan(0);
    expect(l.kills[BOSS]).toBe(1);
    expect(l.itemsMade.loot?.['item.boar_hide']).toBeGreaterThan(0);
    expect(report(run)).toBe('ok');
  }, 120_000);

  it('a run that is then edited is flagged (the harness can see a problem)', async () => {
    const run = new Run(404);
    await run.save();
    for (let i = 0; i < 8; i++) run.fight(MOSSLING, { eatBelow: 40 });
    await run.save();
    const last = run.snapshots.at(-1)!.loaded.plain;
    expect(validateSave(last).ok).toBe(true);
    const edited = tamper(last, (s, me) => {
      s.entities.comps.avatar[me]!.coin += 1_000_000;
    });
    expect(validateSave(edited).reasons.map((r) => r.code)).toContain('COIN_RECONCILE');
  }, 60_000);
});
