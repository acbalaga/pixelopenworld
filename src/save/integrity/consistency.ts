import { SKILLS_BALANCE as SB } from '../../content/balance/skills';
import { HINTS } from '../../content/hints';
import { REQUESTS } from '../../content/dialogue';
import { CREATURES } from '../../content/creatures';
import { AFFIXES } from '../../content/items/affixes';
import { ITEMS } from '../../content/items';
import type { ItemStack } from '../../sim/state';
import { EQUIP_SLOTS } from '../../content/items/types';
import { RECIPES } from '../../content/items/recipes';
import { SKILLS } from '../../content/skills';
import { deriveSummary } from '../../shared/summary';
import { stackSize } from '../../sim/items';
import { recomputePools, pendingTrial, trialPassed, xpToNext } from '../../sim/skills';
import { canonical, deserializeState } from '../../sim/state';
import {
  COIN_HARD_CAP,
  MAX_BAG_SLOTS,
  MAX_ENTITY_CAPACITY,
  MAX_STORAGE_SLOTS,
  TICK_SLACK_SECONDS,
  TPS,
} from './bounds';
import type { Reason } from './reasons';
import type { View } from './view';

const COIN_SOURCES = ['loot', 'chest', 'request', 'sale', 'echo', 'seed'];
const COIN_SINKS = ['purchase', 'echo'];
const ITEM_SOURCES = [
  'start',
  'loot',
  'gather',
  'cook',
  'chest',
  'request',
  'dialogue',
  'shop',
  'seed',
];

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** Layer 1. The save agrees with itself and with the game's data. */
export function consistency(v: View): Reason[] {
  const out: Reason[] = [];
  const fail = (code: Reason['code'], detail: string): void => {
    out.push({ code, layer: 'consistency', detail });
  };
  const { plain, sim, avatar, inv, storage, skills, pools, journal, ledger } = v;

  // The stored summary and ledger copy are the ones the sim gives.
  if (canonical(plain.summary) !== canonical(deriveSummary(sim, plain.playSeconds)))
    fail('SUMMARY_MISMATCH', 'stored summary differs from the one recomputed from the sim');
  if (canonical(plain.ledger) !== canonical(ledger))
    fail('LEDGER_COPY_MISMATCH', 'the save ledger differs from the sim ledger');
  if (Math.abs(sim.tick / TPS - plain.playSeconds) > TICK_SLACK_SECONDS)
    fail('TICK_PLAYTIME_MISMATCH', `tick ${sim.tick} against ${plain.playSeconds} s`);
  if (sim.entities.capacity > MAX_ENTITY_CAPACITY) fail('BAD_QUANTITY', 'entity capacity');

  // Quantities and hard caps.
  if (!isCount(avatar.coin) || avatar.coin > COIN_HARD_CAP)
    fail('BAD_QUANTITY', `coin ${avatar.coin}`);
  if (inv.slots.length > MAX_BAG_SLOTS || inv.slots.length < 1)
    fail('BAG_SIZE', `${inv.slots.length}`);
  const markedHeld: Record<string, number> = {};
  /** One stack, wherever it sits: known item, count, durability, quality, affixes, gear never stacks. */
  const checkStack = (st: ItemStack, worn: boolean): void => {
    const def = ITEMS[st.item];
    if (!def) return fail('UNKNOWN_ID', st.item);
    if (!isCount(st.qty) || st.qty < 1) return fail('BAD_QUANTITY', `${st.item} x${st.qty}`);
    if (!worn && st.qty > stackSize(st.item)) fail('STACK_OVER_CAP', `${st.item} x${st.qty}`);
    if ((def.equip || def.tool) && st.qty !== 1) fail('STACK_RULES', `${st.item} x${st.qty}`);
    if (
      def.durability === undefined
        ? st.dur !== undefined
        : !isCount(st.dur ?? 0) || (st.dur ?? 0) > def.durability
    )
      fail('DUR_RANGE', `${st.item} dur ${st.dur}`);
    if (st.q !== undefined && (!def.quality || ![1, 2, 3].includes(st.q)))
      fail('QUALITY_ON_PLAIN', `${st.item} q ${st.q}`);
    const affixes = st.affixes ?? [];
    if (affixes.length > (def.affixSlots ?? 0) || affixes.some((a) => !AFFIXES[a]))
      fail('AFFIX_OVERFLOW', `${st.item} ${affixes.join(',')}`);
    if (st.mark) markedHeld[st.item] = (markedHeld[st.item] ?? 0) + st.qty;
  };
  for (const st of inv.slots) if (st) checkStack(st, false);
  if (storage.slots.length > MAX_STORAGE_SLOTS) fail('BAG_SIZE', `storage ${storage.slots.length}`);
  for (const st of storage.slots) if (st) checkStack(st, false);
  for (const slot of Object.keys(inv.equipment)) {
    const st = inv.equipment[slot as keyof typeof inv.equipment];
    if (!(EQUIP_SLOTS as readonly string[]).includes(slot)) fail('EQUIP_SLOT', slot);
    else if (st !== null) {
      checkStack(st, true);
      if (ITEMS[st.item] && ITEMS[st.item]?.equip?.slot !== slot)
        fail('EQUIP_SLOT', `${st.item} in ${slot}`);
    }
  }
  for (const [item, n] of Object.entries(markedHeld))
    if (n > (ledger.marked[item] ?? 0)) fail('MARK_WITHOUT_CRAFT', `${item} marked ${n}`);
  for (const r of inv.recipes) if (!RECIPES[r]) fail('UNKNOWN_ID', r);

  // Skills: ids, counts, rank follows XP, banked XP only while a Trial is pending.
  for (const id of new Set([...Object.keys(skills.points), ...Object.keys(skills.xp)])) {
    if (!SKILLS[id]) {
      fail('SKILL_UNKNOWN', id);
      continue;
    }
    const p = skills.points[id] ?? 0;
    const xp = skills.xp[id] ?? 0;
    if (!isCount(p) || p > SB.maxPoints || !isCount(xp)) {
      fail('BAD_QUANTITY', `${id} ${p}/${xp}`);
      continue;
    }
    for (const t of SB.thresholds)
      if (p >= t && !trialPassed(skills, id, t)) fail('TRIAL_UNPASSED', `${id}@${t}`);
    if (p < SB.maxPoints && pendingTrial(skills, id) === null && xp >= xpToNext(p))
      fail('RANK_XP_MISMATCH', `${id} holds ${xp} xp at ${p} points`);
  }
  for (const key of skills.passed) {
    const m = /^(.+)@(\d+)$/.exec(key);
    if (
      !m ||
      !SKILLS[m[1] as string] ||
      !(SB.thresholds as readonly number[]).includes(Number(m[2]))
    )
      fail('UNKNOWN_ID', key);
  }
  for (const h of journal.hints) if (!HINTS.some((d) => d.id === h)) fail('UNKNOWN_ID', h);

  // Requests.
  for (const [id, r] of Object.entries(journal.requests)) {
    const def = REQUESTS[id];
    if (!def) {
      fail('UNKNOWN_ID', id);
      continue;
    }
    const n = def.goal.count;
    const ok =
      r.state === 'active'
        ? isCount(r.progress) && r.progress < n
        : (r.state === 'ready' || r.state === 'done') && r.progress === n;
    if (!ok) fail('REQUEST_STATE', `${id} ${r.state} ${r.progress}/${n}`);
  }

  // Pools follow ranks and gear, and a pool never sits above its maximum.
  const copy = deserializeState(plain.sim);
  const same = copy.entities.comps.pools[v.who];
  if (same) {
    recomputePools(copy, v.who);
    for (const k of ['hpMax', 'staMax', 'focMax'] as const)
      if (same[k] !== pools[k]) fail('POOL_MAX_MISMATCH', `${k} ${pools[k]} should be ${same[k]}`);
  }
  for (const k of ['hp', 'sta', 'foc'] as const)
    if (pools[k] > pools[`${k}Max` as 'hpMax'] || pools[k] < 0)
      fail('POOL_OVER_MAX', `${k} ${pools[k]}`);

  // Every id the ledger mentions exists, and every count is a whole number.
  const tallies: [Record<string, number>, string[] | null, Record<string, unknown> | null][] = [
    [ledger.coinEarned, COIN_SOURCES, null],
    [ledger.coinSpent, COIN_SINKS, null],
    [ledger.xpEarned, null, SKILLS],
    [ledger.kills, null, CREATURES],
    [ledger.crafts, null, RECIPES],
  ];
  for (const [t, names, content] of tallies)
    for (const [k, n] of Object.entries(t)) {
      if (!isCount(n)) fail('BAD_QUANTITY', `ledger ${k} ${n}`);
      if ((names && !names.includes(k)) || (content && !content[k]))
        fail('UNKNOWN_ID', `ledger ${k}`);
    }
  for (const [src, items] of Object.entries(ledger.itemsMade)) {
    if (!ITEM_SOURCES.includes(src)) fail('UNKNOWN_ID', `ledger source ${src}`);
    for (const [item, n] of Object.entries(items)) {
      if (!ITEMS[item]) fail('UNKNOWN_ID', `ledger ${item}`);
      if (!isCount(n)) fail('BAD_QUANTITY', `ledger ${src}/${item} ${n}`);
    }
  }
  return out;
}
