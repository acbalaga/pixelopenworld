import { SKILLS_BALANCE as SB } from '../../content/balance/skills';
import { TIME } from '../../content/balance/time';
import { ITEMS } from '../../content/items';
import { RECIPES } from '../../content/items/recipes';
import { STATUS_BALANCE } from '../../content/balance/status';
import { STATUSES, type StatusId } from '../../content/combat/statuses';
import {
  EQUIP_SLOTS,
  type BagFilter,
  type EquipSlot,
  type ItemDef,
} from '../../content/items/types';
import { SKILLS, TRIALS, trialCount, type SkillFamily } from '../../content/skills';
import { ITEM_STRINGS } from '../../content/strings/items';
import { UI_STRINGS } from '../../content/strings/ui';
import { PATH_LIST } from '../../content/paths';
import { PATH_STRINGS } from '../../content/strings/paths';
import { anyRequirementMet } from '../../sim/systems/deeds';
import { TECHNIQUE_LIST, type TechniqueDef } from '../../content/combat/techniques';
import { TECHNIQUE_STRINGS } from '../../content/strings/techniques';
import { knows } from '../../sim/combat/techniques';
import { fill, TRIAL_STRINGS } from '../../content/strings/skills';
import { NPCS } from '../../content/dialogue';
import { AFFIXES, parseAffix } from '../../content/items/affixes';
import { feedTarget } from '../../sim/creatureFeed';
import { gearStats, isBroken } from '../../sim/items';
import { statusesOf, visibleStatuses } from '../../sim/statuses';
import { isAwake, masteryName, pendingTrial, trialPassed, xpToNext } from '../../sim/skills';
import { calendarOf, dayPhase, weatherOn } from '../../sim/time';
import { canSleepOutdoors } from '../../sim/systems/fixtures';
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

export interface PathRowView {
  id: string;
  name: string;
  /** The gift line for an earned Path. Empty for a hint. */
  gift: string;
  /** For a Path not earned yet: the line that points at it, with no numbers. */
  hint: string;
  earned: boolean;
  worn: boolean;
  shown: boolean;
}

export interface CharacterView {
  pools: PoolView[];
  gear: GearSlotView[];
  coin: number;
  /** Earned Paths first, then hints for standard Paths that have begun. Hidden ones only once earned. */
  paths: PathRowView[];
  /** Both loadouts: the technique names in slots 2 to 4 (null for empty), and which is in use. */
  loadouts: LoadoutView[];
}

export interface LoadoutView {
  n: number;
  active: boolean;
  slots: (string | null)[];
}

/**
 * The Paths section. An earned Path shows its gift and whether it is worn. A standard Path not
 * earned shows only its hint, and only once one of its requirements is met. A hidden Path shows
 * nothing at all until it is earned.
 */
export function pathsView(state: SimState, who: number): PathRowView[] {
  const p = state.entities.comps.paths[who];
  if (!p) return [];
  const earned: PathRowView[] = [];
  const hints: PathRowView[] = [];
  for (const def of PATH_LIST) {
    const name = PATH_STRINGS[def.nameKey] ?? def.id;
    if (p.earned.includes(def.id))
      earned.push({
        id: def.id,
        name,
        gift: PATH_STRINGS[def.giftKey] ?? '',
        hint: '',
        earned: true,
        worn: p.worn.includes(def.id),
        shown: p.shown === def.id,
      });
    else if (!def.hidden && anyRequirementMet(state, who, def))
      hints.push({
        id: def.id,
        name,
        gift: '',
        hint: PATH_STRINGS[def.hintKey] ?? '',
        earned: false,
        worn: false,
        shown: false,
      });
  }
  return [...earned, ...hints];
}

export interface SkillRowView {
  id: string;
  name: string;
  points: number;
  mastery: string;
  /** Progress to the next point, 0 to 100. */
  progressPct: number;
  /** XP toward the next point and what it costs, or null at the top rank. */
  xp: { have: number; cost: number } | null;
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

export type ItemAction = 'use' | 'equip' | 'quick' | 'feed' | 'drop' | 'trash';

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
  /** The label for the Use action: Eat for food, Read for scrolls and manuals, Use otherwise. */
  useLabel: string;
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
  const ld = state.entities.comps.loadouts[who];
  const fighter = state.entities.comps.fighter[who];
  const nameOfTech = (id: string | null | undefined): string | null => {
    const t = id ? TECHNIQUE_LIST.find((x) => x.id === id) : undefined;
    return t ? (TECHNIQUE_STRINGS[t.nameKey] ?? t.id) : null;
  };
  const loadouts: LoadoutView[] = ld
    ? ([0, 1] as const).map((i) => ({
        n: i + 1,
        active: ld.active === i,
        // The fighter's own slots are the active set's.
        slots: [1, 2, 3].map((k) =>
          nameOfTech(ld.active === i ? fighter?.slots[k] : ld.sets[i].slots[k]),
        ),
      }))
    : [];
  return { pools, gear, coin: a?.coin ?? 0, paths: pathsView(state, who), loadouts };
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
      // A dormant skill shows nowhere. It awakens on its first XP, a manual or a lesson.
      if (!s || !isAwake(s, id)) continue;
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
        xp: cost === 0 ? null : { have: Math.min(xp, cost), cost },
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

/** What a technique that is not known yet is waiting on, as a line to show. */
export function sourceState(t: TechniqueDef, insight: number, points: number): string {
  const skill = SKILLS[t.skill]?.name ?? '';
  if (points < t.band) return fill(UI_STRINGS.techNeedSkill, { skill, n: t.band });
  switch (t.source) {
    case 'insight':
      return fill(UI_STRINGS.techInsight, { n: insight, count: SB.insight[t.id] ?? 0 });
    case 'taught':
      return UI_STRINGS.techTaught;
    case 'manual':
      return UI_STRINGS.techManual;
    case 'trial':
      return fill(UI_STRINGS.techTrial, { n: t.band });
    default:
      return UI_STRINGS.techInnate;
  }
}

export interface TechniqueRowView {
  id: string;
  name: string;
  desc: string;
  icon: string;
  kind: 'active' | 'passive';
  known: boolean;
  /** For a technique not known yet: what it takes. */
  need: string | null;
  /** The slot (1 to 3, the second to fourth button) it sits in now, or 0 for none. */
  slot: number;
}

export interface TechniqueGroupView {
  skill: string;
  name: string;
  rows: TechniqueRowView[];
}

export interface TechniquesView {
  /** The loadout in use, 1 or 2, and what each slot button holds (technique ids). */
  active: number;
  slots: (string | null)[];
  groups: TechniqueGroupView[];
}

/**
 * Every technique of the skills the avatar has ranked, and every one it knows, grouped by skill.
 * A known active can be put in slot 2, 3 or 4 of the active loadout.
 */
export function techniquesView(state: SimState, who: number): TechniquesView {
  const s = state.entities.comps.skills[who];
  const f = state.entities.comps.fighter[who];
  const ld = state.entities.comps.loadouts[who];
  const groups: TechniqueGroupView[] = [];
  for (const id of Object.keys(SKILLS)) {
    const rows: TechniqueRowView[] = [];
    for (const t of TECHNIQUE_LIST) {
      if (t.skill !== id) continue;
      const known = s !== undefined && s !== null ? knows(state, who, t) : false;
      const points = s?.points[id] ?? 0;
      // Only awake skills show, with every technique they will give and where it comes from.
      if (!s || !isAwake(s, id)) continue;
      let need: string | null = null;
      if (!known) need = sourceState(t, s.insight[t.id] ?? 0, points);
      rows.push({
        id: t.id,
        name: TECHNIQUE_STRINGS[t.nameKey] ?? t.id,
        desc: TECHNIQUE_STRINGS[t.descKey] ?? '',
        icon: t.icon,
        kind: t.kind,
        known,
        need,
        slot: f
          ? Math.max(
              0,
              f.slots.findIndex((x, i) => i > 0 && x === t.id),
            )
          : 0,
      });
    }
    if (rows.length > 0) groups.push({ skill: id, name: SKILLS[id]?.name ?? id, rows });
  }
  return { active: (ld?.active ?? 0) + 1, slots: f ? [...f.slots] : [], groups };
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
  if (
    def.food ||
    def.teaches ||
    def.manual ||
    def.bagSlots ||
    (def.gadget && def.gadget !== 'lantern')
  )
    out.push('use');
  if (def.equip) out.push('equip');
  // Food and gadgets can be pinned to the quick slot (G4 playtest).
  if (!def.junk && (def.food || (def.gadget && def.gadget !== 'lantern'))) out.push('quick');
  // Junk is thrown away for good; everything else is dropped where it can be picked up again.
  out.push(def.junk ? 'trash' : 'drop');
  return out;
}

/** The verb on the Use button for this item. */
export function useLabel(def: ItemDef): string {
  if (def.food) return UI_STRINGS.useVerb.eat;
  if (def.teaches || def.manual) return UI_STRINGS.useVerb.read;
  return UI_STRINGS.useVerb.use;
}

/** A sheet has three actions at most (design/09). Feed, when offered, outranks the quick pin. */
function atMostThree(actions: ItemAction[]): ItemAction[] {
  return actions.length > 3 ? actions.filter((a) => a !== 'quick') : actions;
}

/** Puts Feed before Drop in an item's actions when a creature in reach would take it. */
function withFeed(actions: ItemAction[], can: boolean): ItemAction[] {
  if (!can) return actions;
  const i = actions.indexOf('drop');
  return [
    ...actions.slice(0, i < 0 ? actions.length : i),
    'feed',
    ...actions.slice(i < 0 ? actions.length : i),
  ];
}

/** Health in points, Stamina and Focus stored in tenths: the player sees whole points. */
const pts = (pool: 'hp' | 'sta' | 'foc', n: number): number =>
  pool === 'hp' ? n : Math.round(n / 10);

/** What eating, drinking or using the item does, read from its data so the sheet never drifts from the rules. */
function effectLines(def: ItemDef): string[] {
  const out: string[] = [];
  const names = UI_STRINGS.detailPools;
  const f = def.food;
  if (f) {
    const gain = (['hp', 'sta', 'foc'] as const)
      .filter((p) => f[p] > 0)
      .map((p) => `${pts(p, f[p])} ${names[p]}`);
    if (gain.length > 0) out.push(fill(UI_STRINGS.detailRestores, { list: gain.join(', ') }));
    if (f.fed) {
      const max = (
        [
          ['hp', f.fed.hpMax],
          ['sta', f.fed.staMax],
          ['foc', f.fed.focMax],
        ] as const
      )
        .filter(([, n]) => n > 0)
        .map(([p, n]) => `+${pts(p, n)} max ${names[p]}`);
      out.push(
        fill(UI_STRINGS.detailFed, {
          min: Math.max(1, Math.round(f.fed.ticks / TIME.ticksPerMinute)),
          list: max.join(', '),
        }),
      );
    }
  }
  if (def.bagSlots) out.push(fill(UI_STRINGS.detailBag, { n: def.bagSlots }));
  const st = def.status;
  if (st?.clear?.length)
    out.push(
      fill(UI_STRINGS.detailCures, {
        list: st.clear.map((c) => UI_STRINGS.statusNames[c as StatusId] ?? c).join(', '),
      }),
    );
  if (st?.apply)
    out.push(
      fill(UI_STRINGS.detailGives, {
        status: UI_STRINGS.statusNames[st.apply.status as StatusId] ?? st.apply.status,
        sec: Math.round(st.apply.ticks / 30),
      }),
    );
  return out;
}

/** Most recipe names the "Used in" line lists before it says "and n more". */
const USED_IN_MAX = 4;

/**
 * Where the item fits in crafting, from the recipes the player already knows. Recipes still to be
 * found by experiment are never shown, so this does not give the discovery away.
 */
function craftLines(state: SimState, who: number, def: ItemDef): string[] {
  const known = state.entities.comps.inventory[who]?.recipes ?? [];
  const recipes = Object.values(RECIPES).filter((r) => !r.enchant && known.includes(r.id));
  const out: string[] = [];
  const made = recipes.find((r) => r.result === def.id);
  if (made)
    out.push(
      fill(UI_STRINGS.detailMadeAt, {
        station: UI_STRINGS.craft.title[made.station] ?? made.station,
        ingredients: made.ingredients.map((i) => `${i.qty} ${itemName(i.item)}`).join(', '),
      }),
    );
  const uses = [
    ...new Set(
      recipes.filter((r) => r.ingredients.some((i) => i.item === def.id)).map((r) => r.result),
    ),
  ].map((id) => itemName(id));
  if (uses.length > 0) {
    const shown = uses.slice(0, USED_IN_MAX);
    const more = uses.length - shown.length;
    out.push(
      fill(UI_STRINGS.detailUsedIn, {
        list:
          more > 0
            ? `${shown.join(', ')}, ${fill(UI_STRINGS.detailMore, { n: more })}`
            : shown.join(', '),
      }),
    );
  }
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
        list: s.affixes
          .map((a) => ITEM_STRINGS[AFFIXES[parseAffix(a).id]?.nameKey ?? ''] ?? a)
          .join(', '),
      }),
    );
  lines.push(...effectLines(def), ...craftLines(state, who, def));
  if (def.junk) lines.push(UI_STRINGS.detailJunk);
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
    // Feed is offered while a creature in front would take it, so it comes and goes as one walks.
    actions: atMostThree(withFeed(itemActions(def), feedTarget(state, who, s.item) !== null)),
    useLabel: useLabel(def),
    lines,
    broken,
  };
}

/** The status icons under the pool bars. Each has a shape and a name, never color alone. */
export function statusIcons(state: SimState, who: number): StatusIconView[] {
  const out: StatusIconView[] = [];
  for (const st of visibleStatuses(statusesOf(state, who))) {
    const def = STATUSES[st.id as StatusId];
    if (!def) continue;
    const isFed = st.id === 'fed' && st.item !== undefined;
    out.push({
      id: st.id,
      icon: isFed ? (ITEMS[st.item as string]?.icon ?? def.iconKey) : def.iconKey,
      label: isFed
        ? fill(UI_STRINGS.statusFed, { item: itemName(st.item as string) })
        : UI_STRINGS.statusNames[st.id as StatusId],
      ticksLeft: Math.max(0, st.until - state.tick),
    });
  }
  if (state.entities.comps.avatar[who]?.winded && out.length < STATUS_BALANCE.maxShown)
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

/**
 * Whether the Character tab offers to bed down where the avatar stands: out in the open, between
 * dusk and dawn, with no bed near and nothing fighting it (M4-20). The same rest a bedroll gives
 * is not on offer, only the ground.
 */
export function canRestOutdoors(state: SimState, who: number): boolean {
  const phase = dayPhase(state.worldTick);
  return (phase === 'dusk' || phase === 'night') && canSleepOutdoors(state, who);
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

/** The calendar as System shows it: today's date and hour, today's weather, and the days ahead. */
export interface CalendarView {
  date: string;
  time: string;
  today: string;
  ahead: string[];
}

/** How many days ahead the calendar lists. */
export const FORECAST_DAYS = 6;

/** Builds the calendar for the world clock `state.worldTick`. Pure. */
export function calendarView(state: SimState): CalendarView {
  const C = UI_STRINGS.calendar;
  const cal = calendarOf(state.worldTick);
  const clock = clockView(state.worldTick);
  const dayTicks = TIME.phases.reduce((n, p) => n + p.minutes, 0) * TIME.ticksPerMinute;
  const ahead: string[] = [];
  for (let i = 1; i <= FORECAST_DAYS; i++) {
    const at = state.worldTick + i * dayTicks;
    const c = calendarOf(at);
    ahead.push(`${C.seasons[c.season]} ${c.day}: ${C.weather[weatherOn(state, at)]}`);
  }
  return {
    date: C.date
      .replace('{year}', String(cal.year))
      .replace('{season}', C.seasons[cal.season])
      .replace('{day}', String(cal.day)),
    time: C.time.replace('{phase}', clock.label).replace('{hhmm}', clock.hhmm),
    today: C.today.replace('{weather}', C.weather[weatherOn(state, state.worldTick)]),
    ahead,
  };
}
