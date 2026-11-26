import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLD_OVEN_FLAGS, SINGULARS } from '../../src/content/singulars';
import { DIALOGUES } from '../../src/content/dialogue';
import { SINGULAR_TEXT, WORLD_FIRST_LINE } from '../../src/content/strings/singulars';
import { DIALOGUE_STRINGS as STRINGS_DLG } from '../../src/content/strings/dialogue';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, deserializeState, hashState } from '../../src/sim/state';
import { chronicleLines, singularBanner } from '../../src/ui/menu/singularModel';

const IDS = Object.keys(SINGULARS);

function fresh() {
  const s = createDemoState(2, 0);
  const f = feetAt(10, 10);
  return { s, me: createAvatar(s, f.x, f.y) };
}

/** Every event the banner could be asked about, for every Singular. */
const asked = (me: number): SimEvent[] =>
  IDS.flatMap((id) => [
    ...SINGULARS[id]!.steps.map((_s, step): SimEvent => ({
      type: 'singularStep',
      who: me,
      id,
      step,
    })),
    { type: 'singularStep', who: me, id, step: 0 } as SimEvent,
    { type: 'singularDone', who: me, id } as SimEvent,
    { type: 'worldFirst', who: me, id } as SimEvent,
  ]);

describe('Singular text', () => {
  it('has text for every step of every Singular', () => {
    for (const id of IDS) {
      const t = SINGULAR_TEXT[id]!;
      expect(t.steps, id).toHaveLength(SINGULARS[id]!.steps.length);
      for (const line of [...t.steps, t.done, t.chronicle]) {
        expect(line.length).toBeGreaterThan(10);
        expect(line.includes('—') || line.includes('–'), line).toBe(false);
      }
    }
  });

  it('gives nothing before the trigger has fired, whatever event is asked about', () => {
    const { s, me } = fresh();
    for (const e of asked(me)) expect(singularBanner(s, me, e), JSON.stringify(e)).toBeNull();
    expect(chronicleLines(s, me)).toEqual([]);
    // A Singular touched but not fired (counting toward its trigger) is still silent.
    s.entities.comps.journal[me]!.singulars['singular.crows_due'] = {
      step: -1,
      counters: { trigger: ['1'] },
      startedDay: 0,
      done: false,
    };
    for (const e of asked(me)) expect(singularBanner(s, me, e)).toBeNull();
  });

  it('gives a banner per step once it has fired, and the Chronicle line once done', () => {
    const { s, me } = fresh();
    const j = s.entities.comps.journal[me]!;
    const id = 'singular.cold_oven';
    j.singulars[id] = { step: 1, counters: {}, startedDay: 0, done: false };
    const t = SINGULAR_TEXT[id]!;
    expect(singularBanner(s, me, { type: 'singularStep', who: me, id, step: 0 })).toBe(t.steps[0]);
    expect(singularBanner(s, me, { type: 'singularStep', who: me, id, step: 1 })).toBe(t.steps[1]);
    // A step not yet reached is not shown, even if an event names it.
    expect(singularBanner(s, me, { type: 'singularStep', who: me, id, step: 2 })).toBeNull();
    expect(singularBanner(s, me, { type: 'worldFirst', who: me, id })).toBeNull();
    expect(chronicleLines(s, me)).toEqual([]);
    j.singulars[id] = { step: 3, counters: {}, startedDay: 0, done: true, doneDay: 9 };
    expect(singularBanner(s, me, { type: 'worldFirst', who: me, id })).toBe(
      `${t.done} ${WORLD_FIRST_LINE}`,
    );
    expect(chronicleLines(s, me)).toEqual([t.chronicle]);
  });

  it('is imported by one module only, so no other UI path can reach it', () => {
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts') && /strings\/singulars['"]/.test(readFileSync(p, 'utf8')))
          hits.push(p);
      }
    };
    walk(join(__dirname, '..', '..', 'src'));
    expect(hits.map((h) => h.split('src/')[1])).toEqual(['ui/menu/singularModel.ts']);
  });

  it("keeps the Singular lines of dialogue behind the Singular's own flag", () => {
    const tobin = DIALOGUES['npc.smith']!;
    const bricks = Object.values(tobin.nodes)
      .flatMap((n) => n.choices ?? [])
      .filter((c) => c.text.startsWith('dlg.tobin.c_bricks'));
    expect(bricks.length).toBeGreaterThan(0);
    // Reaching the node needs the flag the Singular sets at its second step.
    const entry = Object.values(tobin.nodes)
      .flatMap((n) => n.choices ?? [])
      .find((c) => c.next === 'bricks')!;
    expect(entry.if).toContainEqual({ flag: COLD_OVEN_FLAGS.bricks });
    // The only node that leads into the brick lines is that choice.
    const into = Object.values(tobin.nodes)
      .flatMap((n) => [...(n.choices ?? []).map((c) => c.next), n.next])
      .filter((n) => n === 'bricks' || n === 'bricks_done');
    expect(into.sort()).toEqual(['bricks', 'bricks_done']);
    expect(STRINGS_DLG['dlg.tobin.bricks']).toBeDefined();
  });
});

describe('schema 25 to 26 migration (Singular progress)', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-25.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };

  it('loads the previous fixture with no Singular touched and nothing else changed', async () => {
    expect(f.plain.schema).toBe(25);
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const at26 = migrate(decoded, MIGRATIONS, 26);
    expect(at26.schema).toBe(26);
    const s = deserializeState(at26.sim);
    for (const j of s.entities.comps.journal) {
      if (!j) continue;
      expect(j.singulars).toEqual({});
      delete (j as { singulars?: unknown }).singulars;
    }
    delete (s as { travelers?: unknown }).travelers;
    delete (s as { mail?: unknown }).mail;
    expect(hashState(s)).toBe(f.expectedHash);
    const now = migrate(decoded);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons.map((r) => r.code)).not.toContain('SINGULAR_STATE');
  });
});

describe('integrity of Singular progress', () => {
  it('flags an unknown Singular, a step out of range, and done without the last step', async () => {
    const { plainFor } = await import('../support/saves');
    const codes = (
      edit: (
        j: ReturnType<typeof fresh>['s']['entities']['comps']['journal'][number] & object,
      ) => void,
    ): string[] => {
      const { s, me } = fresh();
      edit(s.entities.comps.journal[me]!);
      return validateSave(plainFor(s)).reasons.map((r) => r.code);
    };
    const ok = { step: 0, counters: {}, startedDay: 0, done: false };
    expect(codes((j) => (j.singulars['singular.crows_due'] = { ...ok }))).not.toContain(
      'SINGULAR_STATE',
    );
    expect(codes((j) => (j.singulars['singular.nope'] = { ...ok }))).toContain('SINGULAR_STATE');
    expect(codes((j) => (j.singulars['singular.crows_due'] = { ...ok, step: 9 }))).toContain(
      'SINGULAR_STATE',
    );
    expect(codes((j) => (j.singulars['singular.crows_due'] = { ...ok, done: true }))).toContain(
      'SINGULAR_STATE',
    );
  });

  it('flags a reward the Singular never gave', async () => {
    const { plainFor } = await import('../support/saves');
    const { give } = await import('../../src/sim/items');
    const { s, me } = fresh();
    give(s, me, 'item.crow_feather_charm', 1, 'singular');
    expect(validateSave(plainFor(s)).reasons.map((r) => r.code)).toContain(
      'SINGULAR_REWARD_UNEARNED',
    );
  });
});
