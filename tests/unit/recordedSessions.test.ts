import { describe, expect, it } from 'vitest';
import { validateSave } from '../../src/save/integrity';
import { spawnNode } from '../../src/sim/items';
import { spawnFixture } from '../../src/sim/systems/fixtures';
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

  it('miner, logger and angler: works veins, trees and a pond for 30 minutes, bare handed, so every sweep is slow', async () => {
    const run = new Run(404);
    await run.save();
    const at = (kind: string, tx: number, ty: number): void => {
      spawnNode(run.s, kind, tx * 16 + 8, ty * 16 + 14);
    };
    at('node.copper_vein', 12, 30);
    at('node.iron_vein', 12, 32);
    at('node.oak_tree', 14, 30);
    at('node.ash_tree', 14, 32);
    at('node.fishing_spot', 16, 30);
    const spots: [number, number, number][] = [
      [12, 30, 1],
      [14, 30, 3],
      [16, 30, 0],
      [12, 32, 1],
      [14, 32, 3],
    ];
    let loops = 0;
    while (run.ticks < MINUTES_30) {
      const [x, y, swings] = spots[loops % spots.length]!;
      run.stand(x + 1, y, 6);
      run.tick({ type: 'interact' });
      if (swings === 0) {
        // Fishing: wait for the bite, then tap inside its window.
        for (let i = 0; i < 300 && run.s.entities.comps.gather[run.me]; i++) {
          run.run(1);
          const g = run.s.entities.comps.gather[run.me];
          if (g && g.t === g.wait && loops % 2 === 0) run.tick({ type: 'interact' });
        }
      } else {
        for (let k = 0; k < swings; k++) {
          run.run(15);
          run.tick({ type: 'interact' });
        }
      }
      run.run(40);
      loops++;
      if (loops % 12 === 0) await run.autosave();
    }
    await run.save();
    const l = run.s.ledger;
    expect(l.itemsMade.gather?.['item.copper_ore']).toBeGreaterThan(0);
    expect(l.itemsMade.gather?.['item.oak_log']).toBeGreaterThan(0);
    expect(l.xpEarned['skill.mining']).toBeGreaterThan(0);
    expect(l.xpEarned['skill.logging']).toBeGreaterThan(0);
    expect(l.xpEarned['skill.fishing']).toBeGreaterThan(0);
    expect(report(run)).toBe('ok');
  }, 120_000);

  it('smith, carpenter and cook: gathers, smelts, saws, forges, mends and cooks for 30 minutes', async () => {
    const run = new Run(505);
    await run.save();
    const at = (kind: string, tx: number, ty: number): void => {
      spawnNode(run.s, kind, tx * 16 + 8, ty * 16 + 14);
    };
    for (const y of [40, 42, 44, 46]) at('node.copper_vein', 10, y);
    for (const y of [40, 42, 44, 46]) at('node.oak_tree', 12, y);
    spawnFixture(run.s, 'fixture.anvil', 18, 41);
    spawnFixture(run.s, 'fixture.workbench', 18, 43);
    const mine = (tx: number, ty: number, swings: number): void => {
      run.stand(tx + 1, ty, 6);
      run.tick({ type: 'interact' });
      for (let k = 0; k < swings; k++) {
        run.run(15);
        run.tick({ type: 'interact' });
      }
      run.run(40);
    };
    /** Crafts at a station south of the avatar, tapping each target on its tick. */
    const craftAt = (tx: number, ty: number, items: string[], taps: readonly number[]): void => {
      run.stand(tx, ty - 1, 4);
      run.tick({ type: 'craft', items });
      const c = run.s.entities.comps.craft[run.me];
      if (!c) return;
      for (let i = 0; i < 120 && run.s.entities.comps.craft[run.me]; i++) {
        run.tick(
          ...(taps.includes(run.s.tick + 1 - c.start) ? [{ type: 'craftStep' as const }] : []),
        );
      }
    };
    let loops = 0;
    while (run.ticks < MINUTES_30) {
      const y = [40, 42, 44, 46][loops % 4]!;
      mine(10, y, 1);
      mine(12, y, 3);
      if (run.count('item.copper_ore') >= 2 && run.count('item.coal') >= 1)
        craftAt(18, 41, ['item.copper_ore', 'item.copper_ore', 'item.coal'], [20, 50, 80]);
      if (run.count('item.oak_log') >= 2)
        craftAt(18, 43, ['item.oak_log', 'item.oak_log'], [20, 50, 80]);
      if (run.count('item.copper_ingot') >= 2 && run.count('item.oak_plank') >= 1)
        craftAt(18, 41, ['item.copper_ingot', 'item.copper_ingot', 'item.oak_plank'], [20, 50, 80]);
      if (run.count('item.oak_plank') >= 3)
        craftAt(18, 43, ['item.oak_plank', 'item.oak_plank', 'item.oak_plank'], [21, 49]);
      // A wasted experiment now and then.
      if (loops % 9 === 8 && run.count('item.oak_log') >= 1) craftAt(18, 43, ['item.oak_log'], []);
      // Mend the pick when it is worn.
      const pick = run.s.entities.comps.inventory[run.me]!.slots.findIndex(
        (x) => x?.item === 'item.pick_copper',
      );
      if (pick >= 0 && run.count('item.copper_ingot') >= 1) {
        run.s.entities.comps.inventory[run.me]!.slots[pick]!.dur = 10;
        run.stand(18, 40, 4);
        run.tick({ type: 'repair', slot: pick });
      }
      loops++;
      if (loops % 6 === 0) await run.autosave();
    }
    await run.save();
    const l = run.s.ledger;
    expect(Object.keys(l.crafts).length).toBeGreaterThan(1);
    expect(l.itemsMade.craft?.['item.copper_ingot']).toBeGreaterThan(0);
    expect(l.xpEarned['skill.smithing']).toBeGreaterThan(0);
    expect(l.xpEarned['skill.woodworking']).toBeGreaterThan(0);
    expect(report(run)).toBe('ok');
  }, 180_000);

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
      // A boar with no eating, met already hurt: dying is allowed, and then the echo is walked back to.
      run.s.entities.comps.pools[run.me]!.hp = 25;
      const falls = (): number =>
        run.events.filter((e) => e.type === 'died' && e.team === 0).length;
      const before = falls();
      run.fight(BOAR, { maxTicks: 600 });
      if (falls() > before) died++;
      if (run.dead) run.recover();
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

  it('survivor: spends a night outdoors and eats forage raw (Survival XP)', async () => {
    const run = new Run(505);
    // Night falls two minutes in, and lasts ten.
    run.worldOffset = (30 + 4 + 4 - 4) * 1800 - 2 * 60 * TPS;
    await run.save();
    let loops = 0;
    while (run.ticks < MINUTES_30) {
      run.gather(21, loops % 2 === 0 ? 30 : 32, true);
      run.eat();
      run.stand(30, 30, 2);
      run.run(600);
      if (run.dead) run.recover();
      loops++;
      await run.autosave();
    }
    await run.save();

    const l = run.s.ledger;
    // Ten minutes of night is five in-game hours, so at least four payments, plus raw eating.
    expect(l.xpEarned['skill.survival']).toBeGreaterThan(4 * 30);
    expect(l.xpEarned['skill.foraging']).toBeGreaterThan(0);
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
