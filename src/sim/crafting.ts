import { CRAFTING as C } from '../content/balance/crafting';
import { SKILLS_BALANCE } from '../content/balance/skills';
import { ITEMS } from '../content/items';
import { AFFIXES, affixKey } from '../content/items/affixes';
import { STATIONS, type StationDef } from '../content/items/stations';
import { campMeal } from './cooking';
import { RECIPES, expand, recipeFor } from '../content/items/recipes';
import type { Quality, RecipeDef } from '../content/items/types';
import { getComp, query, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { int, type Rng } from './kernel/rng';
import { countItem, give, removeItem } from './items';
import { recordCraft } from './ledger';
import { pointsOf } from './skills';
import { activeMods, modAdd } from './mods';
import type { CraftSession, Inventory, SimState } from './state';
import { contextTarget } from './systems/interact';

/** Who is acting. Only `manual` can roll Masterwork (M3 rule 9). M7 adds `routine`. */
export type ActingSource = 'manual' | 'routine';

/** The station the avatar is facing, or null. */
export function stationOf(state: SimState, who: EntityId): StationDef | null {
  const target = contextTarget(state, who);
  if (target === null) return null;
  const kind = getComp(state.entities, target, 'interactable')?.kind;
  return kind ? (STATIONS[kind] ?? null) : null;
}

/** Targets of a station's step, in ticks since the craft began. */
export function stepTargets(step: StationDef['step']): readonly number[] {
  if (step === 'rhythm') return C.step.rhythm.targets;
  if (step === 'timing') return C.step.timing.targets;
  return [];
}

/**
 * Grades a manual step from the tap ticks (ticks since the craft began) to 0..`step.grade`. The
 * k-th tap is judged against the k-th target. The sim does this itself from `craftStep`
 * commands, so a client cannot hand over a grade.
 */
export function gradeStep(step: StationDef['step'], taps: readonly number[]): number {
  const cfg = step === 'rhythm' ? C.step.rhythm : step === 'timing' ? C.step.timing : null;
  if (!cfg) return 0;
  let sum = 0;
  cfg.targets.forEach((target, k) => {
    const tap = taps[k];
    if (tap === undefined) return;
    const d = Math.abs(tap - target);
    if (d <= cfg.perfect) sum += cfg.points.perfect;
    else if (d <= cfg.good) sum += cfg.points.good;
  });
  const max = cfg.targets.length * cfg.points.perfect;
  return Math.floor((sum * C.step.grade) / max);
}

type Point = readonly [number, number];

/** Distance from a point to a segment, and how far along the whole path (0 to 1) the nearest spot is. */
function nearOnPath(path: readonly Point[], x: number, y: number): { d: number; at: number } {
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(
      (path[i] as Point)[0] - (path[i - 1] as Point)[0],
      (path[i] as Point)[1] - (path[i - 1] as Point)[1],
    );
    lens.push(l);
    total += l;
  }
  let best = { d: Infinity, at: 0 };
  let run = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as Point;
    const b = path[i] as Point;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
    const d = Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
    if (d < best.d) best = { d, at: (run + t * (lens[i - 1] as number)) / (total || 1) };
    run += lens[i - 1] as number;
  }
  return best;
}

/**
 * Grades a trace from the pointer samples (flat x, y pairs, one per tick the pointer was down) to
 * 0..`step.grade`: the share of samples inside the path width, scaled by how much of the path
 * they reached and by having enough samples to have followed it at all.
 */
export function gradeTrace(path: readonly Point[], samples: readonly number[]): number {
  const cfg = C.step.trace;
  const n = Math.floor(samples.length / 2);
  if (n === 0 || path.length < 2) return 0;
  let inside = 0;
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const r = nearOnPath(path, samples[i * 2] as number, samples[i * 2 + 1] as number);
    if (r.d > cfg.width) continue;
    inside++;
    lo = Math.min(lo, r.at);
    hi = Math.max(hi, r.at);
  }
  const share = inside / n;
  const coverage = Math.min(1, (hi - lo) / (cfg.minCoverage / 100));
  const enough = Math.min(1, n / cfg.minSamples);
  return Math.floor(C.step.grade * share * coverage * enough);
}

/** The heat (0 to 1000) after the pointer has been held for `ticks`. */
export function heatAfter(ticks: number): number {
  return Math.min(1000, Math.max(0, ticks) * C.step.hold.perTick);
}

/**
 * Grades a hold to 0..`step.grade` by how far the heat at release is from the band center: full
 * within `perfect`, falling to `goodPoints` percent at `good`, nothing past it. No release is 0.
 */
export function gradeHold(heldTicks: number | null): number {
  const cfg = C.step.hold;
  if (heldTicks === null) return 0;
  const d = Math.abs(heatAfter(heldTicks) - cfg.center);
  if (d <= cfg.perfect) return C.step.grade;
  if (d >= cfg.good) return 0;
  const floor = (C.step.grade * cfg.goodPoints) / 100;
  const t = (d - cfg.perfect) / (cfg.good - cfg.perfect);
  return Math.floor(C.step.grade - (C.step.grade - floor) * t);
}

/**
 * The quality of a craft. `score = clamp(skillPts - parRank[tier], -15, 15) * 2 + materialAvg *
 * 10 + grade + roll(0..39)`. `matSum` and `matN` are the summed quality and the count of the
 * ingredient units that carry quality, kept whole so the average is exact. A `routine` source
 * never gets Masterwork: it stops at Superior.
 */
export function rollQuality(
  rng: Rng,
  o: {
    skillPts: number;
    tier: number;
    matSum: number;
    matN: number;
    grade: number;
    source: ActingSource;
  },
): Quality {
  const par = SKILLS_BALANCE.challenge.parRank[Math.min(Math.max(o.tier, 1), 8)] ?? 0;
  const gap = Math.min(C.score.parClamp, Math.max(-C.score.parClamp, o.skillPts - par));
  const material = o.matN > 0 ? Math.floor((o.matSum * C.score.perMaterial) / o.matN) : 0;
  const score = gap * C.score.perPoint + material + o.grade + int(rng, 0, C.score.rollMax);
  if (score >= C.thresholds.masterwork) return o.source === 'manual' ? 3 : 2;
  if (score >= C.thresholds.superior) return 2;
  if (score >= C.thresholds.fine) return 1;
  return 0;
}

/** The grade of a whole session, whatever its step. */
export function gradeSession(
  station: StationDef,
  s: { taps: readonly number[]; samples?: readonly number[]; holdFrom?: number; holdTo?: number },
): number {
  if (station.step === 'trace') return gradeTrace(C.paths[station.craft] ?? [], s.samples ?? []);
  if (station.step === 'hold')
    return gradeHold(
      s.holdFrom === undefined || s.holdTo === undefined ? null : s.holdTo - s.holdFrom,
    );
  return gradeStep(station.step, s.taps);
}

/** Qualities of the `n` units of `item` a craft would take: lowest quality first, as removal does. */
function qualitiesOf(inv: Inventory, item: string, n: number): number[] {
  const stacks = inv.slots
    .map((s, i) => ({ s, i }))
    .filter((e) => e.s && e.s.item === item)
    .sort((a, b) => (a.s!.q ?? 0) - (b.s!.q ?? 0) || a.s!.qty - b.s!.qty || a.i - b.i);
  const out: number[] = [];
  for (const { s } of stacks)
    for (let k = 0; k < s!.qty && out.length < n; k++) out.push(s!.q ?? 0);
  return out;
}

/** True if the bag holds every unit. */
function holds(inv: Inventory, units: readonly string[]): boolean {
  const need = new Map<string, number>();
  for (const u of units) need.set(u, (need.get(u) ?? 0) + 1);
  for (const [i, n] of need) if (countItem(inv, i) < n) return false;
  return true;
}

/** A craft is under way: nothing else may start until it ends. */
export function crafting(state: SimState, who: EntityId): boolean {
  return !!getComp(state.entities, who, 'craft');
}

/**
 * Starts a craft at the station in front of `who` from up to four ingredient units. The
 * ingredients are taken now. No recipe at this station is a failed craft: the craft's fail item.
 * A recipe starts the manual step (`skipStep` runs it with no taps, for bots and tests). Returns
 * false, taking nothing, if there is no station, the bag is short or the list is not 1 to 4 units.
 */
export function startCraft(
  state: SimState,
  who: EntityId,
  units: readonly string[],
  o: { source?: ActingSource; skipStep?: boolean } = {},
): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const station = stationOf(state, who);
  if (!inv || !station || crafting(state, who)) return false;
  if (getComp(state.entities, who, 'fighter')?.state !== 'idle') return false;
  if (units.length < 1 || units.length > C.maxIngredients || !holds(inv, units)) return false;

  // Enchanting: one of the units is the piece to enchant. It stays in the bag, and the rest are the recipe.
  let target = -1;
  let rest: readonly string[] = units;
  if (station.craft === 'enchanting') {
    target = enchantTarget(state, who, units);
    if (target < 0) return false;
    const piece = (inv.slots[target] as { item: string }).item;
    const at = units.indexOf(piece);
    rest = units.filter((_, i) => i !== at);
  }

  // What the ingredients are worth, before they are used up.
  let matSum = 0;
  let matN = 0;
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u, (counts.get(u) ?? 0) + 1);
  if (target >= 0) {
    const piece = (inv.slots[target] as { item: string }).item;
    counts.set(piece, (counts.get(piece) ?? 1) - 1);
  }
  for (const [item, n] of counts) {
    if (n <= 0 || !ITEMS[item]?.quality) continue;
    for (const q of qualitiesOf(inv, item, n)) {
      matSum += q;
      matN++;
    }
  }
  for (const [item, n] of counts) if (n > 0) removeItem(inv, item, n);

  const recipe = recipeFor(station.kind, rest);
  if (!recipe) {
    const fail = C.failItem[station.craft];
    if (fail) give(state, who, fail, 1, 'craft');
    emit(state.events, { type: 'craftFailed', id: who });
    return true;
  }
  state.entities.comps.craft[who] = {
    station: station.kind,
    recipe: recipe.id,
    start: state.tick,
    taps: [],
    matSum,
    matN,
    source: o.source ?? 'manual',
    ...(target >= 0 ? { target } : {}),
  };
  emit(state.events, { type: 'craftStarted', id: who, station: station.kind, recipe: recipe.id });
  if (o.skipStep) finishCraft(state, who);
  return true;
}

/** A tap of the manual step. Counted once per target and never before the step began. */
export function tapStep(state: SimState, who: EntityId): void {
  const s = getComp(state.entities, who, 'craft');
  const station = s ? STATIONS[s.station] : undefined;
  if (!s || !station) return;
  if (s.taps.length >= stepTargets(station.step).length) return;
  s.taps.push(state.tick - s.start);
  emit(state.events, { type: 'craftTap', id: who, n: s.taps.length });
}

/** One pointer sample of a trace, in the 1000 by 1000 space. One per tick, only while the step runs. */
export function tracePoint(state: SimState, who: EntityId, x: number, y: number): void {
  const s = getComp(state.entities, who, 'craft');
  const station = s ? STATIONS[s.station] : undefined;
  if (!s || station?.step !== 'trace') return;
  const since = state.tick - s.start;
  const samples = (s.samples ??= []);
  // One sample a tick, never before the step began or after its window.
  if (since < 0 || since > C.step.trace.window || samples.length / 2 > since) return;
  samples.push(
    Math.min(1000, Math.max(0, Math.round(x))),
    Math.min(1000, Math.max(0, Math.round(y))),
  );
}

/** The pointer goes down or up on a hold step. The first press and the first release count. */
export function holdStep(state: SimState, who: EntityId, on: boolean): void {
  const s = getComp(state.entities, who, 'craft');
  const station = s ? STATIONS[s.station] : undefined;
  if (!s || station?.step !== 'hold') return;
  const since = state.tick - s.start;
  if (on && s.holdFrom === undefined) s.holdFrom = since;
  else if (!on && s.holdFrom !== undefined && s.holdTo === undefined) s.holdTo = since;
}

/** The bag slot of the piece to enchant among `units`: gear with a free affix slot, or -1. */
export function enchantTarget(state: SimState, who: EntityId, units: readonly string[]): number {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv) return -1;
  const room = enchantRoom(state, who);
  for (const u of new Set(units)) {
    const def = ITEMS[u];
    if (!def?.affixSlots) continue;
    const i = inv.slots.findIndex(
      (s) =>
        s && s.item === u && (s.affixes?.length ?? 0) < Math.min(def.affixSlots as number, room),
    );
    if (i >= 0) return i;
  }
  return -1;
}

/** How many affixes Enchanting lets a piece carry: one at the start, two at 15 points. */
export function enchantRoom(state: SimState, who: EntityId): number {
  const pts = pointsOf(state, who, 'skill.enchanting');
  let n = 0;
  for (const [band, slots] of Object.entries(C.enchantSlots))
    if (pts >= Number(band)) n = Math.max(n, slots);
  return n;
}

/** The ticks since the step began at which a step is over, whatever the player did. */
function stepEnd(step: StationDef['step']): number {
  if (step === 'trace') return C.step.trace.window;
  if (step === 'hold') return C.step.hold.window;
  const t = stepTargets(step);
  return (t[t.length - 1] ?? 0) + C.step.endGrace;
}

/** Ends the step when the last target is judged, or when the grace after it has run out. */
export function craftSystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'craft')) {
    const s = getComp(state.entities, who, 'craft');
    const station = s ? STATIONS[s.station] : undefined;
    if (!s || !station) continue;
    const since = state.tick - s.start;
    if (station.step === 'hold') {
      // Held at the top too long: released for you. Released: over.
      const held = s.holdFrom === undefined ? null : since - s.holdFrom;
      if (
        held !== null &&
        s.holdTo === undefined &&
        heatAfter(held) >= 1000 &&
        held > 1000 / C.step.hold.perTick + C.step.hold.overGrace
      )
        s.holdTo = since;
      if (s.holdTo !== undefined || since > stepEnd('hold')) finishCraft(state, who);
      continue;
    }
    if (station.step === 'trace') {
      if (since > stepEnd('trace')) finishCraft(state, who);
      continue;
    }
    const targets = stepTargets(station.step);
    if (s.taps.length >= targets.length || since > stepEnd(station.step)) finishCraft(state, who);
  }
}

/** Pays the result of a finished step: quality, maker's mark, ledger, events. */
export function finishCraft(state: SimState, who: EntityId): void {
  const s = getComp(state.entities, who, 'craft');
  const recipe: RecipeDef | undefined = s?.recipe ? RECIPES[s.recipe] : undefined;
  const station = s ? STATIONS[s.station] : undefined;
  state.entities.comps.craft[who] = null;
  const inv = getComp(state.entities, who, 'inventory');
  if (!s || !recipe || !station || !inv) return;
  const grade = gradeSession(station, s);
  if (recipe.enchant) return finishEnchant(state, who, s, recipe, station, grade);
  const def = ITEMS[recipe.result];
  const q: Quality = def?.quality
    ? rollQuality(state.rng.craft, {
        skillPts: pointsOf(state, who, `skill.${recipe.craft}`),
        tier: recipe.tier,
        matSum: s.matSum,
        matN: s.matN,
        grade,
        source: s.source,
      })
    : 0;
  // Crafted gear and tools carry the maker's mark.
  const marked =
    def?.category === 'weapon' || def?.category === 'armor' || def?.category === 'tool';
  if (!inv.recipes.includes(recipe.id)) {
    inv.recipes.push(recipe.id);
    emit(state.events, { type: 'recipeDiscovered', id: who, recipe: recipe.id });
  }
  // Gear never stacks, so each piece is made and given on its own.
  const per = def && def.stack === 1 ? 1 : recipe.qty;
  for (let made = 0; made < recipe.qty; made += per)
    give(state, who, recipe.result, per, 'craft', {
      ...(q ? { q } : {}),
      ...(marked ? { mark: 1 as const } : {}),
    });
  recordCraft(state, recipe.id);
  if (q === 3) {
    const l = state.ledger.masterworks;
    l[recipe.result] = (l[recipe.result] ?? 0) + recipe.qty;
  }
  if (marked) {
    const l = state.ledger.marked;
    l[recipe.result] = (l[recipe.result] ?? 0) + recipe.qty;
  }
  // A dish cooked at the camp pot while in a party feeds the party (M6-04).
  if (station.kind === 'camp_pot' && recipe.craft === 'cooking')
    campMeal(state, who, recipe.result);
  emit(state.events, {
    type: 'crafted',
    id: who,
    tag: recipe.craft,
    recipe: recipe.id,
    tier: recipe.tier,
    item: recipe.result,
    qty: recipe.qty,
    quality: q,
    source: s.source,
  });
}

/**
 * Self-repair at the anvil: one material of the item's tier, and `repairPct` of its maximum
 * durability back. Smithing is paid on `repair`.
 */
export function repair(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const station = stationOf(state, who);
  const stack = inv?.slots[slot];
  const def = stack ? ITEMS[stack.item] : undefined;
  if (!inv || !stack || !def?.durability || station?.craft !== 'smithing') return false;
  if (getComp(state.entities, who, 'fighter')?.state !== 'idle' || crafting(state, who))
    return false;
  const max = def.durability;
  if ((stack.dur ?? max) >= max) return false;
  // Anvil Hand: the anvil takes no material.
  const free = modAdd(activeMods(state, who), 'repairMaterialFree') > 0;
  const material = C.repairMaterial[def.tier];
  if (!free && (!material || !removeItem(inv, material, 1))) return false;
  stack.dur = Math.min(max, (stack.dur ?? max) + Math.ceil((max * C.repairPct) / 100));
  emit(state.events, { type: 'repaired', id: who, item: stack.item, tier: def.tier });
  return true;
}

/** Every unit of a recipe, for the UI and tests. */
export function unitsOf(recipe: RecipeDef): string[] {
  return expand(recipe.ingredients);
}

/** Pays an enchant: the affix goes on the chosen piece, its strength rolled by the quality rule. */
function finishEnchant(
  state: SimState,
  who: EntityId,
  s: CraftSession,
  recipe: RecipeDef,
  station: StationDef,
  grade: number,
): void {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv && s.target !== undefined ? inv.slots[s.target] : null;
  const affix = recipe.enchant ? AFFIXES[recipe.enchant] : undefined;
  if (!inv || !stack || !affix) return void emit(state.events, { type: 'craftFailed', id: who });
  const def = ITEMS[stack.item];
  const slot = def?.equip?.slot;
  const room = Math.min(def?.affixSlots ?? 0, enchantRoom(state, who));
  // The piece must still fit the affix and have room: if not, the materials are lost.
  if (!slot || !affix.slots.includes(slot) || (stack.affixes?.length ?? 0) >= room)
    return void emit(state.events, { type: 'craftFailed', id: who });
  const q = rollQuality(state.rng.craft, {
    skillPts: pointsOf(state, who, 'skill.enchanting'),
    tier: recipe.tier,
    matSum: s.matSum,
    matN: s.matN,
    grade,
    source: s.source,
  });
  stack.affixes = [...(stack.affixes ?? []), affixKey(affix.id, q)];
  recordCraft(state, recipe.id);
  emit(state.events, {
    type: 'crafted',
    id: who,
    tag: recipe.craft,
    recipe: recipe.id,
    tier: recipe.tier,
    item: stack.item,
    qty: 1,
    quality: q,
    source: s.source,
  });
  void station;
}
