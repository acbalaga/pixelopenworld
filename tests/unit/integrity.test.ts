import { describe, expect, it } from 'vitest';
import { REQUESTS } from '../../src/content/dialogue';
import { SKILLS_BALANCE } from '../../src/content/balance/skills';
import { validateSave } from '../../src/save/integrity';
import {
  COUNT_SLACK,
  KILLS_PER_SECOND_MAX,
  PLAY_SLACK_SECONDS,
  CHEST_COIN_TOTAL,
  COIN_HARD_CAP,
  COOK_EVENTS_PER_SECOND,
  saleCeiling,
  xpCeiling,
} from '../../src/save/integrity/bounds';
import { intact, mergeTrust, type ReasonCode } from '../../src/save/integrity/reasons';
import { stackSize } from '../../src/sim/items';
import { xpToNext } from '../../src/sim/skills';
import { honestPlain, T0, tamper } from '../support/saves';

const codes = (p: ReturnType<typeof honestPlain>): ReasonCode[] => [
  ...new Set(validateSave(p).reasons.map((r) => r.code)),
];

/** A save passes at the bound and flags just past it, with the given code. */
function edge(
  name: string,
  code: ReasonCode,
  edit: (v: number, s: Parameters<Parameters<typeof tamper>[1]>[0], me: number) => void,
  boundary: number,
): void {
  it(`${name}: ${boundary} passes, ${boundary + 1} flags ${code}`, () => {
    const ok = tamper(honestPlain(), (s, me) => edit(boundary, s, me));
    expect(codes(ok), 'at the bound').not.toContain(code);
    const bad = tamper(honestPlain(), (s, me) => edit(boundary + 1, s, me));
    expect(codes(bad), 'one past').toContain(code);
  });
}

describe('an honest save', () => {
  it('passes every layer', () => {
    const r = validateSave(honestPlain());
    expect(r.reasons).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe('hand edits are flagged', () => {
  it('coin plus one million, with the ledger left alone', () => {
    const p = tamper(honestPlain(), (s, me) => {
      s.entities.comps.avatar[me]!.coin += 1_000_000;
    });
    expect(codes(p)).toContain('COIN_RECONCILE');
  });

  it('coin plus one million, with the ledger edited to match', () => {
    const p = tamper(honestPlain(), (s, me) => {
      s.entities.comps.avatar[me]!.coin += 1_000_000;
      s.ledger.coinEarned.loot = (s.ledger.coinEarned.loot ?? 0) + 1_000_000;
    });
    expect(codes(p)).toContain('COIN_IMPLAUSIBLE');
  });

  it('a skill set to 100 points', () => {
    const p = tamper(honestPlain(), (s, me) => {
      s.entities.comps.skills[me]!.points['skill.blades'] = 100;
    });
    expect(codes(p)).toEqual(
      expect.arrayContaining(['XP_EXCEEDS_EARNED', 'TRIAL_UNPASSED', 'POOL_MAX_MISMATCH']),
    );
  });

  it('a skill set to 100 points with Trials, pools and XP earned all edited to match', () => {
    const p = tamper(honestPlain(), (s, me) => {
      const sk = s.entities.comps.skills[me]!;
      sk.points['skill.blades'] = 100;
      for (const t of SKILLS_BALANCE.thresholds) sk.passed.push(`skill.blades@${t}`);
      let total = 0;
      for (let i = 0; i < 100; i++) total += xpToNext(i);
      s.ledger.xpEarned['skill.blades'] = total;
      const pools = s.entities.comps.pools[me]!;
      pools.hpMax += 100;
      pools.hp = pools.hpMax;
    });
    expect(codes(p)).toContain('XP_IMPLAUSIBLE');
  });

  it('a boss drop with no boss kill', () => {
    const p = tamper(honestPlain(), (s, me) => {
      s.entities.comps.inventory[me]!.slots[19] = { item: 'item.boar_hide', qty: 3 };
      s.ledger.itemsMade.loot = { ...s.ledger.itemsMade.loot, 'item.boar_hide': 3 };
    });
    expect(codes(p)).toContain('LOOT_WITHOUT_KILL');
  });

  it('an item added to the bag with no ledger entry', () => {
    const p = tamper(honestPlain(), (s, me) => {
      s.entities.comps.inventory[me]!.slots[18] = { item: 'item.sword_iron', qty: 1 };
    });
    expect(codes(p)).toContain('ITEMS_EXCEED_MADE');
  });

  it('an item recorded from a source that cannot make it', () => {
    const p = tamper(honestPlain(), (s) => {
      s.ledger.itemsMade.chest = { 'item.sunwort': 1 };
    });
    expect(codes(p)).toContain('ITEM_SOURCE_LOCKED');
  });

  it('a summary that disagrees with the sim', () => {
    const p = honestPlain();
    p.summary = { ...p.summary, coin: p.summary.coin + 5 };
    expect(codes(p)).toContain('SUMMARY_MISMATCH');
    const q = honestPlain();
    q.summary = { ...q.summary, totalSkillPoints: q.summary.totalSkillPoints + 1 };
    expect(codes(q)).toContain('SUMMARY_MISMATCH');
  });

  it('a ledger copy that disagrees with the sim ledger', () => {
    const p = honestPlain();
    p.ledger = { ...p.ledger, kills: { ...p.ledger.kills, 'creature.mossling': 99 } };
    expect(codes(p)).toContain('LEDGER_COPY_MISMATCH');
  });
});

describe('every rule has a bound: just inside passes, just outside flags', () => {
  const sec = 100;
  edge(
    'coin from loot against the kills that could drop it',
    'COIN_IMPLAUSIBLE',
    (v, s, me) => {
      // Ten Mosslings drop at most 3 coin each.
      const old = s.ledger.coinEarned.loot ?? 0;
      s.ledger.coinEarned.loot = v;
      s.entities.comps.avatar[me]!.coin += v - old;
    },
    30,
  );
  edge(
    'coin from chests against what every chest holds',
    'COIN_IMPLAUSIBLE',
    (v, s, me) => {
      s.ledger.coinEarned.chest = v;
      s.entities.comps.avatar[me]!.coin += v;
    },
    CHEST_COIN_TOTAL,
  );
  edge(
    'coin from sales against what the shops can pay',
    'SALE_RATE',
    (v, s, me) => {
      const old = s.ledger.coinEarned.sale ?? 0;
      s.ledger.coinEarned.sale = v;
      s.entities.comps.avatar[me]!.coin += v - old;
    },
    saleCeiling(sec, 9),
  );
  edge(
    'kills per second',
    'KILLS_IMPLAUSIBLE',
    (v, s) => {
      s.ledger.kills['creature.mossling'] = v;
    },
    KILLS_PER_SECOND_MAX * sec + COUNT_SLACK,
  );
  edge(
    'crafts per second',
    'CRAFTS_IMPLAUSIBLE',
    (v, s) => {
      s.ledger.crafts['recipe.herb_tea'] = v;
      s.ledger.itemsMade.cook = { 'item.herb_tea': v };
    },
    COOK_EVENTS_PER_SECOND * sec + COUNT_SLACK,
  );
  edge(
    'XP earned in a skill against the fastest it can be earned',
    'XP_IMPLAUSIBLE',
    (v, s) => {
      s.ledger.xpEarned['skill.blades'] = v;
    },
    xpCeiling('skill.blades', sec),
  );

  it(`play time against the wall clock: ${PLAY_SLACK_SECONDS} s of slack passes, one more flags`, () => {
    const at = (extra: number) => {
      const p = honestPlain();
      return { ...p, startedAt: p.createdAt - (p.playSeconds - extra) * 1000 };
    };
    expect(codes(at(PLAY_SLACK_SECONDS))).not.toContain('PLAYTIME_EXCEEDS_ELAPSED');
    expect(codes(at(PLAY_SLACK_SECONDS + 1))).toContain('PLAYTIME_EXCEEDS_ELAPSED');
  });

  it('the summary tick against the recorded play seconds', () => {
    const p = honestPlain();
    expect(codes({ ...p, playSeconds: p.playSeconds + 10 })).not.toContain(
      'TICK_PLAYTIME_MISMATCH',
    );
    expect(codes({ ...p, playSeconds: p.playSeconds + 11 })).toContain('TICK_PLAYTIME_MISMATCH');
  });

  it('a stack against its size', () => {
    const at = (qty: number) =>
      tamper(honestPlain(), (s, me) => {
        const inv = s.entities.comps.inventory[me]!;
        inv.slots[17] = { item: 'item.sunwort', qty };
        s.ledger.itemsMade.gather = { 'item.sunwort': 1000 };
      });
    expect(codes(at(stackSize('item.sunwort')))).not.toContain('STACK_OVER_CAP');
    expect(codes(at(stackSize('item.sunwort') + 1))).toContain('STACK_OVER_CAP');
  });

  it('coin against the hard cap', () => {
    const at = (n: number) =>
      tamper(honestPlain(), (s, me) => {
        s.entities.comps.avatar[me]!.coin = n;
        s.ledger.coinEarned.seed = n - (s.ledger.coinEarned.loot ?? 0);
      });
    expect(codes(at(COIN_HARD_CAP + 1))).toContain('BAD_QUANTITY');
  });

  it('banked XP waits at a threshold only while its Trial is pending', () => {
    const p = tamper(honestPlain(), (s, me) => {
      const sk = s.entities.comps.skills[me]!;
      const pts = sk.points['skill.blades'] ?? 0;
      sk.xp['skill.blades'] = xpToNext(pts);
      s.ledger.xpEarned['skill.blades'] = (s.ledger.xpEarned['skill.blades'] ?? 0) + xpToNext(pts);
    });
    expect(codes(p)).toContain('RANK_XP_MISMATCH');
    // At a threshold with the Trial pending, the same bank is allowed.
    const banked = tamper(honestPlain(), (s, me) => {
      const sk = s.entities.comps.skills[me]!;
      sk.points['skill.blades'] = 14;
      let total = 0;
      for (let i = 0; i < 14; i++) total += xpToNext(i);
      sk.xp['skill.blades'] = xpToNext(14) + 500;
      s.ledger.xpEarned['skill.blades'] = total + xpToNext(14) + 500;
      const pools = s.entities.comps.pools[me]!;
      pools.hpMax += 14 - (sk.points['skill.blades'] ?? 0) + 14;
    });
    expect(codes(banked)).not.toContain('RANK_XP_MISMATCH');
  });
});

describe('the other consistency and ledger rules', () => {
  const cases: [
    string,
    ReasonCode,
    (s: Parameters<Parameters<typeof tamper>[1]>[0], me: number) => void,
  ][] = [
    [
      'a pool maximum that does not follow ranks',
      'POOL_MAX_MISMATCH',
      (s, me) => {
        s.entities.comps.pools[me]!.hpMax += 1;
      },
    ],
    [
      'a pool above its maximum',
      'POOL_OVER_MAX',
      (s, me) => {
        const p = s.entities.comps.pools[me]!;
        p.hp = p.hpMax + 1;
      },
    ],
    [
      'an item id that does not exist',
      'UNKNOWN_ID',
      (s, me) => {
        s.entities.comps.inventory[me]!.slots[16] = { item: 'item.not_real', qty: 1 };
      },
    ],
    [
      'a recipe that does not exist',
      'UNKNOWN_ID',
      (s, me) => {
        s.entities.comps.inventory[me]!.recipes.push('recipe.not_real');
      },
    ],
    [
      'a bag of the wrong size',
      'BAG_SIZE',
      (s, me) => {
        s.entities.comps.inventory[me]!.slots.length = 0;
      },
    ],
    [
      'gear in the wrong slot',
      'EQUIP_SLOT',
      (s, me) => {
        s.entities.comps.inventory[me]!.equipment.head = { item: 'item.sword_rusty', qty: 1 };
      },
    ],
    [
      'a fractional quantity',
      'BAD_QUANTITY',
      (s, me) => {
        s.entities.comps.inventory[me]!.slots[15] = { item: 'item.sunwort', qty: 1.5 };
      },
    ],
    [
      'a request finished with too few kills',
      'REQUEST_STATE',
      (s) => {
        s.ledger.kills['creature.mossling'] = 3;
      },
    ],
    [
      'a request that paid the wrong coin',
      'REQUEST_PAYOUT_MISMATCH',
      (s, me) => {
        s.ledger.coinEarned.request = REQUESTS['request.clear_pests']!.reward.coin + 1;
        s.entities.comps.avatar[me]!.coin += 1;
      },
    ],
    [
      'more crafts than cooked results',
      'CRAFT_MISMATCH',
      (s) => {
        s.ledger.crafts['recipe.herb_tea'] = 3;
      },
    ],
    [
      'a purchase that cost the wrong coin',
      'PURCHASE_MISMATCH',
      (s, me) => {
        s.ledger.coinSpent.purchase = (s.ledger.coinSpent.purchase ?? 0) + 1;
        s.entities.comps.avatar[me]!.coin -= 1;
      },
    ],
    [
      'more echo coin recovered than was left',
      'ECHO_EXCEEDS_DROPPED',
      (s, me) => {
        s.ledger.coinEarned.echo = 5;
        s.entities.comps.avatar[me]!.coin += 5;
      },
    ],
    [
      'a starter kit with extra items',
      'START_KIT_MISMATCH',
      (s) => {
        s.ledger.itemsMade.start = { ...s.ledger.itemsMade.start, 'item.sword_iron': 1 };
      },
    ],
    [
      'loot of more than the kills could drop',
      'LOOT_WITHOUT_KILL',
      (s, me) => {
        s.ledger.itemsMade.loot = { 'item.moss_tuft': 21 };
        s.entities.comps.avatar[me]!.coin += 0;
      },
    ],
    [
      'XP held above XP earned',
      'XP_EXCEEDS_EARNED',
      (s) => {
        s.ledger.xpEarned['skill.blades'] = 1;
      },
    ],
  ];
  for (const [name, code, edit] of cases) {
    it(`${name} flags ${code}`, () => {
      expect(codes(tamper(honestPlain(), edit))).toContain(code);
    });
  }
});

describe('structure and chain', () => {
  it('a snapshot with a broken chain is flagged', () => {
    const r = validateSave(honestPlain(), { chain: 'broken' });
    expect(r.reasons.map((x) => x.code)).toEqual(['CHAIN_BROKEN']);
    expect(validateSave(honestPlain(), { chain: 'ok' }).ok).toBe(true);
    expect(validateSave(honestPlain(), { chain: 'unchecked' }).ok).toBe(true);
  });

  it('a save that is not a save is MALFORMED_STATE and never throws', () => {
    const p = honestPlain();
    for (const sim of ['not json', '{}', '{"tick":1}', 'null']) {
      const r = validateSave({ ...p, sim });
      expect(r.ok).toBe(false);
      expect(r.reasons[0]!.code).toBe('MALFORMED_STATE');
    }
  });

  it('a save with no avatar, or two, is AVATAR_COUNT', () => {
    const none = tamper(honestPlain(), (s, me) => {
      s.entities.comps.avatar[me] = null;
    });
    expect(codes(none)).toContain('AVATAR_COUNT');
    const two = tamper(honestPlain(), (s, me) => {
      s.entities.comps.avatar[me + 1] = structuredClone(s.entities.comps.avatar[me]!);
      s.entities.alive[me + 1] = true;
      s.entities.capacity = me + 2;
    });
    expect(codes(two)).toContain('AVATAR_COUNT');
  });
});

describe('trust', () => {
  it('starts Intact and becomes Flagged on the first reason, with the time', () => {
    const t = mergeTrust(undefined, [{ code: 'COIN_RECONCILE', layer: 'ledger', detail: 'x' }], T0);
    expect(t).toEqual({ state: 'flagged', reasons: ['COIN_RECONCILE'], flaggedAt: T0 });
  });

  it('never goes back to Intact, keeps the first time, and adds new reasons once', () => {
    const first = mergeTrust(
      undefined,
      [{ code: 'COIN_RECONCILE', layer: 'ledger', detail: '' }],
      5,
    );
    const later = mergeTrust(
      first,
      [
        { code: 'COIN_RECONCILE', layer: 'ledger', detail: '' },
        { code: 'CHAIN_BROKEN', layer: 'chain', detail: '' },
      ],
      99,
    );
    expect(later).toEqual({
      state: 'flagged',
      reasons: ['COIN_RECONCILE', 'CHAIN_BROKEN'],
      flaggedAt: 5,
    });
    expect(mergeTrust(later, [], 200)).toEqual(later);
  });

  it('an Intact save with nothing found stays Intact', () => {
    expect(mergeTrust(intact(), [], 1)).toEqual(intact());
  });
});
