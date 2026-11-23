import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/content/items';
import { SHOPS } from '../../src/content/dialogue';
import { SHOP_BALANCE } from '../../src/content/balance/shop';
import { TIME } from '../../src/content/balance/time';
import { Run } from '../support/bots';
import { FIGHT } from '../../tools/sim-bot/policies';
import { supply } from '../../tools/endurance-bot/gather';
import { buyPrice } from '../../src/sim/economy';

/** Sim minutes the fight loop is measured over. The run is seeded, so the number is fixed. */
const FIGHT_MINUTES = 20;

/** Coin the fight loop earns each minute: coin held plus coin spent, over the window. */
function fightCoinPerMinute(): number {
  const run = new Run(FIGHT.seed);
  FIGHT.setup?.(run);
  let n = 0;
  while (run.ticks < FIGHT_MINUTES * TIME.ticksPerMinute) FIGHT.step(run, n++);
  const held = run.s.entities.comps.avatar[run.me]!.coin;
  const spent = Object.values(run.s.ledger.coinSpent).reduce((a, b) => a + b, 0);
  return (held + spent) / (run.ticks / TIME.ticksPerMinute);
}

describe("the price of Brin's iron ore (POW-M4-23D)", () => {
  it('is on the shelf, and costs more than the fight loop earns in the time to mine one ore', () => {
    expect(SHOPS['shop.brin']!.stock.some((s) => s.item === 'item.iron_ore')).toBe(true);
    // Tier 2 mining on the surface veins, ore a minute, from the baked map.
    const veins = supply().find((s) => s.tag === 'mining' && s.tier === 2)!;
    const minutesPerOre = 1 / veins.perMinute;
    const fight = fightCoinPerMinute();
    const earned = fight * minutesPerOre;
    const price = buyPrice('item.iron_ore');
    // Print the numbers so the PR can quote them.
    console.log(
      `iron price rule: ${veins.perMinute} ore/min, ${minutesPerOre.toFixed(2)} min/ore, fight ${fight.toFixed(2)} coin/min, earns ${earned.toFixed(2)} per ore, price ${price}`,
    );
    expect(price).toBeGreaterThan(earned);
  });

  it('keeps buying above selling, as the shop requires', () => {
    const v = ITEMS['item.iron_ore']!.value;
    expect(Math.round((v * SHOP_BALANCE.buyPct) / 100)).toBeGreaterThan(
      Math.floor((v * SHOP_BALANCE.sellPct) / 100),
    );
  });
});
