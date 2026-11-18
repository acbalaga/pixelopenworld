import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { deserializeState, serializeState } from '../../src/sim/state';
import { honestPlain, tamper } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-11.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 11 to 12 migration', () => {
  it('turns a live Fed component into a Fed status with the same end tick and meal', async () => {
    expect(fixture.plain.schema).toBe(11);
    const before = JSON.parse(fixture.plain.sim) as {
      entities: { comps: { fed: ({ item: string; until: number } | null)[] } };
    };
    const me = before.entities.comps.fed.findIndex((f) => f);
    const fed = before.entities.comps.fed[me]!;
    expect(fed.item).toBe('item.hearty_stew');

    const now = migrate(
      await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(fixture.plain))),
    );
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    expect(s.entities.comps.statuses[me]).toEqual([
      { id: 'fed', until: fed.until, src: -1, item: 'item.hearty_stew' },
    ]);
    expect((s.entities.comps as unknown as Record<string, unknown>).fed).toBeUndefined();
    expect(s.entities.comps.cloud.every((c) => c === null)).toBe(true);
    // Every other unit has none, and what the save held is still there.
    expect(s.entities.comps.statuses.filter((x) => x)).toHaveLength(1);
    expect(s.entities.comps.skills[me]!.points['skill.blades']).toBe(2);
    // The pool maximum still carries the meal's bonus, now through mods.
    expect(s.entities.comps.pools[me]!.hpMax).toBe(
      (JSON.parse(fixture.plain.sim) as { entities: { comps: { pools: { hpMax: number }[] } } })
        .entities.comps.pools[me]!.hpMax,
    );
    expect(validateSave(now).reasons.filter((r) => r.code !== 'XP_IMPLAUSIBLE')).toEqual([]);
  });
});

describe('integrity: STATUS_UNKNOWN', () => {
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
  const plain = honestPlain();
  const withStatuses = (list: unknown[]) =>
    tamper(plain, (s, me) => {
      s.entities.comps.statuses[me] = list as never;
    });

  it('passes an honest save and a real status', () => {
    expect(codes(plain)).not.toContain('STATUS_UNKNOWN');
    expect(codes(withStatuses([{ id: 'wet', until: 3100, src: -1 }]))).not.toContain(
      'STATUS_UNKNOWN',
    );
  });
  it('flags an unknown status, a doubled one, a meal that is not food, and one that never ends', () => {
    expect(codes(withStatuses([{ id: 'status.nope', until: 3100, src: -1 }]))).toContain(
      'STATUS_UNKNOWN',
    );
    expect(
      codes(
        withStatuses([
          { id: 'wet', until: 3100, src: -1 },
          { id: 'wet', until: 3100, src: -1 },
        ]),
      ),
    ).toContain('STATUS_UNKNOWN');
    expect(
      codes(withStatuses([{ id: 'fed', until: 3100, src: -1, item: 'item.old_key' }])),
    ).toContain('STATUS_UNKNOWN');
    expect(codes(withStatuses([{ id: 'rested', until: 3000 + 10_000_000, src: -1 }]))).toContain(
      'STATUS_UNKNOWN',
    );
  });
  it('a state round trip keeps statuses exactly', () => {
    const s = deserializeState(withStatuses([{ id: 'wet', until: 3100, src: -1 }]).sim);
    expect(deserializeState(serializeState(s)).entities.comps.statuses).toEqual(
      s.entities.comps.statuses,
    );
  });
});
