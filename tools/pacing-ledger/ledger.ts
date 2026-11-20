/**
 * The pacing ledger's arithmetic (POW-M4-12). It reads the `estMinutes` of every authored piece of
 * content that has one, files it under a category and a region, and holds each region against the
 * budget in `content/balance/pacing.ts`. Pure: it takes the content as arguments so tests can
 * hand it small sets.
 */
import {
  HOME_REGION,
  PACING_BUDGETS,
  PACING_ORDER,
  WAYSTONE_MINUTES,
  type PacingCategory,
} from '../../src/content/balance/pacing';
import { POIS } from '../../src/content/pois';
import { ROAMERS } from '../../src/content/creatures/roamers';
import { REQUESTS } from '../../src/content/requests';
import { THREADS } from '../../src/content/requests/threads';
import { TRIALS } from '../../src/content/skills';
import { SINGULARS } from '../../src/content/singulars';
import { DUNGEONS } from '../../src/content/world/dungeons';
import { WAYSTONES } from '../../src/content/world/waystones';

/** An estimate is a whole number of minutes above zero. */
export const validMinutes = (m: unknown): m is number =>
  typeof m === 'number' && Number.isInteger(m) && m > 0;

/** One authored piece of content, as the ledger sees it. */
export interface LedgerItem {
  id: string;
  region: string;
  category: PacingCategory;
  minutes: number;
}

/** Everything the ledger counts, from the shipped content. */
export function collectItems(): { items: LedgerItem[]; problems: string[] } {
  const items: LedgerItem[] = [];
  const problems: string[] = [];
  const add = (id: string, region: string, category: PacingCategory, minutes: unknown): void => {
    if (!validMinutes(minutes)) {
      problems.push(
        `${id}: estMinutes must be a whole number of minutes above 0 (got ${String(minutes)})`,
      );
      return;
    }
    items.push({ id, region, category, minutes });
  };

  // A Thread stage is counted in its Thread, not here.
  for (const r of Object.values(REQUESTS))
    if (r.kind === 'authored' && !r.thread) add(r.id, r.region, 'requests', r.estMinutes);
  for (const t of THREADS) add(t.id, HOME_REGION, 'threads', t.estMinutes);
  // Rank 15 Trials. They carry no region: the first map's are Dawnmeadow's.
  for (const t of Object.values(TRIALS))
    if (t.threshold === 15) add(t.id, HOME_REGION, 'trials15', t.estMinutes);
  for (const s of Object.values(SINGULARS)) add(s.id, s.region, 'singulars', s.estMinutes);
  // Dungeons with a region (the sample used by the framework tests has none).
  for (const d of Object.values(DUNGEONS))
    if (d.region) add(d.id, d.region, d.mini ? 'miniDungeons' : 'dungeons', d.estMinutes);
  for (const p of Object.values(POIS)) add(p.id, p.region, 'pois', p.estMinutes);
  for (const r of Object.values(ROAMERS)) add(r.creature, r.region, 'extras', r.estMinutes);
  for (const [region, stones] of Object.entries(WAYSTONES))
    for (const w of stones) add(`waystone.${region}.${w.id}`, region, 'extras', WAYSTONE_MINUTES);
  return { items, problems };
}

/** What a region has, by category, against its budget. */
export interface RegionLedger {
  region: string;
  rows: {
    category: PacingCategory;
    count: number;
    minutes: number;
    budgetCount: number;
    budgetMinutes: number;
  }[];
  minutes: number;
  budgetMinutes: number;
}

/** Sums items by region and category. A region with no budget is not held to one. */
export function sum(items: readonly LedgerItem[]): RegionLedger[] {
  const out: RegionLedger[] = [];
  for (const [region, budget] of Object.entries(PACING_BUDGETS)) {
    const mine = items.filter((i) => i.region === region);
    const rows = PACING_ORDER.map((category) => {
      const of = mine.filter((i) => i.category === category);
      return {
        category,
        count: of.length,
        minutes: of.reduce((n, i) => n + i.minutes, 0),
        budgetCount: budget[category].count,
        budgetMinutes: budget[category].minutes,
      };
    });
    out.push({
      region,
      rows,
      minutes: rows.reduce((n, r) => n + r.minutes, 0),
      budgetMinutes: rows.reduce((n, r) => n + r.budgetMinutes, 0),
    });
  }
  return out;
}

/** The committed floor: a region's minutes may not fall below it, and the budget is enforced once switched on. */
export interface Floor {
  [region: string]: { minutes: number; enforceBudget: boolean };
}

/**
 * The CI check. A region fails if it is under its floor (content was lost or an estimate cut), or,
 * with `enforceBudget` on, under its budget in total or in any category.
 */
export function check(ledgers: readonly RegionLedger[], floor: Floor): string[] {
  const bad: string[] = [];
  for (const l of ledgers) {
    const f = floor[l.region];
    if (!f) {
      bad.push(`${l.region}: no entry in tools/pacing-floor.json`);
      continue;
    }
    if (l.minutes < f.minutes)
      bad.push(
        `${l.region}: ${l.minutes} authored minutes, under its floor of ${f.minutes}. Content or an estimate was removed.`,
      );
    if (f.enforceBudget) {
      if (l.minutes < l.budgetMinutes)
        bad.push(
          `${l.region}: ${l.minutes} authored minutes, under its budget of ${l.budgetMinutes}`,
        );
      for (const r of l.rows)
        if (r.minutes < r.budgetMinutes)
          bad.push(
            `${l.region}: ${r.category} is ${r.minutes} minutes, under its budget of ${r.budgetMinutes}`,
          );
    }
  }
  return bad;
}
