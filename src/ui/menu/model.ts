import { SKILLS_BALANCE as SB } from '../../content/balance/skills';
import { TIME } from '../../content/balance/time';
import { ITEMS } from '../../content/items';
import {
  EQUIP_SLOTS,
  type BagFilter,
  type EquipSlot,
  type ItemDef,
} from '../../content/items/types';
import { SKILLS, TRIALS, trialCount, type SkillFamily } from '../../content/skills';
import { ITEM_STRINGS } from '../../content/strings/items';
import { UI_STRINGS } from '../../content/strings/ui';
import { fill, TRIAL_STRINGS } from '../../content/strings/skills';
import { NPCS } from '../../content/dialogue';
import { AFFIXES } from '../../content/items/affixes';
import { gearStats, isBroken } from '../../sim/items';
import { masteryName, pendingTrial, trialPassed, xpToNext } from '../../sim/skills';
import { dayPhase } from '../../sim/time';
import type { SimState } from '../../sim/state';

/**
 * What the Menu and HUD show, worked out from sim state as plain data. No DOM here, so the
 * rules (what a row says, which actions an item offers) are unit tested.
 */

export interface PoolView {
  key: 'hp' | 'sta' | 'foc';
  label: string;
  cur: number;
  max: number;
  /** Shown value: whole points. Stamina and Focus are held in tenths. */
  curText: string;
  maxText: string;
}

export interface GearSlotView {
  slot: EquipSlot;
  label: string;
  item: string | null;
  itemName: string | null;
  icon: string | null;
}

export interface CharacterView {
  pools: PoolView[];
  gear: GearSlotView[];
  coin: number;
}

export interface SkillRowView {
  id: string;
  name: string;
  points: number;
  mastery: string;
  /** Progress to the next point, 0 to 100. */
  progressPct: number;
  /** 'ready' when XP is waiting on a Trial, 'offered' when a Trial has been given. */
  trial: 'ready' | 'offered' | null;
  /**
   * Where the next Trial is, shown while the next point waits on one (XP banked, or one point
   * short). The Trial's own `hint` string once authored (M3-03), else `trialUnknown`.
   */
  trialHint: string | null;
  /** Thresholds whose Trial is passed. Shown as a seal under the row. */
  sealed: number[];
  /** The line a screen reader reads for the row. */
  label: string;
}

export interface TrialLogRow {
  id: string;
  /** Who gave it. */
  giver: string;
  intro: string;
  n: number;
  count: number;
  skill: string;
  label: string;
}

export interface SkillFamilyView {
  family: SkillFamily;
  label: string;
  rows: SkillRowView[];
}

export type ItemAction = 'use' | 'equip' | 'drop';

export type BagFilterId = 'all' | BagFilter;
export type BagSortId = 'type' | 'tier' | 'value' | 'newest';

export interface BagSlotView {
  index: number;
  /** Quality 0 to 3, and its corner glyph (empty for Common). */
  q: number;
  glyph: string;
  broken: boolean;
  item: string | null;
  qty: number;
  name: string | null;
  icon: string | null;
  label: string;
}

export interface BagView {
  slots: BagSlotView[];
  used: number;
  total: number;
  coin: number;
}

export interface ItemDetailView {
  item: string;
  name: string;
  description: string;
  category: string;
  value: string;
  qty: string;
  actions: ItemAction[];
  /** Extra lines under the description: quality, durability, broken, maker, affixes, stats. */
  lines: string[];
  broken: boolean;
}

export interface StatusIconView {
  id: string;
  icon: string;
  label: string;
  /** Ticks left, or null for no timer. */
  ticksLeft: number | null;
}

const FAMILY_ORDER: readonly SkillFamily[] = [
  'arms',
  'magic',
  'gathering',
  'crafting',
  'social',
  'exploration',
];

/** Display name of an item. */
export function itemName(id: string): string {
  const d = ITEMS[id];
  return (d && ITEM_STRINGS[d.nameKey]) || id;
}

/** Pool values for display. Stamina and Focus are stored in tenths. */
function poolView(key: PoolView['key'], cur: number, max: number): PoolView {
  const whole = key === 'hp' ? (n: number): number => n : (n: number): number => Math.floor(n / 10);
  return {
    key,
    label: UI_STRINGS.pools[key],
    cur,
    max,
    curText: String(whole(cur)),
    maxText: String(whole(max)),
  };
}

export function characterView(state: SimState, who: number): CharacterView {
  const p = state.entities.comps.pools[who];
  const inv = state.entities.comps.inventory[who];
  const a = state.entities.comps.avatar[who];
  const pools: PoolView[] = p
    ? [
        poolView('hp', p.hp, p.hpMax),
        poolView('sta', p.sta, p.staMax),
        poolView('foc', p.foc, p.focMax),
      ]
    : [];
  const gear = EQUIP_SLOTS.map((slot): GearSlotView => {
    const item = inv?.equipment[slot]?.item ?? null;
    return {
      slot,
      label: UI_STRINGS.slots[slot],
      item,
      itemName: item ? itemName(item) : null,
      icon: item ? (ITEMS[item]?.icon ?? null) : null,
    };
  });
  return { pools, gear, coin: a?.coin ?? 0 };
}

/** The Skills tab line for the Trial at a threshold: its authored hint, or "no one can test this yet". */
function trialHintFor(skill: string, threshold: number): string {
  const t = Object.values(TRIALS).find((x) => x.skill === skill && x.threshold === threshold);
  return (t && TRIAL_STRINGS[t.hint]) || UI_STRINGS.trialUnknown;
}

/** The Trials the avatar holds now, with progress. Shown at the top of the Skills tab. */
export function trialLog(state: SimState, who: number): TrialLogRow[] {
  const s = state.entities.comps.skills[who];
  const out: TrialLogRow[] = [];
  for (const id of s?.offered ?? []) {
    const t = TRIALS[id];
    if (!t || !s) continue;
    const giver = 'npc' in t.giver ? (NPCS[t.giver.npc]?.name ?? '') : '';
    const n = s.trial[id]?.n ?? 0;
    const count = trialCount(t.objective);
    const intro = TRIAL_STRINGS[t.intro] ?? '';
    out.push({
      id,
      giver,
      intro,
      n,
      count,
      skill: SKILLS[t.skill]?.name ?? '',
      label: `${SKILLS[t.skill]?.name ?? ''}. ${fill(UI_STRINGS.trialFrom, { name: giver, intro })} ${fill(UI_STRINGS.trialProgress, { n, count })}`,
    });
  }
  return out;
}

export function skillsView(state: SimState, who: number): SkillFamilyView[] {
  const s = state.entities.comps.skills[who];
  const out: SkillFamilyView[] = [];
  for (const family of FAMILY_ORDER) {
    const rows: SkillRowView[] = [];
    // Table order: the order skills are declared in, which is the order of design/11.
    for (const id of Object.keys(SKILLS)) {
      const def = SKILLS[id];
      if (!def || def.family !== family) continue;
      const points = s?.points[id] ?? 0;
      // A skill stays hidden until it first ranks up, so earning one is a surprise.
      if (points < 1) continue;
      const xp = s?.xp[id] ?? 0;
      const pending = s ? pendingTrial(s, id) : null;
      const cost = points >= SB.maxPoints ? 0 : xpToNext(points);
      const offered =
        s !== undefined &&
        s !== null &&
        pending !== null &&
        Object.values(TRIALS).some(
          (t) => t.skill === id && t.threshold === pending && s.offered.includes(t.id),
        );
      const mastery = masteryName(points);
      rows.push({
        id,
        name: def.name,
        points,
        mastery,
        progressPct: cost === 0 ? 100 : Math.min(100, Math.floor((xp * 100) / cost)),
        trial: pending !== null && xp >= cost ? (offered ? 'offered' : 'ready') : null,
        trialHint: pending !== null && !offered ? trialHintFor(id, pending) : null,
        sealed: s ? SB.thresholds.filter((th) => trialPassed(s, id, th)) : [],
        label: fill(UI_STRINGS.skillRow, { name: def.name, rank: mastery, points }),
      });
    }
    if (rows.length > 0) out.push({ family, label: UI_STRINGS.skillsFamilies[family], rows });
  }
  return out;
}

export function bagView(
  state: SimState,
  who: number,
  opts: { filter?: BagFilterId; sort?: BagSortId | null } = {},
): BagView {
  const inv = state.entities.comps.inventory[who];
  const a = state.entities.comps.avatar[who];
  const all = (inv?.slots ?? []).map((s, index): BagSlotView => {
    if (!s) {
      return {
        index,
        q: 0,
        glyph: '',
        broken: false,
        item: null,
        qty: 0,
        name: null,
        icon: null,
        label: UI_STRINGS.bagSlotEmptyLabel,
      };
    }
    const name = itemName(s.item);
    const q = s.q ?? 0;
    const broken = isBroken(s);
    const qname = q > 0 ? `${UI_STRINGS.quality[q]} ` : '';
    return {
      index,
      q,
      glyph: UI_STRINGS.qualityGlyph[q] ?? '',
      broken,
      item: s.item,
      qty: s.qty,
      name,
      icon: ITEMS[s.item]?.icon ?? null,
      label:
        fill(UI_STRINGS.bagSlot, { item: `${qname}${name}`, qty: s.qty }) +
        (broken ? `, ${UI_STRINGS.brokenGlyph}` : ''),
    };
  });
  const filter = opts.filter ?? 'all';
  const sort = opts.sort ?? null;
  // Plain view (all, no sort) is the real grid with its empty cells. Anything else lists only items.
  const plain = filter === 'all' && sort === null;
  const full = all.filter((s) => s.item !== null);
  let slots = full.filter((s) => filter === 'all' || ITEMS[s.item as string]?.bag === filter);
  const def = (s: BagSlotView): ItemDef | undefined => ITEMS[s.item as string];
  const typeRank = (s: BagSlotView): number => BAG_ORDER.indexOf(def(s)?.bag ?? 'other');
  const by: Record<BagSortId, (x: BagSlotView, y: BagSlotView) => number> = {
    type: (x, y) => typeRank(x) - typeRank(y) || (x.name ?? '').localeCompare(y.name ?? ''),
    tier: (x, y) => (def(y)?.tier ?? 0) - (def(x)?.tier ?? 0) || typeRank(x) - typeRank(y),
    value: (x, y) => (def(y)?.value ?? 0) - (def(x)?.value ?? 0),
    newest: (x, y) => y.index - x.index,
  };
  if (sort) slots = [...slots].sort((x, y) => by[sort](x, y) || x.index - y.index);
  return {
    slots: plain ? all : slots,
    used: full.length,
    total: all.length,
    coin: a?.coin ?? 0,
  };
}

const BAG_ORDER: readonly BagFilter[] = ['gear', 'tools', 'food', 'materials', 'other'];

/** What can be done with an item from the Bag: eat food, wear gear, and drop anything. */
export function itemActions(def: ItemDef): ItemAction[] {
  const out: ItemAction[] = [];
  if (def.food) out.push('use');
  if (def.equip) out.push('equip');
  out.push('drop');
  return out;
}

export function itemDetail(state: SimState, who: number, slot: number): ItemDetailView | null {
  const s = state.entities.comps.inventory[who]?.slots[slot];
  const def = s ? ITEMS[s.item] : undefined;
  if (!s || !def) return null;
  const lines: string[] = [];
  const q = s.q ?? 0;
  if (q > 0) lines.push(fill(UI_STRINGS.detailQuality, { q: UI_STRINGS.quality[q] ?? '' }));
  const broken = isBroken(s);
  if (def.durability !== undefined) {
    lines.push(
      fill(UI_STRINGS.detailDurability, { n: s.dur ?? def.durability, max: def.durability }),
    );
    if (broken) lines.push(UI_STRINGS.detailBroken);
  }
  if (def.equip && (def.equip.power || def.equip.defense || def.equip.weapon)) {
    const g = gearStats(def, s);
    lines.push(fill(UI_STRINGS.detailStats, { power: g.power, defense: g.defense }));
  }
  if (s.affixes && s.affixes.length > 0)
    lines.push(
      fill(UI_STRINGS.detailAffixes, {
        list: s.affixes.map((a) => ITEM_STRINGS[AFFIXES[a]?.nameKey ?? ''] ?? a).join(', '),
      }),
    );
  if (s.mark)
    lines.push(
      fill(UI_STRINGS.detailMark, { handle: state.entities.comps.avatar[who]?.handle ?? '' }),
    );
  return {
    item: s.item,
    name: itemName(s.item),
    description: ITEM_STRINGS[def.descKey] ?? '',
    category: UI_STRINGS.categories[def.category],
    value: fill(UI_STRINGS.detailValue, { n: def.value }),
    qty: fill(UI_STRINGS.detailStack, { n: s.qty }),
    actions: itemActions(def),
    lines,
    broken,
  };
}

/** The status icons under the pool bars. Each has a shape and a name, never color alone. */
export function statusIcons(state: SimState, who: number): StatusIconView[] {
  const out: StatusIconView[] = [];
  const fed = state.entities.comps.fed[who];
  if (fed) {
    out.push({
      id: 'fed',
      icon: ITEMS[fed.item]?.icon ?? 'ui.icon_context',
      label: fill(UI_STRINGS.statusFed, { item: itemName(fed.item) }),
      ticksLeft: Math.max(0, fed.until - state.tick),
    });
  }
  if (state.entities.comps.avatar[who]?.winded)
    out.push({
      id: 'winded',
      icon: 'ui.status_winded',
      label: UI_STRINGS.statusWinded,
      ticksLeft: null,
    });
  return out;
}

export interface ClockView {
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  label: string;
  /** Hours and minutes of the in-game day, 24 hour. A placeholder until the calendar ticket. */
  hhmm: string;
}

/** The HUD clock. The 48 minute cycle maps to 24 hours starting at dawn (05:00). */
export function clockView(tick: number): ClockView {
  const cycleMin = TIME.phases.reduce((n, p) => n + p.minutes, 0);
  const cycleTicks = cycleMin * TIME.ticksPerMinute;
  const t = (tick + TIME.startMinute * TIME.ticksPerMinute) % cycleTicks;
  const gameMin = Math.floor((t * 24 * 60) / cycleTicks) + 5 * 60;
  const h = Math.floor(gameMin / 60) % 24;
  const m = gameMin % 60;
  const phase = dayPhase(tick);
  return {
    phase,
    label: UI_STRINGS.clock[phase],
    hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}
