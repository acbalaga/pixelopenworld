import { RECIPES } from '../../content/items/recipes';
import { SKILLS } from '../../content/skills';
import {
  CHEST_COIN_TOTAL,
  COOK_EVENTS_PER_SECOND,
  COUNT_SLACK,
  GATHER_ITEMS_PER_SECOND,
  KILLS_PER_SECOND_MAX,
  PLAY_SLACK_SECONDS,
  coinCeiling,
  maxCoinPerKill,
  saleCeiling,
  xpCeiling,
} from './bounds';
import type { Reason } from './reasons';
import type { View } from './view';

const sum = (t: Record<string, number>): number => Object.values(t).reduce((a, b) => a + b, 0);

/** Layer 3. The totals are possible in the recorded play time. */
export function plausibility(v: View): Reason[] {
  const out: Reason[] = [];
  const fail = (code: Reason['code'], detail: string): void => {
    out.push({ code, layer: 'plausibility', detail });
  };
  const { plain, ledger } = v;
  const seconds = plain.playSeconds;

  // Play time against the wall clock between the first save and this one.
  const elapsed = (plain.createdAt - plain.startedAt) / 1000;
  if (seconds > elapsed + PLAY_SLACK_SECONDS)
    fail('PLAYTIME_EXCEEDS_ELAPSED', `${seconds} s played in ${Math.round(elapsed)} s`);

  // XP per skill against the fastest every source can pay.
  for (const [id, earned] of Object.entries(ledger.xpEarned)) {
    if (SKILLS[id] && earned > xpCeiling(id, seconds))
      fail('XP_IMPLAUSIBLE', `${id} earned ${earned}, ceiling ${xpCeiling(id, seconds)}`);
  }

  // Kills and crafts per second.
  const kills = sum(ledger.kills);
  if (kills > KILLS_PER_SECOND_MAX * seconds + COUNT_SLACK)
    fail('KILLS_IMPLAUSIBLE', `${kills} kills in ${seconds} s`);
  if (sum(ledger.crafts) > COOK_EVENTS_PER_SECOND * seconds + COUNT_SLACK)
    fail('CRAFTS_IMPLAUSIBLE', `${sum(ledger.crafts)} crafts in ${seconds} s`);

  // Items from gathering against the fastest a hand can work the nodes.
  const gathered = sum(ledger.itemsMade.gather ?? {});
  if (gathered > GATHER_ITEMS_PER_SECOND * seconds + COUNT_SLACK)
    fail('GATHER_RATE', `${gathered} items gathered in ${seconds} s`);

  // Deeds that mirror the ledger never run past it: nothing is counted that was not also recorded.
  const deeds = v.sim.entities.comps.deeds[v.who];
  if (deeds) {
    const crafted = (craft: string): number =>
      Object.entries(ledger.crafts).reduce(
        (n, [rid, c]) => n + (RECIPES[rid]?.craft === craft ? c : 0),
        0,
      );
    const cap: [string, number][] = [
      ['deed.mossling_kills', ledger.kills['creature.mossling'] ?? 0],
      ['deed.kills_onehand', sum(ledger.kills)],
      ['deed.metal_crafted', crafted('smithing')],
      ['deed.cloth_crafted', crafted('tailoring')],
      ['deed.dishes', crafted('cooking')],
    ];
    const gathered = sum(ledger.itemsMade.gather ?? {});
    cap.push(['deed.forage', gathered], ['deed.ore', gathered]);
    if ((deeds.counts['deed.forage'] ?? 0) + (deeds.counts['deed.ore'] ?? 0) > gathered)
      fail('DEED_EXCEEDS_LEDGER', `forage and ore past ${gathered} gathered`);
    for (const [id, max] of cap)
      if ((deeds.counts[id] ?? 0) > max)
        fail('DEED_EXCEEDS_LEDGER', `${id} ${deeds.counts[id]} past ${max}`);
  }

  // Coin, source by source.
  // Coin the player paid shopkeepers refills their purses, so it raises what they can pay out.
  const c = ledger.coinSpent;
  const spent = (c.purchase ?? 0) + (c.recipe ?? 0) + (c.buyback ?? 0) + (c.repair ?? 0);
  let loot = 0;
  for (const [c, n] of Object.entries(ledger.kills)) loot += n * maxCoinPerKill(c);
  const e = ledger.coinEarned;
  if ((e.loot ?? 0) > loot)
    fail('COIN_IMPLAUSIBLE', `loot ${e.loot} from kills worth at most ${loot}`);
  if ((e.chest ?? 0) > CHEST_COIN_TOTAL)
    fail('COIN_IMPLAUSIBLE', `chests ${e.chest}, all chests hold ${CHEST_COIN_TOTAL}`);
  // SALE_RATE. Every shopkeeper holds a purse, so lifetime sale coin cannot pass what the purses
  // can pay: the coin they start with, the top up they earn on a timer (twice as fast for a Fair
  // Dealer once M3-08 lands), and every coin the player has paid them. Prices and
  // haggling change how much one sale pays, never how much the purses hold.
  if ((e.sale ?? 0) > saleCeiling(seconds, spent))
    fail('SALE_RATE', `sales ${e.sale}, shops can pay ${saleCeiling(seconds, spent)}`);
  if ((e.seed ?? 0) > coinCeiling(seconds, kills, spent))
    fail('COIN_IMPLAUSIBLE', `seeded coin ${e.seed} in ${seconds} s`);
  return out;
}
