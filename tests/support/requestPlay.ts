import { expect } from 'vitest';
import type { AuthoredRequest } from '../../src/content/requests/dawnmeadow';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { assign, learnTechnique } from '../../src/sim/combat/techniques';
import { countItem, give } from '../../src/sim/items';
import { requestState, startNode } from '../../src/sim/journal';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { Dir, SUBPX, type Direction } from '../../src/sim/kernel/fixed';
import { addRenown, renownIn } from '../../src/sim/renown';
import { awaken } from '../../src/sim/skills';
import type { Cond } from '../../src/content/dialogue/types';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { PLACES } from '../../src/content/people/places';
import { dayPhase } from '../../src/sim/time';
import { destroy } from '../../src/sim/kernel/entities';
import { emit } from '../../src/sim/kernel/events';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { requestsSystem } from '../../src/sim/systems/requests';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};

/** A world tick that falls at night, for requests that count only after dark. */
export const NIGHT_TICK = 34 * 1800 + 200;

export interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...c: Command[]) => void;
  run: (n: number, ...c: Command[]) => void;
  /** Puts `npc` in front of the avatar, replacing whoever stood there. */
  front: (npc: string) => void;
}

/** The avatar at tile (20, 20) facing east. `giver` stands behind them; whoever is wanted ahead is `front`. */
export function rig(giver: string, night = false): Rig {
  const s = createDemoState(11, 0);
  s.world = OPEN;
  if (night) s.tick = NIGHT_TICK;
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
  const placed = new Map<string, number>();
  const at = (e: number, tx: number): void => {
    const p = s.entities.comps.pos[e]!;
    p.x = (tx * 16 + 8) * 256;
    p.y = (20 * 16 + 14) * 256;
  };
  const front = (npc: string): void => {
    // Everyone else steps well away, so the context button finds only this one.
    for (const [id, e] of placed) if (id !== npc) at(e, 5);
    const old = placed.get(npc);
    if (old !== undefined) at(old, 21);
    else placed.set(npc, spawnNpc(s, npc, 21, 20));
  };
  front(giver);
  tick({ type: 'scheme', scheme: 'classic' });
  run(2, { type: 'move', dir: Dir.E as Direction });
  run(3, { type: 'move', dir: null });
  events.length = 0;
  return { s, me, events, tick, run, front };
}

export const journal = (r: Rig) => r.s.entities.comps.journal[r.me]!;
export const state = (r: Rig, id: string) => requestState(journal(r), id);
export const say = (npc: string, node: string, choice: number): Command => ({
  type: 'talk',
  npc,
  node,
  choice,
});

/** A creature a hand's width past the avatar, at 1 Health and with no brain, so one hit ends it. */
export function kill(r: Rig, kind: string): void {
  const id = spawnCreature(r.s, kind, 20 * 16 + 8 + 14, 20 * 16 + 14, -1);
  r.s.entities.comps.ai[id] = null;
  r.s.entities.comps.pools[id]!.hp = 1;
  const before = r.events.filter((e) => e.type === 'died').length;
  for (let i = 0; i < 200 && r.events.filter((e) => e.type === 'died').length === before; i++)
    r.tick(i % 12 === 2 ? { type: 'attack' } : { type: 'move', dir: null });
}

/** Does the work of one way of a request, as a player would. Leaves it ready to turn in. */
export function playWay(r: Rig, a: AuthoredRequest, wayId: string): void {
  const id = `request.${a.key}`;
  const way = a.ways.find((w) => w.id === wayId)!;
  for (const o of way.steps) {
    if (o.kind === 'deliver') {
      const inv = r.s.entities.comps.inventory[r.me]!;
      r.front(o.to);
      // Whatever the starter kit holds of it does not count towards the ask.
      inv.slots.forEach((st, i) => {
        if (st?.item === o.item) inv.slots[i] = null;
      });
      const q = o.minQuality ? { q: o.minQuality } : undefined;
      if (o.qty > 1) {
        // Short by one: nothing is taken and the request is still open.
        give(r.s, r.me, o.item, o.qty - 1, 'start', q);
        r.run(2, { type: 'interact' });
        expect(state(r, id)).toBe('active');
        expect(countItem(inv, o.item)).toBe(o.qty - 1);
        give(r.s, r.me, o.item, 1, 'start', q);
      } else {
        // A Common one does not meet a Fine ask.
        if (o.minQuality) {
          give(r.s, r.me, o.item, 1, 'start');
          r.run(2, { type: 'interact' });
          expect(state(r, id)).toBe('active');
          expect(countItem(inv, o.item)).toBe(1);
          inv.slots.forEach((st, i) => {
            if (st?.item === o.item) inv.slots[i] = null;
          });
        }
        give(r.s, r.me, o.item, 1, 'start', q);
      }
      r.run(2, { type: 'interact' });
    } else if (o.kind === 'talk') {
      r.front(o.npc);
      r.run(2, { type: 'interact' });
    } else if (o.kind === 'defeat') {
      for (let i = 0; i < o.count; i++) kill(r, o.creature ?? 'creature.mossling');
    } else if (o.kind === 'feed') {
      give(r.s, r.me, 'item.berry_red', 1, 'start');
      spawnCreature(r.s, o.creature!, 20 * 16 + 8 + 14, 20 * 16 + 14, -1);
      const slot = r.s.entities.comps.inventory[r.me]!.slots.findIndex(
        (x) => x?.item === 'item.berry_red',
      );
      r.tick({ type: 'feed', slot });
    } else if (o.kind === 'perform') {
      r.s.entities.comps.skills[r.me]!.points['skill.performance'] = 1;
      learnTechnique(r.s, r.me, o.technique!);
      assign(r.s, r.me, 1, o.technique!);
      const pools = r.s.entities.comps.pools[r.me]!;
      pools.foc = pools.focMax;
      r.run(2, { type: 'technique', slot: 1, phase: 'press', aim: null });
      r.run(100);
    } else if (o.kind === 'reach') {
      // Touch the door, then come through it into the room, as the Trials code watches for.
      const at = r.s.entities.comps.pos[r.me]!;
      const door = spawnFixture(
        r.s,
        o.from,
        Math.floor(at.x / SUBPX / 16),
        Math.floor((at.y / SUBPX - 1) / 16),
      );
      // The request system alone: a full step would take the portal, which has nowhere to lead here.
      r.s.events.list.length = 0;
      r.s.tick++;
      requestsSystem(r.s);
      emit(r.s.events, { type: 'roomChanged', who: r.me, from: 'room.outside', to: o.room });
      requestsSystem(r.s);
      destroy(r.s.entities, door);
    } else if (o.kind === 'explore') {
      emit(r.s.events, { type: 'revealed', who: r.me, blocks: o.blocks });
      requestsSystem(r.s);
    } else if (o.kind === 'flag') {
      journal(r).flags.push(o.flag);
      r.run(2);
    } else if (o.kind === 'sell') {
      emit(r.s.events, {
        type: 'sold',
        who: r.me,
        item: 'item.oak_plank',
        qty: o.count,
        coin: 1,
        haggled: false,
      });
      requestsSystem(r.s);
    } else if (o.kind === 'read') {
      for (const kind of o.fixtures.slice(0, o.count)) {
        const id = spawnFixture(r.s, kind, 30, 30);
        r.s.events.list.length = 0;
        emit(r.s.events, { type: 'tabletRead', id, who: r.me });
        requestsSystem(r.s);
      }
    } else if (o.kind === 'carry') {
      const rect = PLACES[o.place]!.spot!.rect;
      const ticksPerMin = 1800;
      const before = r.s.worldTick;
      const home = { ...r.s.entities.comps.pos[r.me]! };
      for (let t = 0; t < 48 * ticksPerMin; t += ticksPerMin)
        if (!o.phases || o.phases.includes(dayPhase(t))) {
          r.s.worldTick = t;
          break;
        }
      r.s.entities.comps.pos[r.me] = {
        x: (rect.x * 16 + 8) * SUBPX,
        y: (rect.y * 16 + 8) * SUBPX,
      };
      r.s.events.list.length = 0;
      requestsSystem(r.s);
      r.s.worldTick = before;
      r.s.entities.comps.pos[r.me] = home;
    } else throw new Error(`unhandled step ${o.kind}`);
  }
}

/** Takes a request through its giver's work menu, plays one way, and turns it in. Checks the payout. */
/** Makes a request's requirements hold (skills awake, Renown earned), for tests that play the job itself. */
export function meet(r: Rig, requires: readonly Cond[] | undefined): void {
  for (const c of requires ?? []) {
    if ('awake' in c) awaken(r.s, r.me, c.awake);
    else if ('renown' in c) addRenown(r.s, r.me, c.renown.region, c.renown.atLeast);
  }
}

export function playRequest(r: Rig, a: AuthoredRequest, wayId: string): void {
  const id = `request.${a.key}`;
  meet(r, a.requires);
  r.front(a.giver);
  r.tick(say(a.giver, `${a.key}_ask`, 0));
  expect(state(r, id)).toBe('active');
  playWay(r, a, wayId);
  expect(state(r, id), 'ready after the work').toBe('ready');
  expect(journal(r).requests[id]?.solution).toBe(wayId);
  r.front(a.giver);
  const coin0 = r.s.entities.comps.avatar[r.me]!.coin;
  const renown0 = renownIn(r.s, r.me, 'dawnmeadow');
  const node = startNode(r.s, r.me, a.giver);
  expect(node, `${a.giver} takes it in`).toBe(`${a.key}_report`);
  r.tick(say(a.giver, node as string, -1));
  expect(state(r, id)).toBe('done');
  expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(coin0 + a.reward.coin);
  expect(renownIn(r.s, r.me, 'dawnmeadow')).toBeGreaterThanOrEqual(renown0 + a.reward.renown);
  for (const it of a.reward.items ?? [])
    expect(countItem(r.s.entities.comps.inventory[r.me]!, it.item)).toBeGreaterThanOrEqual(it.qty);
}
