import { describe, expect, it } from 'vitest';
import { REQUESTS } from '../../src/content/requests';
import { RECIPES } from '../../src/content/items/recipes';
import { TRIALS } from '../../src/content/skills';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { createDemoState } from '../../src/sim/state';
import { finished, knownRecipes, underWay } from '../../src/ui/menu/journalModel';

function world() {
  const s = createDemoState(5, 0);
  const me = createAvatar(s, feetAt(20, 20).x, feetAt(20, 20).y);
  return { s, me, j: s.entities.comps.journal[me]!, inv: s.entities.comps.inventory[me]! };
}

const rec = (state: 'active' | 'ready' | 'done', doneDay?: number) =>
  ({
    state,
    solution: null,
    prog: {},
    progress: 0,
    ...(doneDay !== undefined ? { doneDay } : {}),
  }) as never;

const ids = Object.keys(REQUESTS);

describe('the Chronicle journal model', () => {
  it('under way lists active and ready requests, not finished ones', () => {
    const { s, me, j } = world();
    j.requests[ids[0]!] = rec('active');
    j.requests[ids[1]!] = rec('ready');
    j.requests[ids[2]!] = rec('done', 3);
    const u = underWay(s, me);
    expect(u.requests.map((r) => r.id).sort()).toEqual([ids[0], ids[1]].sort());
    expect(u.requests[0]!.state).toBe('ready');
  });

  it('finished requests run newest first, then by title; a request done twice is listed once', () => {
    const { s, me, j } = world();
    j.requests[ids[0]!] = rec('done', 2);
    j.requests[ids[1]!] = rec('done', 9);
    j.requests[ids[2]!] = rec('done', 5);
    const f = finished(s, me).requests;
    expect(f.map((r) => r.key)).toEqual([ids[1], ids[2], ids[0]]);
    // A repeatable request taken and done again is still one record, so one row.
    j.requests[ids[1]!] = rec('done', 12);
    const again = finished(s, me).requests;
    expect(again.filter((r) => r.key === ids[1])).toHaveLength(1);
    expect(again[0]!.key).toBe(ids[1]);
  });

  it('passed Trials sort by skill name then rank, and a key with no Trial is skipped', () => {
    const { s, me } = world();
    const sk = s.entities.comps.skills[me]!;
    const ts = Object.values(TRIALS).slice(0, 3);
    sk.passed = [...ts.map((t) => `${t.skill}@${t.threshold}`), 'skill.nothing@15'];
    const f = finished(s, me).trials;
    expect(f).toHaveLength(ts.length);
    expect(f.every((r) => r.title.endsWith('Trial'))).toBe(true);
    expect(f.every((r) => /^Rank \d+/.test(r.state))).toBe(true);
    const titles = f.map((r) => r.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it('known recipes group by craft in the fixed order and never list an unknown one', () => {
    const { s, me, inv } = world();
    const all = Object.values(RECIPES);
    const pick = (c: string) => all.find((r) => r.craft === c && r.result)!;
    const cook = pick('cooking');
    const alch = pick('alchemy');
    inv.recipes = [alch.id, cook.id];
    const g = knownRecipes(s, me);
    expect(g.map((x) => x.craft)).toEqual(['cooking', 'alchemy']);
    const names = g.flatMap((x) => x.rows.map((r) => r.id));
    expect(names).toEqual([cook.id, alch.id]);
    // One that is not known never appears.
    const other = all.find((r) => r.craft === 'cooking' && r.id !== cook.id)!;
    expect(names).not.toContain(other.id);
    expect(g[0]!.rows[0]!.ingredients).toMatch(/^\d+ \S/);
    inv.recipes = [];
    expect(knownRecipes(s, me)).toEqual([]);
  });
});
