import { FARMING as F } from '../content/balance/farming';
import { TIME, type Weather } from '../content/balance/time';
import {
  CROPS,
  CROP_BY_SEED,
  CROP_LIST,
  type CropDef,
  type CropFamily,
} from '../content/farming/crops';
import { ITEMS } from '../content/items';
import type { Quality } from '../content/items/types';
import { rollQuality } from './crafting';
import { countItem, give, removeItem } from './items';
import { FIXTURES } from '../content/world/fixtures';
import { getComp, query, type EntityId } from './kernel/entities';
import { SUBPX, dirStep } from './kernel/fixed';
import { Solid } from './world/chunk';
import { emit } from './kernel/events';
import { next } from './kernel/rng';
import { spendCoin } from './ledger';
import { pointsOf } from './skills';
import type { SimState } from './state';
import type { Plot } from './farmState';

export { newFarm, newPlot, normalFarm, type FarmState, type Plot } from './farmState';
import { DAY_MINUTES, dayIndex, seasonOf, weatherOn } from './time';
import { hash01 } from './travelers/dice';

/**
 * Farming (POW-M6-02, design/05, design/13 section 2). Six leased plots in the reeve's field.
 * Till once, plant a seed, water, wait, harvest. Everything runs on the world clock, online or
 * offline, by one formula: `growthAt` integrates a plot's growth over any span of ticks, day by
 * day, so one long step and many short ones give the same total.
 *
 * A plot's growth is settled (added up to a tick) whenever something about it changes: a
 * watering, fertilizer, a lease payment, a harvest. Between those nothing changes the rate except
 * the calendar (season and weather), which `growthAt` reads day by day.
 *
 * Never destroys: a ripe crop waits forever, a crop out of season waits, a lapsed lease pauses
 * growth and keeps everything in place. Pure: no clock, no `Math.random`.
 */

export type FarmOp = 'till' | 'plant' | 'water' | 'fertilize' | 'harvest';

/** Ticks in one in-game day. */
export const DAY_TICKS = DAY_MINUTES * TIME.ticksPerMinute;
/** Ticks in one in-game week, the lease period. */
export const WEEK_TICKS = DAY_TICKS * F.lease.weekDays;
const TILE = 16;
/** How far ahead of the feet the context button reaches for a plot or the water, px. */
const AHEAD_PX = 16;
/** World tick at which day 0 begins (tick 0 is part way into day 0). */
const DAY0 = -TIME.startMinute * TIME.ticksPerMinute;

/** Units a crop needs from planting to ripe. */
export function needOf(c: CropDef): number {
  return c.days * DAY_TICKS * F.unitsPerTick;
}

/** Units per tick at full rate or dry, with or without fertilizer. Whole numbers. */
function rate(full: boolean, fert: boolean): number {
  const base = full ? F.unitsPerTick : F.unitsPerTick * F.dryRate;
  return Math.round(fert ? (base * (100 + F.fertBoost)) / 100 : base);
}

/**
 * Growth a plot's crop makes from `fromTick` to `toTick`, at the plot's watering, fertilizer and
 * lease as they stand. Day by day: a day out of the crop's seasons adds nothing, a rain or storm
 * day is full rate all day, and on other days the watered window is full rate and the rest dry.
 * Time past the lease adds nothing. Additive: growth over [a, c) is growth over [a, b) plus [b, c).
 */
export function growthAt(
  plot: Plot,
  fromTick: number,
  toTick: number,
  weatherOn: (tick: number) => Weather,
): number {
  const c = plot.crop ? CROPS[plot.crop] : undefined;
  const end = Math.min(toTick, plot.paidUntil);
  if (!c || end <= fromTick) return 0;
  const wetFrom = plot.watered;
  const wetTo = plot.watered < 0 ? -1 : plot.watered + plot.wetFor;
  const full = rate(true, plot.fert);
  const dry = rate(false, plot.fert);
  let total = 0;
  let a = fromTick;
  while (a < end) {
    const d = dayIndex(a);
    const b = Math.min(end, DAY0 + (d + 1) * DAY_TICKS);
    if (c.seasons.includes(seasonOf(a))) {
      if ((F.rainWeather as readonly Weather[]).includes(weatherOn(a))) total += full * (b - a);
      else {
        const w = Math.max(0, Math.min(b, wetTo) - Math.max(a, wetFrom));
        total += full * w + dry * (b - a - w);
      }
    }
    a = b;
  }
  return total;
}

const weatherFn =
  (state: SimState) =>
  (t: number): Weather =>
    weatherOn(state, t);

/** The units a plot's crop needs to be ripe now: the whole crop, or a regrowth after a harvest. */
function ripeAt(p: Plot): number {
  const c = p.crop ? CROPS[p.crop] : undefined;
  return c ? needOf(c) : 0;
}

/** Growth units as of `now`, without changing the plot. Capped at ripe. */
export function growthNow(state: SimState, p: Plot, now = state.worldTick): number {
  const need = ripeAt(p);
  return Math.min(need, p.growth + growthAt(p, p.at, Math.max(p.at, now), weatherFn(state)));
}

/** Adds the plot's growth up to `now` and moves its settled tick there. */
export function settle(state: SimState, p: Plot, now = state.worldTick): void {
  if (now <= p.at) return;
  p.growth = growthNow(state, p, now);
  p.at = now;
}

/** The stage 0 to 3 (seed, sprout, young, ripe), or -1 for no crop. */
export function stageOf(state: SimState, p: Plot): number {
  const need = ripeAt(p);
  if (!p.crop || need <= 0) return -1;
  const pct = (growthNow(state, p) * 100) / need;
  let s = 0;
  F.stages.forEach((t, i) => {
    if (pct >= t) s = i;
  });
  return s;
}

export function isRipe(state: SimState, p: Plot): boolean {
  return p.crop !== null && growthNow(state, p) >= ripeAt(p);
}

/** True while the lease covers the plot. */
export const leased = (state: SimState, p: Plot): boolean => state.worldTick < p.paidUntil;

/** True while the plot is watered now, by the can or by the day's rain. */
export function isWet(state: SimState, p: Plot): boolean {
  const now = state.worldTick;
  if ((F.rainWeather as readonly Weather[]).includes(weatherOn(state, now))) return true;
  return p.watered >= 0 && now >= p.watered && now < p.watered + p.wetFor;
}

/** Farming points the crop needs before it can be planted. */
export function pointsFor(c: CropDef): number {
  return c.minPoints ?? F.tierPoints[c.tier] ?? 0;
}

/** Whether a crop can be planted in this plot now: its season, its shade, the planter's Farming. */
export function canPlant(state: SimState, who: EntityId, plot: number, c: CropDef): boolean {
  if (!c.seasons.includes(seasonOf(state.worldTick))) return false;
  if (c.shade && !SHADED.includes(plot)) return false;
  return pointsOf(state, who, 'skill.farming') >= pointsFor(c);
}

/** The plots under the shade of the field's oak, where a glowcap bed grows. */
export const SHADED: readonly number[] = [5];

/** The squares of four plots a giant can grow in. Plots run two across, three down. */
export const SQUARES: readonly (readonly number[])[] = [
  [0, 1, 2, 3],
  [2, 3, 4, 5],
];

/** The plots of each square that no other square shares. */
const OWN: readonly (readonly number[])[] = SQUARES.map((sq, k) =>
  sq.filter((i) => !SQUARES.some((o, j) => j !== k && o.includes(i))),
);

const has = (state: SimState, who: EntityId, item: string): boolean => {
  const inv = getComp(state.entities, who, 'inventory');
  return !!inv && countItem(inv, item) > 0;
};

/** The crop a seed pod grows in this plot: a tier 1 or 2 crop in season, by a hash of the plot. */
export function podCrop(state: SimState, plot: number): CropDef | null {
  const season = seasonOf(state.worldTick);
  const pool = CROP_LIST.filter((c) => c.tier <= 2 && c.seasons.includes(season) && !c.shade);
  if (pool.length === 0) return null;
  const k = Math.floor(hash01(state.seed, plot, 6202, state.worldTick) * pool.length);
  return pool[k] ?? null;
}

const fail = (state: SimState, who: EntityId, plot: number, why: string): false => {
  emit(state.events, { type: 'farmRefused', who, plot, why });
  return false;
};

/** Breaks the ground of a leased plot with a hoe. Once per plot, ever. */
export function till(state: SimState, who: EntityId, i: number): boolean {
  const p = state.farm.plots[i];
  if (!p) return false;
  if (!leased(state, p)) return fail(state, who, i, 'lease');
  if (p.tilled) return false;
  if (!has(state, who, 'item.hoe')) return fail(state, who, i, 'hoe');
  p.tilled = true;
  p.emptySince = state.worldTick;
  p.at = state.worldTick;
  emit(state.events, { type: 'farmed', who, plot: i, op: 'till' });
  return true;
}

/** Plants the seed (or seed pod) in a bag slot. Whole fallow days raise the soil first. */
export function plant(state: SimState, who: EntityId, i: number, slot: number): boolean {
  const p = state.farm.plots[i];
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv?.slots[slot];
  if (!p || !inv || !stack) return false;
  if (!leased(state, p)) return fail(state, who, i, 'lease');
  if (!p.tilled || p.crop) return false;
  const pod = stack.item === 'item.seed_pod';
  const c = pod ? podCrop(state, i) : CROP_BY_SEED[stack.item];
  if (!c) return false;
  if (!canPlant(state, who, i, c)) return fail(state, who, i, 'cannot');
  if (!removeItem(inv, stack.item, 1)) return false;
  const now = state.worldTick;
  if (p.emptySince >= 0) {
    const fallow = Math.floor((now - p.emptySince) / DAY_TICKS);
    p.soil = Math.min(F.soilMax, p.soil + fallow);
  }
  p.crop = c.id;
  p.planted = now;
  p.growth = 0;
  p.at = now;
  p.fert = false;
  p.cuts = 0;
  p.emptySince = -1;
  delete p.giant;
  delete p.rolled;
  if (!state.farm.known.includes(c.id)) {
    state.farm.known.push(c.id);
    if (pod) emit(state.events, { type: 'seedLearned', who, crop: c.id });
  }
  emit(state.events, { type: 'farmed', who, plot: i, op: 'plant', crop: c.id });
  return true;
}

/** Waters a growing crop from the can. Lasts a day, longer with Green Thumb. */
export function water(state: SimState, who: EntityId, i: number): boolean {
  const p = state.farm.plots[i];
  if (!p || !p.crop) return false;
  if (!leased(state, p)) return fail(state, who, i, 'lease');
  if (!has(state, who, 'item.watering_can')) return fail(state, who, i, 'can');
  if (state.farm.water <= 0) return fail(state, who, i, 'empty');
  settle(state, p);
  const thumb = pointsOf(state, who, 'skill.farming') >= F.greenThumbAt;
  p.watered = state.worldTick;
  p.wetFor = Math.floor((F.waterDays * DAY_TICKS * (100 + (thumb ? F.greenThumbPct : 0))) / 100);
  state.farm.water--;
  emit(state.events, { type: 'farmed', who, plot: i, op: 'water' });
  return true;
}

/** Compost on an empty plot raises its soil by 1; on a growing crop it speeds it until harvest. */
export function fertilize(state: SimState, who: EntityId, i: number): boolean {
  const p = state.farm.plots[i];
  const inv = getComp(state.entities, who, 'inventory');
  if (!p || !inv || !p.tilled) return false;
  if (!leased(state, p)) return fail(state, who, i, 'lease');
  if (countItem(inv, 'item.compost') < 1) return fail(state, who, i, 'compost');
  if (p.crop) {
    if (p.fert || isRipe(state, p)) return false;
    settle(state, p);
    p.fert = true;
  } else {
    if (p.soil >= F.soilMax) return false;
    p.soil++;
  }
  removeItem(inv, 'item.compost', 1);
  emit(state.events, { type: 'farmed', who, plot: i, op: 'fertilize' });
  return true;
}

/** How many units a harvest gives: the base, plus the soil's share, the fraction rolled. */
function yieldOf(state: SimState, p: Plot, regrown: boolean): number {
  const base = regrown ? F.yieldRegrow : F.yieldBase;
  const x = base * (100 + (F.soilYieldPct[p.soil] ?? 0));
  const whole = Math.floor(x / 100);
  return whole + (next(state.rng.craft) * 100 < x % 100 ? 1 : 0);
}

/**
 * Rotation, once per planting (its first harvest): the same family again tires the soil, a
 * different one rests it.
 */
function rotate(p: Plot, family: CropFamily): void {
  if (p.cuts > 0) return;
  if (p.family === family) p.soil = Math.max(0, p.soil - 1);
  else if (p.family !== null) p.soil = Math.min(F.soilMax, p.soil + 1);
  p.family = family;
}

/** Empties a plot after its last harvest. The ground stays tilled. */
function clear(state: SimState, p: Plot): void {
  p.crop = null;
  p.growth = 0;
  p.at = state.worldTick;
  p.fert = false;
  p.cuts = 0;
  p.emptySince = state.worldTick;
  delete p.giant;
  delete p.rolled;
}

/**
 * Harvests a ripe crop. A giant gives `giant.qty` at Masterwork for its whole square. A regrowing
 * crop stays and fruits again; anything else leaves the plot empty and tilled. A lapsed lease does
 * not stop a harvest: the crop is the player's.
 */
export function harvest(state: SimState, who: EntityId, i: number): boolean {
  const p = state.farm.plots[i];
  const c = p?.crop ? CROPS[p.crop] : undefined;
  if (!p || !c || !isRipe(state, p)) return false;
  // A giant is checked before anything is taken, so harvesting at once after a long absence
  // finds the same giant the tick-by-tick check would have.
  if (c.giant && !p.rolled) checkGiants(state, who);
  settle(state, p);
  const l = state.ledger;
  l.harvests = (l.harvests ?? 0) + 1;
  if (p.giant !== undefined) {
    const square = SQUARES[p.giant] ?? [];
    give(state, who, c.result, F.giant.qty, 'harvest', { q: F.giant.quality });
    const mw = l.masterworks;
    mw[c.result] = (mw[c.result] ?? 0) + F.giant.qty;
    for (const k of square) {
      const q = state.farm.plots[k];
      if (!q) continue;
      rotate(q, c.family);
      clear(state, q);
    }
    emit(state.events, {
      type: 'harvested',
      who,
      plot: i,
      crop: c.id,
      item: c.result,
      qty: F.giant.qty,
      quality: F.giant.quality,
      tier: c.tier,
      giant: true,
    });
    return true;
  }
  const qty = yieldOf(state, p, p.cuts > 0);
  const quality: Quality = ITEMS[c.result]?.quality
    ? rollQuality(state.rng.craft, {
        skillPts: pointsOf(state, who, 'skill.farming'),
        tier: c.tier,
        matSum: 0,
        matN: 0,
        grade: F.soilQualityStep[p.soil] ?? 0,
        source: 'routine',
      })
    : 0;
  give(state, who, c.result, qty, 'harvest', quality ? { q: quality } : {});
  rotate(p, c.family);
  if (c.regrowDays) {
    p.growth = needOf(c) - c.regrowDays * DAY_TICKS * F.unitsPerTick;
    p.at = state.worldTick;
    p.fert = false;
    p.cuts++;
  } else clear(state, p);
  emit(state.events, {
    type: 'harvested',
    who,
    plot: i,
    crop: c.id,
    item: c.result,
    qty,
    quality,
    tier: c.tier,
  });
  return true;
}

/** Leases the first `plots` plots for `weeks` more weeks each, from now or from when each runs out. */
export function lease(state: SimState, who: EntityId, plots: number, weeks: number): boolean {
  const a = getComp(state.entities, who, 'avatar');
  if (!a || !Number.isInteger(plots) || !Number.isInteger(weeks)) return false;
  if (plots < 1 || plots > F.plots || weeks < 1 || weeks > F.lease.maxWeeks) return false;
  const cost = plots * weeks * F.lease.weekly;
  if (a.coin < cost) return false;
  spendCoin(state, who, cost, 'lease');
  for (let i = 0; i < plots; i++) {
    const p = state.farm.plots[i];
    if (!p) continue;
    // Growth up to the old end counts; the gap of a lapsed lease does not.
    settle(state, p);
    if (p.paidUntil < state.worldTick) p.at = state.worldTick;
    p.paidUntil = Math.max(p.paidUntil, state.worldTick) + weeks * WEEK_TICKS;
  }
  emit(state.events, { type: 'leased', who, plots, weeks, coin: cost });
  return true;
}

/** Fills the can at the well or the river. */
export function refill(state: SimState, who: EntityId): boolean {
  if (!has(state, who, 'item.watering_can') || state.farm.water >= F.canCharges) return false;
  state.farm.water = F.canCharges;
  emit(state.events, { type: 'canFilled', who });
  return true;
}

/** A farm command from the plot sheet. */
export function farmCommand(
  state: SimState,
  who: EntityId,
  c: { op: FarmOp; plot: number; slot?: number },
): boolean {
  switch (c.op) {
    case 'till':
      return till(state, who, c.plot);
    case 'plant':
      return c.slot !== undefined && plant(state, who, c.plot, c.slot);
    case 'water':
      return water(state, who, c.plot);
    case 'fertilize':
      return fertilize(state, who, c.plot);
    case 'harvest':
      return harvest(state, who, c.plot);
  }
}

/**
 * The context button on a plot: harvests a ripe crop, tills a leased plot with a hoe, waters a dry
 * growing crop. Anything else opens the plot sheet.
 */
export function usePlot(state: SimState, who: EntityId, i: number): void {
  const p = state.farm.plots[i];
  if (!p) return;
  if (isRipe(state, p) && harvest(state, who, i)) return;
  if (leased(state, p)) {
    if (!p.tilled && has(state, who, 'item.hoe') && till(state, who, i)) return;
    if (
      p.crop &&
      !isWet(state, p) &&
      state.farm.water > 0 &&
      has(state, who, 'item.watering_can') &&
      water(state, who, i)
    )
      return;
  }
  emit(state.events, { type: 'plotOpened', who, plot: i });
}

/** The plot (2 x 3 tiles from its fixture's top left tile) holding tile (tx, ty), or -1. */
export function plotAtTile(state: SimState, tx: number, ty: number): number {
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    if (def?.type !== 'plot' || def.plot === undefined) continue;
    const p = getComp(state.entities, id, 'pos')!;
    const x0 = Math.floor(p.x / SUBPX / TILE);
    const y0 = Math.floor(p.y / SUBPX / TILE) - 1;
    if (tx >= x0 && tx < x0 + 2 && ty >= y0 && ty < y0 + 3) return def.plot;
  }
  return -1;
}

/** The tile just ahead of the avatar's feet. */
function tileAhead(state: SimState, who: EntityId): { tx: number; ty: number } | null {
  const a = getComp(state.entities, who, 'avatar');
  const p = getComp(state.entities, who, 'pos');
  if (!a || !p) return null;
  const f = dirStep(a.facing);
  return {
    tx: Math.floor((p.x / SUBPX + f.x * AHEAD_PX) / TILE),
    ty: Math.floor((p.y / SUBPX - 1 + f.y * AHEAD_PX) / TILE),
  };
}

/**
 * The context button with nothing else in front: works the plot underfoot or ahead, or fills the
 * can at the water ahead (the river, the well). True if it did something.
 */
export function interactField(state: SimState, who: EntityId): boolean {
  if (getComp(state.entities, who, 'fighter')?.state !== 'idle') return false;
  const t = tileAhead(state, who);
  if (!t) return false;
  const i = plotAtTile(state, t.tx, t.ty);
  if (i >= 0) {
    usePlot(state, who, i);
    return true;
  }
  if (state.world?.solidAt(t.tx, t.ty) === Solid.Water) return refill(state, who);
  return false;
}

/**
 * The giant check (13 section 2.2): when the four plants of a square are the same giant crop, all
 * ripe, all at soil 3, it runs once. The roll is a hash of the save and the plantings, so it comes
 * out the same whenever it runs.
 */
export function checkGiants(state: SimState, who: EntityId): void {
  const plots = state.farm.plots;
  SQUARES.forEach((sq, k) => {
    const ps = sq.map((i) => plots[i]);
    if (ps.some((p) => !p || !p.crop || p.giant !== undefined)) return;
    // The squares share their middle plots, so a square has rolled when its own plots have: a
    // failed roll of one square leaves the other its own chance.
    if (OWN[k]!.some((i) => plots[i]?.rolled)) return;
    const crop = ps[0]?.crop;
    const c = crop ? CROPS[crop] : undefined;
    if (!c?.giant || ps.some((p) => p!.crop !== crop || p!.soil < F.soilMax)) return;
    if (ps.some((p) => !isRipe(state, p!))) return;
    const pct =
      pointsOf(state, who, 'skill.farming') >= F.giant.highAt
        ? F.giant.chanceHighPct
        : F.giant.chancePct;
    const n = ps.reduce((a, p) => (a * 31 + (p!.planted | 0)) | 0, k + 1);
    const hit = hash01(state.seed, k, 6203, n) * 100 < pct;
    for (const p of ps) {
      p!.rolled = true;
      if (hit) p!.giant = k;
    }
    if (hit) emit(state.events, { type: 'giantGrew', who, crop: c.id, square: k });
  });
}

/** Once a second: the giant check. Growth itself needs no tick: it is settled when read. */
export function farmSystem(state: SimState): void {
  if (state.tick % 30 !== 0) return;
  const who = query(state.entities, 'avatar')[0];
  if (who === undefined) return;
  checkGiants(state, who);
}
