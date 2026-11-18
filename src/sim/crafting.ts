import { CRAFTING as C } from '../content/balance/crafting';
import { SKILLS_BALANCE } from '../content/balance/skills';
import { ITEMS } from '../content/items';
import { STATIONS, type StationDef } from '../content/items/stations';
import { RECIPES, expand, recipeFor } from '../content/items/recipes';
import type { Quality, RecipeDef } from '../content/items/types';
import { getComp, query, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { int, type Rng } from './kernel/rng';
import { countItem, give, removeItem } from './items';
import { recordCraft } from './ledger';
import { pointsOf } from './skills';
import type { Inventory, SimState } from './state';
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

  // What the ingredients are worth, before they are used up.
  let matSum = 0;
  let matN = 0;
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u, (counts.get(u) ?? 0) + 1);
  for (const [item, n] of counts) {
    if (!ITEMS[item]?.quality) continue;
    for (const q of qualitiesOf(inv, item, n)) {
      matSum += q;
      matN++;
    }
  }
  for (const [item, n] of counts) removeItem(inv, item, n);

  const recipe = recipeFor(station.kind, units);
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

/** Ends the step when the last target is judged, or when the grace after it has run out. */
export function craftSystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'craft')) {
    const s = getComp(state.entities, who, 'craft');
    const station = s ? STATIONS[s.station] : undefined;
    if (!s || !station) continue;
    const targets = stepTargets(station.step);
    const last = targets[targets.length - 1] ?? 0;
    if (s.taps.length >= targets.length || state.tick - s.start > last + C.step.endGrace)
      finishCraft(state, who);
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
  const grade = gradeStep(station.step, s.taps);
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
  const material = C.repairMaterial[def.tier];
  if (!material || !removeItem(inv, material, 1)) return false;
  stack.dur = Math.min(max, (stack.dur ?? max) + Math.ceil((max * C.repairPct) / 100));
  emit(state.events, { type: 'repaired', id: who, item: stack.item, tier: def.tier });
  return true;
}

/** Every unit of a recipe, for the UI and tests. */
export function unitsOf(recipe: RecipeDef): string[] {
  return expand(recipe.ingredients);
}
