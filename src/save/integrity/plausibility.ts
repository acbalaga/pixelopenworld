import { RAID, SCHEDULES } from '../../content/balance/events';
import { FARMING } from '../../content/balance/farming';
import { MAIL } from '../../content/balance/mail';
import { GUILD_PAY_CEILING } from '../../content/balance/guilds';
import { RECIPES } from '../../content/items/recipes';
import { SKILLS } from '../../content/skills';
import {
  CHEST_COIN_TOTAL,
  COOK_EVENTS_PER_SECOND,
  COUNT_SLACK,
  GATHER_ITEMS_PER_SECOND,
  HARVEST_BOUND,
  KILLS_PER_SECOND_MAX,
  PLAY_SLACK_SECONDS,
  coinCeiling,
  maxCoinPerKill,
  saleCeiling,
  xpCeiling,
} from './bounds';
import { identitiesOf } from '../../sim/travelers/generate';
import { SKILL_LIST } from '../../sim/travelers/lists';
import { buildCeiling, expectedPoints, playHoursOf } from '../../sim/travelers/progress';
import type { Reason } from './reasons';
import type { View } from './view';

/** Real days of slack on a Traveler's expected build: the trusted epoch and the wall clock differ. */
const TRAVELER_DAY_SLACK = 2;

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

  // Travelers (M5-03): no build runs past the formula for this save's play time and real days, plus
  // the band. A Traveler's build is never a source of player value, so this guards consistency only.
  const hours = Math.max(playHoursOf(v.sim.tick), seconds / 3600);
  const days = Math.max(0, elapsed / 86400) + TRAVELER_DAY_SLACK;
  for (const t of identitiesOf(v.sim.seed)) {
    const life = v.sim.travelers[t.slot];
    if (!life) continue;
    for (const [skill, pts] of life.build) {
      const id = SKILL_LIST[skill] as string;
      const k = t.focus.indexOf(id);
      const ceiling = k < 0 ? 0 : buildCeiling(expectedPoints(t, k, hours, days));
      if (pts > ceiling) {
        fail('TRAVELER_BUILD', `${t.handle} has ${pts} in ${id}, ceiling ${ceiling}`);
        break;
      }
    }
  }

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
  // MAIL. Gifts are capped per real day, and each carries at most `giftCoin[1]` coin or
  // `giftQty[1]` of an item, so the lifetime totals cannot pass what the days played allow.
  const mailDays = Math.ceil(days) + 1;
  if ((e.mailGift ?? 0) > mailDays * MAIL.giftCapPerDay * MAIL.giftCoin[1])
    fail('MAIL_IMPLAUSIBLE', `mail gifts ${e.mailGift} in ${mailDays} days`);
  if (sum(ledger.itemsMade.mailGift ?? {}) > mailDays * MAIL.giftCapPerDay * MAIL.giftQty[1])
    fail(
      'MAIL_IMPLAUSIBLE',
      `mail gift items ${sum(ledger.itemsMade.mailGift ?? {})} in ${mailDays} days`,
    );
  // WORLD EVENTS (M5-11). Raid pay is at most the most one raid pays, per raid fired, and raids
  // fire no more often than their schedule allows in the days the save has lived.
  const raids = ledger.eventsFired?.raid ?? 0;
  const raidSlots = Math.ceil(((days + 1) * 1440) / (SCHEDULES.raid?.period ?? 360)) + 1;
  if (raids > raidSlots) fail('EVENT_IMPLAUSIBLE', `${raids} raids in ${Math.ceil(days)} days`);
  if ((e.eventReward ?? 0) > raids * RAID.coin[1])
    fail('EVENT_IMPLAUSIBLE', `raid pay ${e.eventReward} for ${raids} raids`);
  // GUILD REQUESTS (M5-08). A guild posts its goals once a real week, so the pay cannot pass the
  // weeks the save has lived times the most one week of goals can pay.
  const weeks = Math.ceil(days / 7) + 1;
  if ((e.guildRequest ?? 0) > weeks * GUILD_PAY_CEILING)
    fail('GUILD_IMPLAUSIBLE', `guild pay ${e.guildRequest} in ${weeks} weeks`);
  if ((e.seed ?? 0) > coinCeiling(seconds, kills, spent))
    fail('COIN_IMPLAUSIBLE', `seeded coin ${e.seed} in ${seconds} s`);
  // HARVESTS (M6-02). A plot gives one harvest per crop cycle, and no cycle is shorter than the
  // fastest crop at full rate with fertilizer, so harvests cannot pass the plots times the cycles in
  // the world time the save has lived. No harvest gives more than a giant.
  const harvests = ledger.harvests ?? 0;
  const worldDays = Math.max(elapsed, seconds) / HARVEST_BOUND.realSecondsPerDay;
  const most = FARMING.plots * (Math.ceil(worldDays / HARVEST_BOUND.fastestDays) + 1);
  if (harvests > most) fail('HARVEST_IMPLAUSIBLE', `${harvests} harvests in ${worldDays} days`);
  const units = sum(ledger.itemsMade.harvest ?? {});
  if (units > harvests * HARVEST_BOUND.perHarvest)
    fail('HARVEST_IMPLAUSIBLE', `${units} crops from ${harvests} harvests`);
  return out;
}
