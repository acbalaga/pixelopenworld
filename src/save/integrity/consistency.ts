import { boundsFor } from '../../sim/market';
import { honorFor } from '../../content/balance/pit';
import { SINGULARS } from '../../content/singulars';
import { MAP_BALANCE } from '../../content/balance/map';
import { WAYSTONES } from '../../content/world/waystones';
import { RUMORS } from '../../content/world/rumors';
import { validFogBits } from '../../sim/world/fog';
import { parseChunkKey } from '../../sim/world/window';
import { SKILLS_BALANCE as SB } from '../../content/balance/skills';
import { STATUS_BALANCE as SBAL } from '../../content/balance/status';
import { STATUSES, type StatusId } from '../../content/combat/statuses';
import { TECHNIQUES } from '../../content/combat/techniques';
import { DIALOGUES } from '../../content/dialogue';
import type { RequestDef } from '../../content/requests/types';
import { PATHS } from '../../content/paths';
import { PATHS_BALANCE } from '../../content/balance/paths';
import { requirementsMet } from '../../sim/systems/deeds';
import { knows } from '../../sim/combat/techniques';
import { HINTS } from '../../content/hints';
import { REQUEST_BALANCE as RB } from '../../content/balance/requests';
import { REQUESTS } from '../../content/requests';
import { MAX_STANDING_COIN } from '../../sim/requestGen';
import { STANDING_TEMPLATES } from '../../content/requests/templates';
import { solutionMax, stepWeight } from '../../sim/systems/requests';
import { CREATURES } from '../../content/creatures';
import { validAffix } from '../../content/items/affixes';
import { ITEMS } from '../../content/items';
import type { ItemStack } from '../../sim/state';
import { EQUIP_SLOTS } from '../../content/items/types';
import { RECIPES } from '../../content/items/recipes';
import { SKILLS, TRIALS, trialCount } from '../../content/skills';
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

const COIN_SOURCES = [
  'loot',
  'chest',
  'request',
  'sale',
  'echo',
  'seed',
  'mailGift',
  'guildRequest',
  'marketSale',
  'eventReward',
];
const COIN_SINKS = [
  'purchase',
  'echo',
  'repair',
  'buyback',
  'recipe',
  'marketFee',
  'marketBuy',
  'lease',
  'mill',
];
const ITEM_SOURCES = [
  'start',
  'loot',
  'gather',
  'cook',
  'craft',
  'chest',
  'request',
  'dialogue',
  'shop',
  'buyback',
  'mailGift',
  'guildRequest',
  'market',
  'harvest',
  'mill',
  'seed',
];

/** Renown dialogue can give: each effect once, since each sits on a choice that sets a flag. */
const DIALOGUE_RENOWN = Object.values(DIALOGUES).reduce(
  (n, d) =>
    n +
    Object.values(d.nodes).reduce(
      (m, node) =>
        m +
        [...(node.do ?? []), ...(node.choices ?? []).flatMap((c) => c.do ?? [])].reduce(
          (k, e) => k + ('renown' in e ? e.renown : 0),
          0,
        ),
      0,
    ),
  0,
);

/**
 * A standing request as the generator makes it: one solution of one step, inside its caps. The
 * template the title names decides which step it may have and which cap it answers to. A board
 * gather job is a hand-in at the board (POW-M4-22A), a `deliver` step like a shelf job's, so the
 * step alone does not say which cap applies (POW-M4-23 triage B).
 */
function standingLooksRight(def: RequestDef, id: string): boolean {
  const step = def.solutions[0]?.steps[0];
  const caps = RB.standing;
  const template = STANDING_TEMPLATES.find((t) => t.titleKey === def.titleKey)?.kind;
  const board = 'board' in def.giver ? def.giver.board : null;
  const stepOk =
    template === 'gather'
      ? // Jobs taken before the hand-in change keep their `gather` step.
        step?.kind === 'gather'
        ? step.count <= caps.gather.maxQty
        : step?.kind === 'deliver' && board !== null && step.to === board
          ? step.qty <= caps.gather.maxQty
          : false
      : template === 'deliver'
        ? step?.kind === 'deliver' && step.to !== board && step.qty <= caps.deliver.maxQty
        : template === 'defeat'
          ? step?.kind === 'defeat' && step.count <= caps.defeat.maxQty
          : false;
  return (
    def.kind === 'standing' &&
    def.id === id &&
    id.startsWith('standing.') &&
    def.solutions.length === 1 &&
    def.solutions[0]?.steps.length === 1 &&
    def.reward.items.length === 0 &&
    (def.reward.techniques ?? []).length === 0 &&
    def.reward.renown <= RB.renown.standing &&
    def.reward.coin <= MAX_STANDING_COIN &&
    stepOk
  );
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** Layer 1. The save agrees with itself and with the game's data. */
export function consistency(v: View): Reason[] {
  const out: Reason[] = [];
  const fail = (code: Reason['code'], detail: string): void => {
    out.push({ code, layer: 'consistency', detail });
  };
  const { plain, sim, avatar, inv, storage, skills, pools, journal, ledger } = v;

  // The stored summary and ledger copy are the ones the sim gives.
  // A save below schema 30 predates the Traveler totals (M5-02), so they are left out of its summary.
  const want: Partial<ReturnType<typeof deriveSummary>> = deriveSummary(sim, plain.playSeconds);
  if (plain.schema < 30) {
    delete want.travelerPoints;
    delete want.travelerCoin;
  }
  if (canonical(plain.summary) !== canonical(want))
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
  const masterHeld: Record<string, number> = {};
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
    if (affixes.length > (def.affixSlots ?? 0) || affixes.some((a) => !validAffix(a)))
      fail('AFFIX_OVERFLOW', `${st.item} ${affixes.join(',')}`);
    if (st.mark) markedHeld[st.item] = (markedHeld[st.item] ?? 0) + st.qty;
    if (st.q === 3) masterHeld[st.item] = (masterHeld[st.item] ?? 0) + st.qty;
  };
  for (const st of inv.slots) if (st) checkStack(st, false);
  if (storage.slots.length > MAX_STORAGE_SLOTS) fail('BAG_SIZE', `storage ${storage.slots.length}`);
  for (const st of storage.slots) if (st) checkStack(st, false);
  // The market (M5-10): coin from sales is at most what the sold listings fetched, items sold were
  // listed, items bought are the items the market made, and no listing is out of its bounds.
  {
    const soldValue = ledger.marketSoldValue ?? 0;
    if ((ledger.coinEarned.marketSale ?? 0) > soldValue)
      fail('MARKET_INCOME', `market sales ${ledger.coinEarned.marketSale} of ${soldValue} sold`);
    for (const [item, q] of Object.entries(ledger.marketSoldQty ?? {}))
      if (q > (ledger.itemsListed?.[item] ?? 0))
        fail('MARKET_INCOME', `${item}: sold ${q}, listed ${ledger.itemsListed?.[item] ?? 0}`);
    for (const [item, q] of Object.entries(ledger.itemsBought ?? {}))
      if (q !== (ledger.itemsMade.market?.[item] ?? 0))
        fail('MARKET_INCOME', `${item}: bought ${q}, made ${ledger.itemsMade.market?.[item] ?? 0}`);
    for (const l of sim.market?.listings ?? []) {
      const b = boundsFor(l.item);
      if (!b || !Number.isInteger(l.qty) || l.qty < 1 || l.price < b.floor || l.price > b.ceil)
        fail('MARKET_INCOME', `listing ${l.id} ${l.item} x${l.qty} at ${l.price}`);
    }
  }
  // The Pit honor (M5-30) follows the Pit wins, and the Pit wins are duels won.
  const duels = sim.mail?.duels;
  if (duels) {
    const pit = duels.pit ?? 0;
    if (!Number.isInteger(pit) || pit < 0 || pit > duels.wins)
      fail('PIT_HONOR', `pit wins ${pit} of ${duels.wins} duels won`);
    else if ((duels.honor ?? 0) !== honorFor(pit))
      fail('PIT_HONOR', `honor ${duels.honor} for ${pit} pit wins`);
  }
  // The guild stashes (M5-08) hold what the player put in: the same rules as the storage chest.
  for (const slots of Object.values(sim.guild?.stashes ?? {})) {
    if (!Array.isArray(slots) || slots.length > 64) fail('BAG_SIZE', 'guild stash');
    else for (const st of slots) if (st) checkStack(st, false);
  }
  if (
    !Number.isInteger(sim.guild?.id ?? 0) ||
    (sim.guild?.id ?? 0) < 0 ||
    (sim.guild?.id ?? 0) > 12
  )
    fail('BAD_QUANTITY', `guild ${sim.guild?.id}`);
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
  // A Masterwork is only ever made by a manual craft, which tallies it.
  for (const [item, n] of Object.entries(masterHeld))
    if (n > (ledger.masterworks[item] ?? 0)) fail('MASTERWORK_WITHOUT_CRAFT', `${item} x${n}`);
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
  for (const [id, pr] of Object.entries(skills.trial)) {
    const def = TRIALS[id];
    const max = def ? trialCount(def.objective) : 0;
    if (
      !def ||
      !skills.offered.includes(id) ||
      trialPassed(skills, def.skill, def.threshold) ||
      !isCount(pr.n) ||
      pr.n > max
    )
      fail('TRIAL_PROGRESS_ORPHAN', id);
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

  // Requests: each is known (or a standing one that looks like something the generator makes),
  // and its steps and counts are ones its solutions can have.
  for (const [id, r] of Object.entries(journal.requests)) {
    const def = REQUESTS[id] ?? r.gen;
    if (!def) {
      fail('UNKNOWN_ID', id);
      continue;
    }
    if (r.gen && (REQUESTS[id] || !standingLooksRight(r.gen, id)))
      fail('REQUEST_STATE', `${id} carries a definition the generator does not make`);
    const where = `${id} ${r.state}`;
    if (!isCount(r.progress)) fail('REQUEST_STATE', `${where} progress ${r.progress}`);
    for (const sol of def.solutions) {
      const pr = r.prog[sol.id];
      if (!pr || !isCount(pr.step) || pr.step > sol.steps.length || !isCount(pr.p.n)) {
        fail('REQUEST_STATE', `${where} ${sol.id} step`);
        continue;
      }
      const cur = sol.steps[pr.step];
      if (cur && pr.p.n > stepWeight(cur)) fail('REQUEST_STATE', `${where} ${sol.id} count`);
      if (!cur && pr.p.n !== 0) fail('REQUEST_STATE', `${where} ${sol.id} count past the end`);
    }
    if (Object.keys(r.prog).some((k) => !def.solutions.some((s) => s.id === k)))
      fail('REQUEST_STATE', `${where} unknown solution`);
    if (r.state === 'active') {
      if (r.solution !== null) fail('REQUEST_STATE', `${where} has a solution`);
      const done = def.solutions.some((s) => r.prog[s.id]?.step === s.steps.length);
      if (done) fail('REQUEST_STATE', `${where} has every step done`);
    } else {
      const sol = def.solutions.find((s) => s.id === r.solution);
      if (!sol || r.prog[sol.id]?.step !== sol.steps.length)
        fail('REQUEST_STATE', `${where} without a finished solution`);
      else if (r.progress !== solutionMax(def, sol.id))
        fail('REQUEST_STATE', `${where} progress ${r.progress}`);
    }
  }
  if (journal.pinned !== null && !journal.requests[journal.pinned])
    fail('REQUEST_STATE', `pinned ${journal.pinned} is not held`);

  // Renown: whole numbers, in a known region, and no more than requests, Trials, trade and
  // dialogue could have given.
  const standingPaid = ledger.requestRewards?.n ?? 0;
  let renownMax = standingPaid * RB.renown.standing + skills.passed.length * RB.renown.perTrial;
  for (const [id, r] of Object.entries(journal.requests))
    if (r.state === 'done' && REQUESTS[id]) renownMax += REQUESTS[id].reward.renown;
  for (const [region, n] of Object.entries(journal.renown)) {
    const trade = Math.floor((journal.tradeCoin[region] ?? 0) / RB.renown.tradeCoin);
    if (!isCount(n) || n > RB.renown.max || region !== RB.homeRegion)
      fail('RENOWN_RANGE', `${region} ${n}`);
    else if (n > renownMax + trade + DIALOGUE_RENOWN)
      fail('RENOWN_RANGE', `${region} ${n} exceeds ${renownMax + trade + DIALOGUE_RENOWN}`);
  }
  for (const [region, n] of Object.entries(journal.tradeCoin))
    if (!isCount(n) || region !== RB.homeRegion) fail('RENOWN_RANGE', `trade ${region} ${n}`);

  // Map (M4-06): fog entries are 16 hex characters at a real chunk, notes and rumors are within
  // their caps and known. None of it is value, so this only keeps a damaged save from loading garbage.
  const map = sim.map;
  for (const [region, fog] of Object.entries(map.fog)) {
    if (region.length === 0 || region.length > 40)
      fail('MAP_STATE', `region ${region.slice(0, 40)}`);
    for (const [key, bits] of Object.entries(fog))
      if (!parseChunkKey(key) || !validFogBits(bits)) fail('MAP_STATE', `fog ${region} ${key}`);
  }
  if (map.notes.length > MAP_BALANCE.notes.max) fail('MAP_STATE', `notes ${map.notes.length}`);
  const noteIds = new Set<number>();
  for (const n of map.notes) {
    const ok =
      Number.isInteger(n.id) &&
      n.id >= 1 &&
      n.id < map.nextNote &&
      !noteIds.has(n.id) &&
      typeof n.text === 'string' &&
      n.text.length > 0 &&
      Array.from(n.text).length <= MAP_BALANCE.notes.maxLength &&
      Number.isInteger(n.x) &&
      Number.isInteger(n.y);
    noteIds.add(n.id);
    if (!ok) fail('MAP_STATE', `note ${n.id}`);
  }
  const stones = new Set<string>();
  for (const k of map.waystones) {
    const [region, id] = k.split(':');
    if (stones.has(k) || !region || !WAYSTONES[region]?.some((w) => w.id === id))
      fail('MAP_STATE', `waystone ${k.slice(0, 60)}`);
    stones.add(k);
  }
  if (new Set(map.rumors).size !== map.rumors.length || map.rumors.some((r) => !RUMORS[r]))
    fail('MAP_STATE', 'rumors');

  // Singulars (M4-20): known ids, a step within range, done only when past the last.
  for (const [id, p] of Object.entries(journal.singulars ?? {})) {
    const def = SINGULARS[id];
    const ok =
      !!def &&
      Number.isInteger(p.step) &&
      p.step >= -1 &&
      p.step <= def.steps.length &&
      p.done === (p.step === def.steps.length) &&
      Object.values(p.counters).every((c) => Array.isArray(c) && c.length <= 64);
    if (!ok) fail('SINGULAR_STATE', id.slice(0, 40));
  }

  // Statuses: known ids, one of each on a unit, and no longer than the longest a meal or a spell gives.
  const longest = Math.max(
    ...Object.values(STATUSES).map((d) => d.ticks),
    ...Object.values(ITEMS).map((i) => i.food?.fed?.ticks ?? 0),
  );
  const limit = Math.floor((longest * (100 + SBAL.hexedExtendPct)) / 100);
  sim.entities.comps.statuses.forEach((list) => {
    if (!list) return;
    const seen = new Set<string>();
    for (const st of list) {
      const def = STATUSES[st.id as StatusId];
      if (!def || seen.has(st.id)) fail('STATUS_UNKNOWN', st.id);
      else if (st.id === 'fed' && !(st.item && ITEMS[st.item]?.food?.fed))
        fail('STATUS_UNKNOWN', `fed ${st.item}`);
      else if (!isCount(st.until) || st.until - sim.tick > limit)
        fail('STATUS_UNKNOWN', `${st.id} until ${st.until}`);
      seen.add(st.id);
    }
  });

  // Every slotted technique is one the avatar knows: its skill reaches the band, and it was taught if it needs that.
  {
    const f = sim.entities.comps.fighter[v.who];
    const ld = sim.entities.comps.loadouts[v.who];
    const slotted = [...(f?.slots ?? []), ...(ld?.sets ?? []).flatMap((s) => s.slots)];
    for (const id of slotted) {
      if (id === null) continue;
      const t = TECHNIQUES[id];
      if (!t || !knows(sim, v.who, t)) fail('TECHNIQUE_UNKNOWN', id);
    }
  }

  // Paths: every earned Path's requirements hold, and only earned ones are worn, three at most.
  // (Days since a reset depend on the world clock, which a save does not carry, so they are not checked.)
  {
    const paths = sim.entities.comps.paths[v.who];
    if (paths) {
      for (const id of paths.earned) {
        const p = PATHS[id];
        if (!p || !requirementsMet(sim, v.who, p, false)) fail('PATH_UNEARNED', id);
      }
      if (
        paths.worn.length > PATHS_BALANCE.maxWorn ||
        paths.worn.some((id) => !paths.earned.includes(id)) ||
        (paths.shown !== null && !paths.worn.includes(paths.shown))
      )
        fail('WORN_NOT_EARNED', paths.worn.join(','));
    }
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
    [ledger.itemsSold, null, ITEMS],
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
