import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { deserializeState, serializeState } from '../../src/sim/state';
import { requestsSystem } from '../../src/sim/systems/requests';

/**
 * POW-M4-22A: a standing gather request taken before the change keeps its stored `gather` step
 * (no schema bump) and counts items, not gather actions, afterwards. The latest committed
 * fixture is schema 26, which migrates to the current schema; it holds no standing request, so
 * one is added to a copy.
 */
const f = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-26.json'), 'utf8'),
) as { plain: SavePlain };

const gen = {
  id: 'standing.board.square.0.0',
  giver: { board: 'board.square' },
  kind: 'standing' as const,
  region: 'dawnmeadow',
  titleKey: 'request.standing.gather.title',
  askKey: 'request.standing.gather.ask',
  vars: { n: 7, what: 'Sunwort' },
  solutions: [
    {
      id: 'way',
      labelKey: 'request.standing.gather.way',
      steps: [{ kind: 'gather' as const, item: 'item.sunwort', count: 7 }],
    },
  ],
  reward: { coin: 12, items: [], renown: 1 },
  estMinutes: 4,
};

describe('a stored standing gather request after the item-count change', () => {
  it('loads, passes integrity, and its progress rises by the qty of one gather', async () => {
    const withReq = deserializeState(f.plain.sim);
    const me0 = findAvatar(withReq)!;
    withReq.entities.comps.journal[me0]!.requests[gen.id] = {
      state: 'active',
      solution: null,
      prog: { way: { step: 0, p: { n: 0, t0: 0 } } },
      progress: 0,
      gen,
    };
    const plain: SavePlain = { ...f.plain, sim: serializeState(withReq) };
    const now = migrate(
      await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(plain))),
    );
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);

    const s = deserializeState(now.sim);
    const me = findAvatar(s)!;
    s.events.list.length = 0;
    s.events.list.push({
      type: 'gathered',
      id: me,
      tag: 'foraging',
      item: 'item.sunwort',
      tier: 1,
      qty: 3,
    });
    requestsSystem(s);
    const rec = s.entities.comps.journal[me]!.requests[gen.id]!;
    expect(rec.prog.way!.p.n).toBe(3);
    expect(rec.progress).toBe(3);
  });
});
