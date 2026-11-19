import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUEST_BALANCE as RB } from '../../src/content/balance/requests';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { renownIn } from '../../src/sim/renown';
import { passTrial } from '../../src/sim/skills';
import {
  createDemoState,
  deserializeState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { honestPlain, tamper } from '../support/saves';

type Sim = SimState;

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-16.json'), 'utf8'),
) as { plain: SavePlain };

const migrated = async (plain: SavePlain): Promise<SavePlain> =>
  migrate(await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(plain))));

describe('schema 16 to 17 migration (requests v2)', () => {
  it('moves each request to solutions and step progress, and keeps what was done', async () => {
    expect(fixture.plain.schema).toBe(16);
    const now = await migrated(fixture.plain);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const me = s.entities.comps.avatar.findIndex((a) => a);
    const j = s.entities.comps.journal[me]!;
    // Finished and paid: every step done under the first solution.
    expect(j.requests['request.clear_pests']).toEqual({
      state: 'done',
      solution: 'defeat',
      prog: { defeat: { step: 1, p: { n: 0, t0: 0 } } },
      progress: 4,
    });
    // Half way: the count carries into the step it was on.
    expect(j.requests['request.ember_pods']).toEqual({
      state: 'active',
      solution: null,
      prog: { defeat: { step: 0, p: { n: 1, t0: 0 } } },
      progress: 1,
    });
    // Renown as if counted all along: the finished request's worth, no trade, no pin.
    expect(j.renown).toEqual({ [RB.homeRegion]: 2 });
    expect(j.tradeCoin).toEqual({});
    expect(j.pinned).toBeNull();
    expect(s.rng.requests.s).toHaveLength(4);
    expect(s.entities.comps.board).toHaveLength(s.entities.comps.pos.length);
    expect(s.entities.comps.board.every((b) => b === null)).toBe(true);
    expect(s.ledger.requestRewards).toEqual({});
    expect(now.ledger.requestRewards).toEqual({});
    // Nothing else changed: the avatar, the coin and the skills are as they were.
    const was = deserializeState(fixture.plain.sim);
    // (Schema 20 gave the avatar an origin.)
    expect(s.entities.comps.avatar[me]).toEqual({
      ...was.entities.comps.avatar[me],
      origin: 'origin.unremembered',
    });
    expect(s.entities.comps.skills[me]!.points).toEqual(was.entities.comps.skills[me]!.points);
    expect(validateSave(now).reasons.filter((r) => r.code !== 'XP_IMPLAUSIBLE')).toEqual([]);
  });

  it('a ready request keeps its finished step, and the migrated save keeps playing', async () => {
    const raw = JSON.parse(fixture.plain.sim) as {
      entities: { comps: { journal: ({ requests: Record<string, unknown> } | null)[] } };
    };
    const me = raw.entities.comps.journal.findIndex((j) => j);
    raw.entities.comps.journal[me]!.requests['request.ember_pods'] = {
      state: 'ready',
      progress: 2,
    };
    const old = { ...fixture.plain, sim: serializeState(deserializeState(JSON.stringify(raw))) };
    const s = deserializeState((await migrated(old)).sim);
    expect(s.entities.comps.journal[me]!.requests['request.ember_pods']).toEqual({
      state: 'ready',
      solution: 'defeat',
      prog: { defeat: { step: 1, p: { n: 0, t0: 0 } } },
      progress: 2,
    });
  });
});

describe('Renown from Trials', () => {
  it('passing a Trial raises the home region by the amount in balance', () => {
    const s = createDemoState(3, 0);
    const me = createAvatar(s, feetAt(20, 20).x, feetAt(20, 20).y);
    expect(renownIn(s, me, RB.homeRegion)).toBe(0);
    expect(passTrial(s, me, 'trial.blades.15')).toBe(true);
    expect(renownIn(s, me, RB.homeRegion)).toBe(RB.renown.perTrial);
    // The same Trial cannot be passed twice for more.
    passTrial(s, me, 'trial.blades.15');
    expect(renownIn(s, me, RB.homeRegion)).toBe(RB.renown.perTrial);
  });
});

describe('integrity: standing requests and Renown', () => {
  const plain = honestPlain();
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
  const standing = {
    id: 'standing.board.square.0.0',
    giver: { board: 'board.square' },
    kind: 'standing' as const,
    region: RB.homeRegion,
    titleKey: 'request.standing.gather.title',
    askKey: 'request.standing.gather.ask',
    vars: { n: 5, what: 'Sunwort' },
    solutions: [
      {
        id: 'way',
        labelKey: 'request.standing.gather.way',
        steps: [{ kind: 'gather' as const, item: 'item.sunwort', count: 5 }],
      },
    ],
    reward: { coin: 12, items: [], renown: RB.renown.standing },
    estMinutes: 4,
  };

  /** A standing request finished and paid, through the same ledger calls the game makes. */
  const paid =
    (coin = 12, over: Record<string, unknown> = {}) =>
    (s: Sim, me: number): void => {
      s.entities.comps.journal[me]!.requests[standing.id] = {
        state: 'done',
        solution: 'way',
        prog: { way: { step: 1, p: { n: 0, t0: 0 } } },
        progress: 5,
        gen: { ...standing, reward: { ...standing.reward, coin } },
        ...over,
      } as never;
      s.entities.comps.journal[me]!.renown[RB.homeRegion] =
        (s.entities.comps.journal[me]!.renown[RB.homeRegion] ?? 0) + 1;
      s.ledger.requestRewards = { n: 1, coin };
      s.ledger.coinEarned.request = (s.ledger.coinEarned.request ?? 0) + coin;
      s.entities.comps.avatar[me]!.coin += coin;
    };

  it('an honest save, and a standing request paid as recorded, are clean', () => {
    expect(codes(plain)).toEqual([]);
    expect(codes(tamper(plain, paid()))).toEqual([]);
  });

  it('flags coin from standing requests that the board could not pay', () => {
    const edit = (s: Sim, me: number): void => {
      paid(12)(s, me);
      s.ledger.requestRewards = { n: 1, coin: 100_000 };
      s.ledger.coinEarned.request! += 100_000 - 12;
      s.entities.comps.avatar[me]!.coin += 100_000 - 12;
    };
    expect(codes(tamper(plain, edit))).toContain('REQUEST_REWARD_UNMATCHED');
  });

  it('flags more standing jobs paid than a board could have posted in the time', () => {
    expect(
      codes(
        tamper(plain, (s, me) => {
          paid(12)(s, me);
          s.ledger.requestRewards = { n: 5000, coin: 12 };
        }),
      ),
    ).toContain('REQUEST_REWARD_UNMATCHED');
  });

  it('flags items from requests that no reward pays, and items a standing request cannot pay', () => {
    expect(
      codes(
        tamper(plain, (s, me) => {
          s.ledger.itemsMade.request = { ...s.ledger.itemsMade.request, 'item.sword_iron': 1 };
          s.entities.comps.inventory[me]!.slots[10] = { item: 'item.sword_iron', qty: 1 };
        }),
      ),
    ).toContain('REQUEST_REWARD_UNMATCHED');
    expect(
      codes(
        tamper(plain, (s, me) => {
          paid(12)(s, me);
          s.ledger.requestRewards = { n: 1, coin: 12, 'item.sword_iron': 1 };
        }),
      ),
    ).toContain('REQUEST_REWARD_UNMATCHED');
  });

  it('flags a standing request that carries a reward the generator never makes', () => {
    const forged = (s: Sim, me: number): void => {
      paid(12)(s, me);
      const rec = s.entities.comps.journal[me]!.requests[standing.id]!;
      rec.gen = {
        ...rec.gen!,
        reward: { coin: 12, items: [{ item: 'item.sword_iron', qty: 1 }], renown: 1 },
      };
    };
    expect(codes(tamper(plain, forged))).toContain('REQUEST_STATE');
  });

  it('flags a request in a state it could not have reached', () => {
    const bad = (rec: Record<string, unknown>) => (s: Sim, me: number) => {
      const j = s.entities.comps.journal[me]!;
      j.requests['request.old_lamps'] = {
        state: 'active',
        solution: null,
        prog: { bring: { step: 0, p: { n: 0, t0: 0 } } },
        progress: 0,
        ...rec,
      } as never;
    };
    expect(codes(tamper(plain, bad({})))).toEqual([]);
    expect(codes(tamper(plain, bad({ state: 'ready' })))).toContain('REQUEST_STATE');
    expect(codes(tamper(plain, bad({ solution: 'bring' })))).toContain('REQUEST_STATE');
    expect(
      codes(tamper(plain, bad({ prog: { nope: { step: 0, p: { n: 0, t0: 0 } } } }))),
    ).toContain('REQUEST_STATE');
    expect(
      codes(tamper(plain, bad({ prog: { bring: { step: 9, p: { n: 0, t0: 0 } } } }))),
    ).toContain('REQUEST_STATE');
  });

  it('flags a request done by killing that was never killed for', () => {
    const edit = (s: Sim): void => {
      s.ledger.kills['creature.mossling'] = 3;
    };
    expect(codes(tamper(plain, edit))).toContain('REQUEST_STATE');
  });

  it('flags Renown that requests, Trials and trade could not have given', () => {
    const renown = (n: number) => (s: Sim, me: number) => {
      s.entities.comps.journal[me]!.renown[RB.homeRegion] = n;
    };
    // The honest save finished one request worth 2.
    expect(codes(tamper(plain, renown(2)))).toEqual([]);
    expect(codes(tamper(plain, renown(3)))).toContain('RENOWN_RANGE');
    expect(codes(tamper(plain, renown(RB.renown.max + 1)))).toContain('RENOWN_RANGE');
    expect(codes(tamper(plain, renown(-1)))).toContain('RENOWN_RANGE');
    expect(
      codes(tamper(plain, (s, me) => (s.entities.comps.journal[me]!.renown.nowhere = 1))),
    ).toContain('RENOWN_RANGE');
  });

  it('trade Renown counts toward what is allowed', () => {
    const edit = (s: Sim, me: number): void => {
      const j = s.entities.comps.journal[me]!;
      j.tradeCoin[RB.homeRegion] = 400;
      j.renown[RB.homeRegion] = 4;
    };
    expect(codes(tamper(plain, edit))).toEqual([]);
  });

  it('flags a pin on a request that is not held', () => {
    expect(
      codes(tamper(plain, (s, me) => (s.entities.comps.journal[me]!.pinned = 'request.nope'))),
    ).toContain('REQUEST_STATE');
  });
});
