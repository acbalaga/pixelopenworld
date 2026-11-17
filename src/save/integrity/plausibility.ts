import { SKILLS } from '../../content/skills';
import {
  CHEST_COIN_TOTAL,
  COOK_EVENTS_PER_SECOND,
  COUNT_SLACK,
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

  // Coin, source by source.
  const spent = ledger.coinSpent.purchase ?? 0;
  let loot = 0;
  for (const [c, n] of Object.entries(ledger.kills)) loot += n * maxCoinPerKill(c);
  const e = ledger.coinEarned;
  if ((e.loot ?? 0) > loot)
    fail('COIN_IMPLAUSIBLE', `loot ${e.loot} from kills worth at most ${loot}`);
  if ((e.chest ?? 0) > CHEST_COIN_TOTAL)
    fail('COIN_IMPLAUSIBLE', `chests ${e.chest}, all chests hold ${CHEST_COIN_TOTAL}`);
  if ((e.sale ?? 0) > saleCeiling(seconds, spent))
    fail('COIN_IMPLAUSIBLE', `sales ${e.sale}, shops can pay ${saleCeiling(seconds, spent)}`);
  if ((e.seed ?? 0) > coinCeiling(seconds, kills, spent))
    fail('COIN_IMPLAUSIBLE', `seeded coin ${e.seed} in ${seconds} s`);
  return out;
}
