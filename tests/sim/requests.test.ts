import { describe, expect, it } from 'vitest';
import { REQUESTS } from '../../src/content/requests';
import type { RequestDef } from '../../src/content/requests/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { assign, learnTechnique } from '../../src/sim/combat/techniques';
import { countItem, give } from '../../src/sim/items';
import { holds, requestState, startNode } from '../../src/sim/journal';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { Dir, type Direction } from '../../src/sim/kernel/fixed';
import { renownIn } from '../../src/sim/renown';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { applyEffect, spawnNpc } from '../../src/sim/systems/npcs';
import { startRequest } from '../../src/sim/systems/requests';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...cmds: Command[]) => void;
  run: (n: number, ...cmds: Command[]) => void;
  count: (t: SimEvent['type']) => number;
}

/**
 * The avatar at tile (20, 20) facing east. `front` stands in front of them (tile 21, 20), the
 * other people of the slice stand around, never ahead.
 */
function rig(front?: string): Rig {
  const s = createDemoState(11, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  const events: SimEvent[] = [];
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds });
    events.push(...s.events.list);
  };
  const run = (n: number, ...cmds: Command[]): void => {
    for (let i = 0; i < n; i++) tick(...(i === 0 ? cmds : []));
  };
  const others: [string, number, number][] = [
    ['npc.guard', 19, 20],
    ['npc.scholar', 20, 19],
    ['npc.cook', 20, 21],
    ['npc.shopkeeper', 18, 20],
    ['npc.pilgrim', 20, 22],
  ];
  for (const [id, x, y] of others) if (id !== front) spawnNpc(s, id, x, y);
  if (front) spawnNpc(s, front, 21, 20);
  tick({ type: 'scheme', scheme: 'classic' });
  run(2, { type: 'move', dir: Dir.E as Direction });
  run(3, { type: 'move', dir: null });
  events.length = 0;
  return { s, me, events, tick, run, count: (t) => events.filter((e) => e.type === t).length };
}

const journal = (r: Rig): NonNullable<SimState['entities']['comps']['journal'][number]> =>
  r.s.entities.comps.journal[r.me]!;
const state = (r: Rig, id: string): ReturnType<typeof requestState> => requestState(journal(r), id);
const say = (npc: string, node: string, choice: number): Command => ({
  type: 'talk',
  npc,
  node,
  choice,
});

/** Puts one creature in front of the avatar at 1 hp and fights until it falls. */
function kill(r: Rig, kind: string): void {
  const id = spawnCreature(r.s, kind, 20 * 16 + 8 + 14, 20 * 16 + 14, -1);
  r.s.entities.comps.ai[id] = null;
  const pools = r.s.entities.comps.pools[id];
  if (pools) pools.hp = 1;
  const before = r.count('died');
  for (let i = 0; i < 160 && r.count('died') === before; i++)
    r.tick(i % 12 === 2 ? { type: 'attack' } : { type: 'move', dir: null });
  expect(r.count('died'), `${kind} falls`).toBe(before + 1);
}

/** Talks to whoever is in front: the context button, which hands over deliveries. */
const talkToFront = (r: Rig): void => r.run(2, { type: 'interact' });

/** Takes the request through its giver's own dialogue, then turns it in through it. */
function take(r: Rig, npc: string, ask: [string, number]): void {
  r.tick(say(npc, ask[0], ask[1]));
}
function turnIn(r: Rig, npc: string): void {
  const node = startNode(r.s, r.me, npc);
  expect(node, `${npc} offers a turn-in`).toMatch(/report/);
  r.tick(say(npc, node as string, -1));
}

describe('authored requests: each solution finishes the request', () => {
  it('Pests in the meadow: defeat 4 Mosslings', () => {
    const r = rig();
    take(r, 'npc.guard', ['ask', 0]);
    expect(state(r, 'request.clear_pests')).toBe('active');
    for (let i = 0; i < 4; i++) kill(r, 'creature.mossling');
    expect(state(r, 'request.clear_pests')).toBe('ready');
    expect(journal(r).requests['request.clear_pests']?.solution).toBe('defeat');
    turnIn(r, 'npc.guard');
    expect(state(r, 'request.clear_pests')).toBe('done');
  });

  it('A seed that holds fire: defeat 2 Spitblooms', () => {
    const r = rig();
    take(r, 'npc.scholar', ['ask', 0]);
    kill(r, 'creature.spitbloom');
    expect(state(r, 'request.ember_pods')).toBe('active');
    kill(r, 'creature.spitbloom');
    expect(state(r, 'request.ember_pods')).toBe('ready');
    turnIn(r, 'npc.scholar');
    expect(state(r, 'request.ember_pods')).toBe('done');
  });

  it('Oil for the old lamps: bring 2 lantern oil to Wren', () => {
    const r = rig('npc.scholar');
    take(r, 'npc.scholar', ['lamps_ask', 0]);
    expect(state(r, 'request.old_lamps')).toBe('active');
    // One flask is not enough, and nothing is taken.
    give(r.s, r.me, 'item.lantern_oil', 1, 'start');
    talkToFront(r);
    expect(state(r, 'request.old_lamps')).toBe('active');
    expect(countItem(r.s.entities.comps.inventory[r.me]!, 'item.lantern_oil')).toBe(1);
    give(r.s, r.me, 'item.lantern_oil', 1, 'start');
    talkToFront(r);
    expect(state(r, 'request.old_lamps')).toBe('ready');
    expect(countItem(r.s.entities.comps.inventory[r.me]!, 'item.lantern_oil')).toBe(0);
    turnIn(r, 'npc.scholar');
    expect(state(r, 'request.old_lamps')).toBe('done');
  });

  it('The boar by the cave: defeat the Bramble Boar', () => {
    const r = rig();
    take(r, 'npc.guard', ['boar_ask', 0]);
    expect(state(r, 'request.cave_boar')).toBe('active');
    kill(r, 'creature.bramble_boar');
    expect(state(r, 'request.cave_boar')).toBe('ready');
    expect(journal(r).requests['request.cave_boar']?.solution).toBe('defeat');
    turnIn(r, 'npc.guard');
    expect(state(r, 'request.cave_boar')).toBe('done');
  });

  it('The boar by the cave: slip past and fetch the satchel', () => {
    const r = rig();
    spawnFixture(r.s, 'fixture.satchel', 21, 20);
    take(r, 'npc.guard', ['boar_ask', 0]);
    expect(state(r, 'request.cave_boar')).toBe('active');
    r.run(2, { type: 'interact' });
    expect(state(r, 'request.cave_boar')).toBe('ready');
    expect(journal(r).requests['request.cave_boar']?.solution).toBe('hide');
    turnIn(r, 'npc.guard');
    expect(state(r, 'request.cave_boar')).toBe('done');
  });

  it('a satchel taken before the request was accepted still counts', () => {
    const r = rig();
    spawnFixture(r.s, 'fixture.satchel', 21, 20);
    r.run(2, { type: 'interact' });
    expect(journal(r).flags).toContain('flag.satchel_taken');
    take(r, 'npc.guard', ['boar_ask', 0]);
    expect(state(r, 'request.cave_boar')).toBe('ready');
  });

  it.each([
    ['stew', 'item.hearty_stew', 3],
    ['skewers', 'item.herbed_skewer', 5],
  ] as const)('Supper for the watch: bring %s to Hesper', (sol, item, qty) => {
    const r = rig('npc.cook');
    take(r, 'npc.cook', ['supper_ask', 0]);
    // The cook starts at the greeting when never met, so the ask node is reached by choice.
    expect(state(r, 'request.watch_supper')).toBe('active');
    give(r.s, r.me, item, qty - 1, 'start');
    talkToFront(r);
    expect(state(r, 'request.watch_supper')).toBe('active');
    give(r.s, r.me, item, 1, 'start');
    talkToFront(r);
    expect(state(r, 'request.watch_supper')).toBe('ready');
    expect(journal(r).requests['request.watch_supper']?.solution).toBe(sol);
    turnIn(r, 'npc.cook');
    expect(state(r, 'request.watch_supper')).toBe('done');
  });

  it.each([
    ['ore', 'item.copper_ore', 6],
    ['ingots', 'item.copper_ingot', 2],
  ] as const)('Metal for the anvil: bring copper %s to Brin', (sol, item, qty) => {
    const r = rig('npc.shopkeeper');
    take(r, 'npc.shopkeeper', ['anvil_ask', 0]);
    expect(state(r, 'request.anvil_metal')).toBe('active');
    give(r.s, r.me, item, qty, 'start');
    talkToFront(r);
    expect(state(r, 'request.anvil_metal')).toBe('ready');
    expect(journal(r).requests['request.anvil_metal']?.solution).toBe(sol);
    turnIn(r, 'npc.shopkeeper');
    expect(state(r, 'request.anvil_metal')).toBe('done');
  });

  it('Something in the deep room: defeat 3 Spitblooms', () => {
    const r = rig();
    take(r, 'npc.pilgrim', ['deep_ask', 0]);
    expect(state(r, 'request.deep_room')).toBe('active');
    for (let i = 0; i < 3; i++) kill(r, 'creature.spitbloom');
    expect(state(r, 'request.deep_room')).toBe('ready');
    expect(journal(r).requests['request.deep_room']?.solution).toBe('defeat');
    turnIn(r, 'npc.pilgrim');
    expect(state(r, 'request.deep_room')).toBe('done');
  });

  it('Something in the deep room: finish the Hum of Courage', () => {
    const r = rig();
    take(r, 'npc.pilgrim', ['deep_ask', 0]);
    r.s.entities.comps.skills[r.me]!.points['skill.performance'] = 1;
    learnTechnique(r.s, r.me, 'technique.performance_hum');
    expect(assign(r.s, r.me, 1, 'technique.performance_hum')).toBe(true);
    const pools = r.s.entities.comps.pools[r.me]!;
    pools.foc = pools.focMax;
    // Starting the song is not finishing it.
    r.run(2, { type: 'technique', slot: 1, phase: 'press', aim: null });
    expect(state(r, 'request.deep_room')).toBe('active');
    r.run(100);
    expect(r.count('perform')).toBe(1);
    expect(state(r, 'request.deep_room')).toBe('ready');
    expect(journal(r).requests['request.deep_room']?.solution).toBe('sing');
    turnIn(r, 'npc.pilgrim');
    expect(state(r, 'request.deep_room')).toBe('done');
  });

  it('rewards: coin, items, technique and Renown, once', () => {
    const r = rig();
    take(r, 'npc.guard', ['ask', 0]);
    for (let i = 0; i < 4; i++) kill(r, 'creature.mossling');
    const coin0 = r.s.entities.comps.avatar[r.me]!.coin;
    turnIn(r, 'npc.guard');
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(coin0 + 50);
    expect(countItem(r.s.entities.comps.inventory[r.me]!, 'item.ring_copper')).toBe(1);
    expect(renownIn(r.s, r.me, 'dawnmeadow')).toBe(2);
    r.tick(say('npc.guard', 'report', -1));
    expect(renownIn(r.s, r.me, 'dawnmeadow')).toBe(2);
    expect(r.s.ledger.coinEarned.request).toBe(50);
  });
});

describe('the engine', () => {
  const two: RequestDef = {
    id: 'request.test_two',
    giver: { board: 'board.square' },
    // Not in the content tables, so it carries its own definition like a standing request.
    kind: 'standing',
    region: 'dawnmeadow',
    titleKey: 'request.clear_pests.title',
    askKey: 'request.clear_pests.ask',
    solutions: [
      {
        id: 'a',
        labelKey: 'request.clear_pests.defeat',
        steps: [
          { kind: 'talk', npc: 'npc.scholar' },
          { kind: 'flag', flag: 'flag.test_two' },
        ],
      },
    ],
    reward: { coin: 5, items: [], renown: 1 },
    estMinutes: 1,
  };

  it('steps run in order: a later step does not count before the earlier one', () => {
    const r = rig('npc.scholar');
    journal(r).flags.push('flag.test_two');
    expect(startRequest(r.s, r.me, two)).toBe(true);
    // The flag is already set, but the talk step comes first.
    expect(journal(r).requests['request.test_two']?.state).toBe('active');
    talkToFront(r);
    expect(journal(r).requests['request.test_two']?.state).toBe('ready');
  });

  it('a request taken twice, or with unmet requirements, is refused', () => {
    const r = rig();
    expect(startRequest(r.s, r.me, REQUESTS['request.clear_pests']!)).toBe(true);
    expect(startRequest(r.s, r.me, REQUESTS['request.clear_pests']!)).toBe(false);
    const gated: RequestDef = { ...two, id: 'request.gated', requires: [{ flag: 'nope' }] };
    expect(startRequest(r.s, r.me, gated)).toBe(false);
  });

  it('a finished request that repeats can be taken again after its cooldown', () => {
    const r = rig();
    const rep: RequestDef = { ...two, id: 'request.rep', repeat: { cooldownDays: 2 } };
    journal(r).flags.push('flag.test_two');
    r.run(1);
    const both: RequestDef = {
      ...rep,
      solutions: [{ ...two.solutions[0]!, steps: [{ kind: 'flag', flag: 'flag.test_two' }] }],
    };
    expect(startRequest(r.s, r.me, both)).toBe(true);
    expect(journal(r).requests['request.rep']?.state).toBe('ready');
    // Turn it in by hand through the engine.
    r.s.entities.comps.journal[r.me]!.requests['request.rep']!.state = 'done';
    r.s.entities.comps.journal[r.me]!.requests['request.rep']!.doneDay = 0;
    expect(startRequest(r.s, r.me, both)).toBe(false);
    stepWorld(r.s, r.me, { commands: [], worldTick: 3 * 48 * 1800 });
    expect(startRequest(r.s, r.me, both)).toBe(true);
  });

  it('too many requests at once are refused', () => {
    const r = rig();
    for (let i = 0; i < 8; i++)
      expect(startRequest(r.s, r.me, { ...two, id: `request.many${i}` })).toBe(true);
    expect(startRequest(r.s, r.me, { ...two, id: 'request.many8' })).toBe(false);
  });

  it('pinning needs a request under way, and one is pinned at a time', () => {
    const r = rig();
    r.tick({ type: 'pinRequest', id: 'request.clear_pests' });
    expect(journal(r).pinned).toBeNull();
    startRequest(r.s, r.me, REQUESTS['request.clear_pests']!);
    startRequest(r.s, r.me, REQUESTS['request.ember_pods']!);
    r.tick({ type: 'pinRequest', id: 'request.clear_pests' });
    r.tick({ type: 'pinRequest', id: 'request.ember_pods' });
    expect(journal(r).pinned).toBe('request.ember_pods');
    r.tick({ type: 'pinRequest', id: null });
    expect(journal(r).pinned).toBeNull();
  });
});

describe('dialogue v2', () => {
  it('conditions read the phase, season, weather and Renown', () => {
    const r = rig();
    r.tick();
    expect(holds(r.s, r.me, [{ phase: ['day'] }])).toBe(true);
    expect(holds(r.s, r.me, [{ phase: ['night', 'dusk'] }])).toBe(false);
    expect(holds(r.s, r.me, [{ season: ['spring'] }])).toBe(true);
    expect(holds(r.s, r.me, [{ season: ['winter'] }])).toBe(false);
    expect(holds(r.s, r.me, [{ weather: ['clear'] }])).toBe(true);
    expect(holds(r.s, r.me, [{ weather: ['rain', 'storm'] }])).toBe(false);
    const need = { renown: { region: 'dawnmeadow', atLeast: 2 } };
    expect(holds(r.s, r.me, [need])).toBe(false);
    journal(r).renown.dawnmeadow = 2;
    expect(holds(r.s, r.me, [need])).toBe(true);
  });

  it('effects raise Renown and take items only when the bag holds them', () => {
    const r = rig();
    applyEffect(r.s, r.me, { renown: 3 });
    expect(renownIn(r.s, r.me, 'dawnmeadow')).toBe(3);
    give(r.s, r.me, 'item.lantern_oil', 1, 'start');
    applyEffect(r.s, r.me, { takeItem: 'item.lantern_oil', qty: 2 });
    expect(countItem(r.s.entities.comps.inventory[r.me]!, 'item.lantern_oil')).toBe(1);
    applyEffect(r.s, r.me, { takeItem: 'item.lantern_oil', qty: 1 });
    expect(countItem(r.s.entities.comps.inventory[r.me]!, 'item.lantern_oil')).toBe(0);
  });
});
