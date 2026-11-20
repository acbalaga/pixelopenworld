import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PACING_BUDGETS, PACING_ORDER } from '../../src/content/balance/pacing';
import {
  check,
  collectItems,
  sum,
  validMinutes,
  type Floor,
  type LedgerItem,
} from '../../tools/pacing-ledger/ledger';

const item = (
  id: string,
  category: LedgerItem['category'],
  minutes: number,
  region = 'dawnmeadow',
): LedgerItem => ({
  id,
  region,
  category,
  minutes,
});

describe('the pacing ledger (M4-12)', () => {
  it('sums minutes and counts by category, for the regions that have a budget', () => {
    const [d] = sum([
      item('a', 'requests', 8),
      item('b', 'requests', 12),
      item('c', 'singulars', 30),
      item('x', 'requests', 99, 'whisperwood'),
    ]);
    expect(d!.region).toBe('dawnmeadow');
    const row = (c: string) => d!.rows.find((r) => r.category === c)!;
    expect(row('requests')).toMatchObject({
      count: 2,
      minutes: 20,
      budgetMinutes: 260,
      budgetCount: 25,
    });
    expect(row('singulars').minutes).toBe(30);
    expect(d!.minutes).toBe(50);
    // Dawnmeadow's budget is the 1,193 minutes of regions/01 section 14.
    expect(d!.budgetMinutes).toBe(1193);
    expect(d!.rows.map((r) => r.category)).toEqual([...PACING_ORDER]);
  });

  it('passes a region at or over its floor and fails one under it', () => {
    const l = sum([item('a', 'requests', 100)]);
    const floor = (minutes: number, enforceBudget = false): Floor => ({
      dawnmeadow: { minutes, enforceBudget },
    });
    expect(check(l, floor(100))).toEqual([]);
    expect(check(l, floor(101)).join()).toMatch(/under its floor of 101/);
    expect(check(l, {}).join()).toMatch(/no entry/);
  });

  it('holds the budget once enforced, in total and in each category', () => {
    const budget = PACING_BUDGETS['dawnmeadow']!;
    const full: LedgerItem[] = Object.entries(budget).map(([c, b]) =>
      item(`c.${c}`, c as LedgerItem['category'], b.minutes),
    );
    const floor: Floor = { dawnmeadow: { minutes: 0, enforceBudget: true } };
    expect(check(sum(full), floor)).toEqual([]);
    // One category short, though the others are over.
    const short = full.map((i) => (i.category === 'pois' ? { ...i, minutes: i.minutes - 1 } : i));
    short.push(item('extra', 'requests', 500));
    const bad = check(sum(short), floor).join('\n');
    expect(bad).toMatch(/pois is 119 minutes, under its budget of 120/);
    expect(bad).not.toMatch(/under its budget of 1193/);
    // Short in total.
    expect(check(sum([item('a', 'requests', 5)]), floor).join()).toMatch(
      /under its budget of 1193/,
    );
  });

  it('the shipped content has a valid estimate on every piece, and Dawnmeadow is at its floor', () => {
    const { items, problems } = collectItems();
    expect(problems).toEqual([]);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    // The kinds this slice counts are all present.
    const cats = new Set(items.map((i) => i.category));
    for (const c of ['requests', 'trials15', 'singulars', 'dungeons', 'extras'] as const)
      expect(cats.has(c), c).toBe(true);
    const floor = JSON.parse(readFileSync('tools/pacing-floor.json', 'utf8')) as Floor;
    expect(check(sum(items), floor)).toEqual([]);
  });

  it('rejects an estimate that is missing, zero, negative or fractional', () => {
    for (const m of [0, -3, 2.5, Number.NaN, Infinity, '8', null, undefined])
      expect(validMinutes(m), String(m)).toBe(false);
    for (const m of [1, 8, 45]) expect(validMinutes(m), String(m)).toBe(true);
  });
});
