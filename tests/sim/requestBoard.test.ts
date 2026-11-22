import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUEST_BALANCE as RB } from '../../src/content/balance/requests';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { SHOPS } from '../../src/content/dialogue';
import { ITEMS } from '../../src/content/items';
import { NODES } from '../../src/content/items/recipes';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { REQUEST_STRINGS } from '../../src/content/strings/requests';
import { fill } from '../../src/content/strings/skills';
import { give } from '../../src/sim/items';
import { createStream } from '../../src/sim/kernel/rng';
import { renownIn } from '../../src/sim/renown';
import {
  generateStanding,
  itemSources,
  MAX_STANDING_COIN,
  regionFacts,
  titleOf,
  type RegionFacts,
} from '../../src/sim/requestGen';
import { boardPosted, boardReady, pinnedLine, requestLog } from '../../src/sim/requestLog';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { createSpawner } from '../../src/sim/systems/spawner';
import { spawnNode } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 80 || ty > 80 ? 1 : 0),
};

// --- The generator ---------------------------------------------------------------------------

const NODE_KINDS = Object.keys(NODES).sort();
const CREATURE_IDS = [...new Set(Object.values(SPAWNERS).map((s) => s.creature))].sort();
const STOCK = Object.values(SHOPS).flatMap((s) =>
  s.stock.map((l) => ({ npc: s.npc, item: l.item })),
);

/** A region made from a seed: some of the nodes, some of the creatures, some empty shelves. */
function randomFacts(seed: number): RegionFacts {
  const r = createStream(seed, 'world');
  const some = <T>(xs: readonly T[]): T[] => {
    const out: T[] = [];
    for (const x of xs) {
      r.s[0] = (r.s[0] + 0x9e3779b9) | 0;
      if ((((r.s[0] ^ (r.s[1] += 7)) >>> 0) & 3) === 0) out.push(x);
    }
    return out;
  };
  return { nodes: some(NODE_KINDS), creatures: some(CREATURE_IDS), outOfStock: some(STOCK) };
}

describe('standing request generator', () => {
  it('over 1,000 seeds and regions, every posted request is satisfiable and inside the caps', () => {
    let posted = 0;
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 1000; seed++) {
      const facts = randomFacts(seed);
      const rng = createStream(seed, 'requests');
      const list = generateStanding(facts, rng, 'board.square', seed % 30);
      expect(list.length).toBeLessThanOrEqual(RB.boardSize);
      const have = itemSources(facts);
      const seen = new Set<string>();
      for (const def of list) {
        posted++;
        expect(def.kind).toBe('standing');
        expect(def.solutions).toHaveLength(1);
        expect(def.reward.items).toEqual([]);
        expect(def.reward.coin).toBeGreaterThan(0);
        expect(def.reward.coin).toBeLessThanOrEqual(MAX_STANDING_COIN);
        expect(def.reward.renown).toBe(RB.renown.standing);
        expect(titleOf(def).length).toBeLessThanOrEqual(RB.titleMax);
        const step = def.solutions[0]!.steps[0]!;
        const key = JSON.stringify(step);
        expect(seen.has(key), 'no two the same').toBe(false);
        seen.add(key);
        kinds.add(step.kind);
        if (step.kind === 'deliver' && step.to.startsWith('board.')) {
          // A gather job is a hand-in at the board (POW-M4-22A).
          expect(step.to).toBe('board.square');
          const from = facts.nodes.flatMap((k) => NODES[k]!.yields.map((y) => y.item));
          expect(from, `gather ${step.item} has a node`).toContain(step.item);
          expect(step.qty).toBeGreaterThanOrEqual(RB.standing.gather.qty[0]);
          expect(step.qty).toBeLessThanOrEqual(RB.standing.gather.maxQty);
          expect(ITEMS[step.item]!.value).toBeLessThanOrEqual(RB.maxAskValue);
        } else if (step.kind === 'deliver') {
          expect(facts.outOfStock).toContainEqual({ npc: step.to, item: step.item });
          expect(have.has(step.item), `deliver ${step.item} has a source`).toBe(true);
          expect(step.qty).toBeGreaterThanOrEqual(RB.standing.deliver.qty[0]);
          expect(step.qty).toBeLessThanOrEqual(RB.standing.deliver.maxQty);
        } else if (step.kind === 'defeat') {
          expect(facts.creatures, `defeat ${step.creature} spawns here`).toContain(step.creature);
          expect(CREATURES[step.creature!]!.archetype).not.toBe('dummy');
          expect(step.count).toBeGreaterThanOrEqual(RB.standing.defeat.qty[0]);
          expect(step.count).toBeLessThanOrEqual(RB.standing.defeat.maxQty);
        } else expect.unreachable(`unexpected step ${step.kind}`);
      }
    }
    expect(posted).toBeGreaterThan(1000);
    expect([...kinds].sort()).toEqual(['defeat', 'deliver']);
  });

  it('never posts two jobs naming the same item or creature on one day', () => {
    // Dawnmeadow's own region facts, 200 days.
    const facts: RegionFacts = { nodes: NODE_KINDS, creatures: CREATURE_IDS, outOfStock: STOCK };
    for (let day = 0; day < 200; day++) {
      const list = generateStanding(facts, createStream(9, 'requests'), 'board.square', day);
      const subjects = list.map((d) => {
        const o = d.solutions[0]!.steps[0]!;
        return o.kind === 'deliver' ? o.item : o.kind === 'defeat' ? o.creature : '';
      });
      expect(new Set(subjects).size, `day ${day}: ${subjects.join(', ')}`).toBe(subjects.length);
    }
  });

  it('words a gather ask by how the item is got: dug, cut, landed, or grows', () => {
    const ask = (nodes: string[]): string => {
      const facts: RegionFacts = { nodes, creatures: [], outOfStock: [] };
      for (let day = 0; day < 30; day++) {
        const d = generateStanding(facts, createStream(3, 'requests'), 'board.square', day)[0];
        if (d) return fill(REQUEST_STRINGS[d.askKey] ?? d.askKey, d.vars ?? {});
      }
      return '';
    };
    expect(ask(['node.herb_patch'])).toContain('grows');
    expect(ask(NODE_KINDS.filter((k) => NODES[k]!.tag === 'mining'))).toContain('dug');
  });

  it('is deterministic for a seed and a day, and different on another day', () => {
    const facts: RegionFacts = { nodes: NODE_KINDS, creatures: CREATURE_IDS, outOfStock: STOCK };
    const a = generateStanding(facts, createStream(5, 'requests'), 'board.square', 3);
    const b = generateStanding(facts, createStream(5, 'requests'), 'board.square', 3);
    expect(b).toEqual(a);
    const c = generateStanding(facts, createStream(5, 'requests'), 'board.square', 4);
    expect(a).toHaveLength(RB.boardSize);
    expect(c.map((d) => d.id)).not.toEqual(a.map((d) => d.id));
  });

  it('posts nothing from an empty region, and does not throw', () => {
    expect(
      generateStanding(
        { nodes: [], creatures: [], outOfStock: [] },
        createStream(1, 'requests'),
        'board.square',
        0,
      ),
    ).toEqual([]);
  });
});

// --- The board in play -----------------------------------------------------------------------

interface Rig {
  s: SimState;
  me: number;
  tick: (...cmds: Command[]) => void;
  run: (n: number, ...cmds: Command[]) => void;
  shop: number;
}

/** A region with a herb patch, a Mossling spawner, a shopkeeper with an empty shelf, and a board in front. */
function boardRig(): Rig {
  const s = createDemoState(21, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  // The board stands just north of the avatar, who faces east.
  spawnFixture(s, 'fixture.board', 20, 19);
  spawnNode(s, 'node.herb_patch', 30 * 16 + 8, 30 * 16 + 14);
  createSpawner(s, 'spawner.mossling', 40 * 16 + 8, 40 * 16 + 14);
  const k = spawnNpc(s, 'npc.shopkeeper', 26, 26);
  const npc = s.entities.comps.npc[k]!;
  npc.stock['item.dish_bread'] = 0;
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds });
  };
  const run = (n: number, ...cmds: Command[]): void => {
    for (let i = 0; i < n; i++) tick(...(i === 0 ? cmds : []));
  };
  run(2);
  return { s, me, tick, run, shop: k };
}

const board = (r: Rig) => r.s.entities.comps.board.find((b) => b)!;
const journal = (r: Rig) => r.s.entities.comps.journal[r.me]!;

describe('request board', () => {
  it('reads the region: its nodes, its spawners and the shelves that ran out', () => {
    const r = boardRig();
    const facts = regionFacts(r.s);
    expect(facts.nodes).toEqual(['node.herb_patch']);
    expect(facts.creatures).toEqual(['creature.mossling']);
    expect(facts.outOfStock).toContainEqual({ npc: 'npc.shopkeeper', item: 'item.dish_bread' });
  });

  it('posts at the first tick and again when the day turns, replacing what was not taken', () => {
    const r = boardRig();
    expect(board(r).posted.length).toBeGreaterThan(0);
    const first = board(r).posted.map((d) => d.id);
    r.run(3);
    expect(board(r).posted.map((d) => d.id)).toEqual(first);
    // The platform sets `worldTick` from trusted time. A day is 48 minutes of ticks.
    stepWorld(r.s, r.me, { commands: [], worldTick: 48 * 1800 + 5 });
    expect(board(r).day).toBe(1);
    expect(board(r).posted.map((d) => d.id)).not.toEqual(first);
    expect(board(r).posted.every((d) => d.id.startsWith('standing.board.square.1.'))).toBe(true);
  });

  it('a request is taken from the board in front, and leaves the board', () => {
    const r = boardRig();
    const def = board(r).posted[0]!;
    const n = board(r).posted.length;
    r.tick({ type: 'takeRequest', board: 'board.square', id: def.id });
    expect(journal(r).requests[def.id]?.state).toBe('active');
    expect(journal(r).requests[def.id]?.gen?.id).toBe(def.id);
    expect(board(r).posted).toHaveLength(n - 1);
  });

  it('taking from a board that is far away, or a request not posted, does nothing', () => {
    const r = boardRig();
    const def = board(r).posted[0]!;
    r.tick({ type: 'takeRequest', board: 'board.square', id: 'standing.nope' });
    expect(Object.keys(journal(r).requests)).toHaveLength(0);
    r.s.entities.comps.pos[r.me]!.x += 30 * 16 * 256;
    r.tick({ type: 'takeRequest', board: 'board.square', id: def.id });
    expect(Object.keys(journal(r).requests)).toHaveLength(0);
  });

  it('a defeat job is done by fighting, handed in at the board, paid once and counted', () => {
    const r = boardRig();
    const defs = board(r).posted;
    const def = defs.find((d) => d.solutions[0]!.steps[0]!.kind === 'defeat');
    if (!def) return expect.unreachable('this region posts a defeat job');
    const step = def.solutions[0]!.steps[0]!;
    if (step.kind !== 'defeat') return;
    r.tick({ type: 'takeRequest', board: 'board.square', id: def.id });
    // Fight from where the avatar stands: creatures at 1 hp in front, facing east.
    r.run(2, { type: 'move', dir: 2 });
    r.run(3, { type: 'move', dir: null });
    for (let n = 0; n < step.count; n++) {
      const id = spawnCreature(r.s, step.creature!, 20 * 16 + 8 + 14, 20 * 16 + 14, -1);
      r.s.entities.comps.ai[id] = null;
      r.s.entities.comps.pools[id]!.hp = 1;
      for (let i = 0; i < 160 && r.s.entities.alive[id]; i++)
        r.tick(i % 12 === 2 ? { type: 'attack' } : { type: 'move', dir: null });
    }
    expect(journal(r).requests[def.id]?.state).toBe('ready');
    expect(boardReady(r.s, r.me, 'board.square')).toEqual([def.id]);
    const coin0 = r.s.entities.comps.avatar[r.me]!.coin;
    r.tick({ type: 'turnInRequest', id: def.id });
    expect(journal(r).requests[def.id]?.state).toBe('done');
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(coin0 + def.reward.coin);
    expect(renownIn(r.s, r.me, RB.homeRegion)).toBe(RB.renown.standing);
    expect(r.s.ledger.requestRewards).toEqual({ n: 1, coin: def.reward.coin });
    expect(r.s.ledger.coinEarned.request).toBe(def.reward.coin);
    r.tick({ type: 'turnInRequest', id: def.id });
    expect(r.s.ledger.requestRewards.n).toBe(1);
  });

  it('a deliver job is done by bringing the item to the shopkeeper who asked', () => {
    const r = boardRig();
    // Post until a deliver job turns up (the day's rolls decide which kinds).
    let def = board(r).posted.find((d) => d.solutions[0]!.steps[0]!.kind === 'deliver');
    for (let day = 1; !def && day < 40; day++) {
      stepWorld(r.s, r.me, { commands: [], worldTick: day * 48 * 1800 });
      def = board(r).posted.find((d) => d.solutions[0]!.steps[0]!.kind === 'deliver');
    }
    if (!def) return expect.unreachable('a deliver job is posted in some day');
    const step = def.solutions[0]!.steps[0]!;
    if (step.kind !== 'deliver') return;
    r.tick({ type: 'takeRequest', board: 'board.square', id: def.id });
    give(r.s, r.me, step.item, step.qty, 'start');
    r.run(2, { type: 'move', dir: 2 });
    r.run(3, { type: 'move', dir: null });
    // The shopkeeper steps up in front of the avatar.
    r.s.entities.comps.pos[r.shop] = { x: (21 * 16 + 8) * 256, y: (20 * 16 + 14) * 256 };
    r.run(2, { type: 'interact' });
    expect(journal(r).requests[def.id]?.state).toBe('ready');
  });

  it('a gather job is a hand-in: the bag counts, the board takes it, and the reward is paid once', () => {
    const r = boardRig();
    const isGather = (d: { solutions: { steps: { kind: string; to?: string }[] }[] }): boolean =>
      d.solutions[0]!.steps[0]!.to?.startsWith('board.') ?? false;
    let gather = board(r).posted.find(isGather);
    for (let day = 1; !gather && day < 40; day++) {
      stepWorld(r.s, r.me, { commands: [], worldTick: day * 48 * 1800 });
      gather = board(r).posted.find(isGather);
    }
    if (!gather) return expect.unreachable('a gather job is posted');
    const step = gather.solutions[0]!.steps[0]!;
    if (step.kind !== 'deliver') return;
    expect(step.to).toBe('board.square');
    r.tick({ type: 'takeRequest', board: 'board.square', id: gather.id });
    // The bag already holds some of it: the log says so, and the board offers no hand-in.
    give(r.s, r.me, step.item, step.qty - 1, 'start');
    r.run(2);
    const line = requestLog(r.s, r.me).find((v) => v.id === gather.id)!;
    expect(line.ways[0]!.steps[0]!.status).toBe(`${step.qty - 1} of ${step.qty} in your bag`);
    expect(boardReady(r.s, r.me, 'board.square')).toEqual([]);
    r.tick({ type: 'turnInRequest', id: gather.id });
    expect(journal(r).requests[gather.id]?.state).toBe('active');
    // With the last one it hands in: the items are taken and the coin paid once.
    give(r.s, r.me, step.item, 1, 'start');
    r.run(2);
    expect(boardReady(r.s, r.me, 'board.square')).toEqual([gather.id]);
    const coin0 = r.s.entities.comps.avatar[r.me]!.coin;
    r.tick({ type: 'turnInRequest', id: gather.id });
    expect(journal(r).requests[gather.id]?.state).toBe('done');
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(coin0 + gather.reward.coin);
    const left = r.s.entities.comps.inventory[r.me]!.slots.reduce(
      (n, st) => n + (st && st.item === step.item ? st.qty : 0),
      0,
    );
    expect(left).toBe(0);
    expect(r.s.ledger.requestRewards.n).toBe(1);
    r.tick({ type: 'turnInRequest', id: gather.id });
    expect(r.s.ledger.requestRewards.n).toBe(1);
  });

  it('too many standing jobs held is refused', () => {
    const r = boardRig();
    for (const d of board(r).posted)
      r.tick({ type: 'takeRequest', board: 'board.square', id: d.id });
    const held = Object.keys(journal(r).requests).length;
    expect(held).toBeLessThanOrEqual(RB.maxActive);
  });
});

// --- What leaves the sim is words ------------------------------------------------------------

/** Every leaf of a value, so a test can check that no number (no position) is among them. */
function leaves(v: unknown, path = ''): { path: string; value: unknown }[] {
  if (v === null || typeof v !== 'object') return [{ path, value: v }];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) =>
    leaves(x, `${path}.${k}`),
  );
}

describe('the request API for the interface returns text only', () => {
  it('log, board and pinned line hold only strings and booleans', () => {
    const r = boardRig();
    for (const d of board(r).posted)
      r.tick({ type: 'takeRequest', board: 'board.square', id: d.id });
    // An authored request too, with a step in progress.
    journal(r).requests['request.clear_pests'] = {
      state: 'active',
      solution: null,
      prog: { defeat: { step: 0, p: { n: 2, t0: 0 } } },
      progress: 2,
    };
    journal(r).pinned = 'request.clear_pests';
    const out = [
      requestLog(r.s, r.me),
      boardPosted(r.s, 'board.square'),
      boardReady(r.s, r.me, 'board.square'),
      pinnedLine(r.s, r.me),
    ];
    const all = out.flatMap((o) => leaves(o));
    expect(all.length).toBeGreaterThan(10);
    for (const { path, value } of all)
      expect(['string', 'boolean'], `${path} is text`).toContain(typeof value);
    // And the words name no place: a flag step says what to take, not where on a map.
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/\bx\b|\by\b|coordinates|tile \d/i);
  });

  it('nothing in render or ui imports the engine, the generator or a position source', () => {
    const forbidden = [/sim\/systems\/requests/, /sim\/requestGen/, /sim\/systems\/boards/];
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
      });
    for (const file of [...walk('src/render'), ...walk('src/ui'), ...walk('src/platform')]) {
      const src = readFileSync(file, 'utf8');
      for (const re of forbidden) expect(re.test(src), `${file} imports ${re}`).toBe(false);
    }
  });
});
