import { afterEach, describe, expect, it } from 'vitest';
import { DIALOGUES } from '../../src/content/dialogue';
import type { Cond, Dialogue, Effect } from '../../src/content/dialogue/types';
import { REQUESTS } from '../../src/content/requests';
import type { RequestDef } from '../../src/content/requests/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { giverMark, giverMarks } from '../../src/sim/giverMarks';
import { holds, startNode } from '../../src/sim/journal';
import { give } from '../../src/sim/items';
import { offerTrial, passTrial } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { spawnNpc, talk } from '../../src/sim/systems/npcs';
import { startRequest, turnIn } from '../../src/sim/systems/requests';

const FAKE = 'npc.fake_giver';
const NIGHT = (() => {
  for (let t = 0; ; t += 1800) if (t % (48 * 1800) >= 40 * 1800) return t;
})();

function world(): { s: SimState; me: number } {
  const s = createDemoState(5, 0);
  const me = createAvatar(s, feetAt(20, 20).x, feetAt(20, 20).y);
  return { s, me };
}

/** A one-door dialogue: the start node offers `effects` through a choice guarded by `cond`. */
function say(effects: readonly Effect[], cond?: readonly Cond[], onNode = false): void {
  (DIALOGUES as Record<string, Dialogue>)[FAKE] = {
    npc: FAKE,
    entries: [{ node: 'hi' }],
    nodes: {
      hi: {
        id: 'hi',
        text: 'x',
        ...(onNode ? { do: effects } : {}),
        choices: [
          {
            text: 'y',
            next: null,
            ...(onNode ? {} : { do: effects }),
            ...(cond ? { if: cond } : {}),
          },
        ],
      },
    },
  };
}

const fakeReq = (over: Partial<RequestDef> = {}): RequestDef => ({
  id: 'request.fake_mark',
  giver: { npc: FAKE },
  kind: 'authored',
  region: 'dawnmeadow',
  titleKey: 'x',
  askKey: 'x',
  solutions: [{ id: 'a', labelKey: 'x', steps: [{ kind: 'defeat', count: 1 }] }],
  reward: { coin: 1, items: [], renown: 0 },
  estMinutes: 1,
  ...over,
});
const addReq = (d: RequestDef): void => {
  (REQUESTS as Record<string, RequestDef>)[d.id] = d;
};

afterEach(() => {
  delete (DIALOGUES as Record<string, Dialogue>)[FAKE];
  delete (REQUESTS as Record<string, RequestDef>)['request.fake_mark'];
});

describe('giver marks', () => {
  it('a Trial giver offers while the Trial is open, and not once offered or passed', () => {
    const { s, me } = world();
    say([{ offerTrial: 'trial.blades.15' }]);
    expect(giverMark(s, me, FAKE)).toBe('offer');
    offerTrial(s, me, 'trial.blades.15');
    expect(giverMark(s, me, FAKE)).toBeNull();
    passTrial(s, me, 'trial.blades.15');
    expect(giverMark(s, me, FAKE)).toBeNull();
  });

  it('a request offers when its requirements hold, not before, not once taken, and again after a repeat cooldown', () => {
    const { s, me } = world();
    const def = fakeReq({ requires: [{ flag: 'f.open' }], repeat: { cooldownDays: 3 } });
    addReq(def);
    say([{ startRequest: def.id }]);
    expect(giverMark(s, me, FAKE)).toBeNull();
    s.entities.comps.journal[me]!.flags.push('f.open');
    expect(giverMark(s, me, FAKE)).toBe('offer');
    expect(startRequest(s, me, def)).toBe(true);
    expect(giverMark(s, me, FAKE)).toBeNull();
    const rec = s.entities.comps.journal[me]!.requests[def.id]!;
    rec.state = 'done';
    rec.doneDay = 0;
    expect(giverMark(s, me, FAKE)).toBeNull();
    s.worldTick = 5 * 48 * 1800;
    expect(giverMark(s, me, FAKE)).toBe('offer');
  });

  it('a full request log still shows who has work', () => {
    const { s, me } = world();
    const def = fakeReq();
    addReq(def);
    say([{ startRequest: def.id }]);
    const j = s.entities.comps.journal[me]!;
    for (let i = 0; i < 20; i++)
      j.requests[`request.filler${i}`] = { state: 'active', solution: null, prog: {}, progress: 0 };
    expect(giverMark(s, me, FAKE)).toBe('offer');
  });

  it('ready when a request is ready and the giver has a reachable turn in', () => {
    const { s, me } = world();
    const def = fakeReq();
    addReq(def);
    say([{ turnIn: def.id }]);
    expect(giverMark(s, me, FAKE)).toBeNull();
    startRequest(s, me, def);
    expect(giverMark(s, me, FAKE)).toBeNull();
    s.entities.comps.journal[me]!.requests[def.id]!.state = 'ready';
    expect(giverMark(s, me, FAKE)).toBe('ready');
  });

  it('ready when the bag holds a delivery, not when it holds one fewer; ready wins over offer', () => {
    const { s, me } = world();
    const def = fakeReq({
      solutions: [
        {
          id: 'a',
          labelKey: 'x',
          steps: [{ kind: 'deliver', item: 'item.sunwort', qty: 3, to: FAKE }],
        },
      ],
    });
    addReq(def);
    say([{ offerTrial: 'trial.blades.15' }]);
    startRequest(s, me, def);
    give(s, me, 'item.sunwort', 2, 'start');
    expect(giverMark(s, me, FAKE)).toBe('offer');
    give(s, me, 'item.sunwort', 1, 'start');
    expect(giverMark(s, me, FAKE)).toBe('ready');
  });

  it('a choice guarded by a phase shows the mark only in that phase', () => {
    const { s, me } = world();
    say([{ offerTrial: 'trial.blades.15' }], [{ phase: ['night'] }]);
    s.worldTick = 0;
    expect(holds(s, me, [{ phase: ['night'] }])).toBe(false);
    expect(giverMark(s, me, FAKE)).toBeNull();
    s.worldTick = NIGHT;
    expect(giverMark(s, me, FAKE)).toBe('offer');
  });

  it('a node effect counts like a choice effect', () => {
    const { s, me } = world();
    say([{ offerTrial: 'trial.blades.15' }], undefined, true);
    expect(giverMark(s, me, FAKE)).toBe('offer');
  });

  it('a teacher with only a technique, a shop or a flag shows nothing', () => {
    const { s, me } = world();
    say([{ learnTechnique: 'technique.ember_bolt' }, { openShop: 'shop.x' }, { setFlag: 'a' }]);
    expect(giverMark(s, me, FAKE)).toBeNull();
  });

  it('is pure: the same state gives the same marks, and the state is untouched', () => {
    const { s, me } = world();
    const before = JSON.stringify(s.entities.comps.journal[me]);
    expect([...giverMarks(s, me)]).toEqual([...giverMarks(s, me)]);
    expect(JSON.stringify(s.entities.comps.journal[me])).toBe(before);
  });
});

/** Finds the steps from the start that reach an offer, with its own walk. choice -1 enters a node. */
function pathToOffer(
  s: SimState,
  me: number,
  npc: string,
): { node: string; choice: number }[] | null {
  const d = DIALOGUES[npc]!;
  const start = startNode(s, me, npc);
  const offers = (es: readonly Effect[] | undefined): boolean =>
    (es ?? []).some((e) => 'offerTrial' in e || 'startRequest' in e);
  const seen = new Set<string>();
  type Path = { node: string; choice: number }[];
  const go = (id: string | null | undefined, path: Path): Path | null => {
    if (!id || seen.has(id) || path.length > 16) return null;
    const node = d.nodes[id];
    if (!node) return null;
    seen.add(id);
    const entered = [...path, { node: id, choice: -1 }];
    if (offers(node.do)) return entered;
    const viaNext = go(node.next, entered);
    if (viaNext) return viaNext;
    for (const [i, c] of (node.choices ?? []).entries()) {
      if (!holds(s, me, c.if)) continue;
      const here = [...entered, { node: id, choice: i }];
      if (offers(c.do)) return here;
      const deeper = go(c.next, here);
      if (deeper) return deeper;
    }
    return null;
  };
  return go(start, []);
}

describe('giver marks over Dawnmeadow', () => {
  it('for every person marked as an offer, the dialogue reaches a real offer (the mark never lies)', () => {
    const probe = world();
    const marked = [...giverMarks(probe.s, probe.me)]
      .filter(([, m]) => m === 'offer')
      .map(([n]) => n);
    expect(marked.length).toBeGreaterThan(5);
    for (const npc of marked) {
      const { s, me } = world();
      spawnNpc(s, npc, 20, 20);
      const path = pathToOffer(s, me, npc);
      expect(path, `${npc} has a path to an offer`).not.toBeNull();
      const j = s.entities.comps.journal[me]!;
      const sk = s.entities.comps.skills[me]!;
      const before = Object.keys(j.requests).length + sk.offered.length;
      for (const step of path!) talk(s, me, { npc, node: step.node, choice: step.choice });
      const after = Object.keys(j.requests).length + sk.offered.length;
      expect(after, `${npc} really gave something`).toBeGreaterThan(before);
    }
  });

  it('turning in clears a ready mark', () => {
    const { s, me } = world();
    const def = fakeReq();
    addReq(def);
    say([{ turnIn: def.id }]);
    startRequest(s, me, def);
    s.entities.comps.journal[me]!.requests[def.id]!.state = 'ready';
    expect(giverMark(s, me, FAKE)).toBe('ready');
    turnIn(s, me, def.id);
    expect(giverMark(s, me, FAKE)).toBeNull();
  });
});
