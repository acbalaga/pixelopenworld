import { describe, expect, it } from 'vitest';
import { AUTHORED } from '../../src/content/requests/dawnmeadow';
import { REQUESTS } from '../../src/content/requests';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { assign, learnTechnique } from '../../src/sim/combat/techniques';
import { countItem, give } from '../../src/sim/items';
import { requestState, startNode } from '../../src/sim/journal';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { Dir, type Direction } from '../../src/sim/kernel/fixed';
import { renownIn } from '../../src/sim/renown';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnNpc } from '../../src/sim/systems/npcs';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...c: Command[]) => void;
  run: (n: number, ...c: Command[]) => void;
}

/** The avatar at tile (20, 20) facing east, with `npc` in front of them. */
function rig(npc: string): Rig {
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
  spawnNpc(s, npc, 21, 20);
  tick({ type: 'scheme', scheme: 'classic' });
  run(2, { type: 'move', dir: Dir.E as Direction });
  run(3, { type: 'move', dir: null });
  events.length = 0;
  return { s, me, events, tick, run };
}

const journal = (r: Rig) => r.s.entities.comps.journal[r.me]!;
const state = (r: Rig, id: string) => requestState(journal(r), id);
const say = (npc: string, node: string, choice: number): Command => ({
  type: 'talk',
  npc,
  node,
  choice,
});

/** A creature a hand's width past the avatar, at 1 Health and with no brain, so one hit ends it. */
function kill(r: Rig, kind: string): void {
  const id = spawnCreature(r.s, kind, 20 * 16 + 8 + 14, 20 * 16 + 14, -1);
  r.s.entities.comps.ai[id] = null;
  r.s.entities.comps.pools[id]!.hp = 1;
  const before = r.events.filter((e) => e.type === 'died').length;
  for (let i = 0; i < 200 && r.events.filter((e) => e.type === 'died').length === before; i++)
    r.tick(i % 12 === 2 ? { type: 'attack' } : { type: 'move', dir: null });
}

describe('Dawnmeadow requests: every way of every one finishes it (M4-12)', () => {
  for (const a of AUTHORED) {
    for (const way of a.ways) {
      it(`${a.title}: ${way.label}`, () => {
        const id = `request.${a.key}`;
        const r = rig(a.giver);
        // Taken through the giver's own dialogue, at the work hub's offer.
        r.tick(say(a.giver, `${a.key}_ask`, 0));
        expect(state(r, id)).toBe('active');
        for (const o of way.steps) {
          if (o.kind === 'deliver') {
            const inv = r.s.entities.comps.inventory[r.me]!;
            // Whatever the starter kit holds of it does not count towards the ask.
            inv.slots.forEach((st, i) => {
              if (st?.item === o.item) inv.slots[i] = null;
            });
            // Short by one: nothing is taken and the request is still open.
            if (o.qty > 1) {
              give(
                r.s,
                r.me,
                o.item,
                o.qty - 1,
                'start',
                o.minQuality ? { q: o.minQuality } : undefined,
              );
              r.run(2, { type: 'interact' });
              expect(state(r, id)).toBe('active');
              expect(countItem(inv, o.item)).toBe(o.qty - 1);
              give(r.s, r.me, o.item, 1, 'start', o.minQuality ? { q: o.minQuality } : undefined);
            } else {
              // A Common one does not meet a Fine ask.
              if (o.minQuality) {
                give(r.s, r.me, o.item, 1, 'start');
                r.run(2, { type: 'interact' });
                expect(state(r, id)).toBe('active');
                expect(countItem(inv, o.item)).toBe(1);
                inv.slots.forEach(
                  (_, i) => (inv.slots[i] = inv.slots[i]?.item === o.item ? null : inv.slots[i]!),
                );
              }
              give(r.s, r.me, o.item, 1, 'start', o.minQuality ? { q: o.minQuality } : undefined);
            }
            r.run(2, { type: 'interact' });
          } else if (o.kind === 'defeat') {
            for (let i = 0; i < o.count; i++) kill(r, o.creature!);
          } else if (o.kind === 'feed') {
            const slotItem = 'item.berry_red';
            give(r.s, r.me, slotItem, 1, 'start');
            const c = spawnCreature(r.s, o.creature!, 20 * 16 + 8 + 14, 20 * 16 + 14, -1);
            void c;
            r.tick({
              type: 'feed',
              slot: r.s.entities.comps.inventory[r.me]!.slots.findIndex(
                (x) => x?.item === slotItem,
              ),
            });
          } else if (o.kind === 'perform') {
            r.s.entities.comps.skills[r.me]!.points['skill.performance'] = 1;
            learnTechnique(r.s, r.me, o.technique!);
            assign(r.s, r.me, 1, o.technique!);
            const pools = r.s.entities.comps.pools[r.me]!;
            pools.foc = pools.focMax;
            r.run(2, { type: 'technique', slot: 1, phase: 'press', aim: null });
            r.run(100);
          }
        }
        expect(state(r, id), 'ready after the work').toBe('ready');
        expect(journal(r).requests[id]?.solution).toBe(way.id);
        const coin0 = r.s.entities.comps.avatar[r.me]!.coin;
        const node = startNode(r.s, r.me, a.giver);
        expect(node, `${a.giver} takes it in`).toBe(`${a.key}_report`);
        r.tick(say(a.giver, node as string, -1));
        expect(state(r, id)).toBe('done');
        expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(coin0 + a.reward.coin);
        expect(renownIn(r.s, r.me, 'dawnmeadow')).toBeGreaterThanOrEqual(a.reward.renown);
      });
    }
  }
});

describe('Dawnmeadow requests: the table', () => {
  it('has fourteen new authored requests, each with a different id from the first map', () => {
    expect(AUTHORED).toHaveLength(14);
    for (const a of AUTHORED) expect(REQUESTS[`request.${a.key}`]?.kind).toBe('authored');
    expect(new Set(AUTHORED.map((a) => a.key)).size).toBe(14);
  });

  it('has at least eight with a way that needs no fighting, as regions/01 asks', () => {
    const quiet = AUTHORED.filter((a) =>
      a.ways.some((w) => w.steps.every((s) => s.kind !== 'defeat')),
    );
    expect(quiet.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps every title within 24 characters and every line free of em dashes', () => {
    for (const a of AUTHORED) {
      expect(a.title.length, a.key).toBeLessThanOrEqual(24);
      const all = [a.title, a.ask, ...a.ways.map((w) => w.label), ...Object.values(a.talk)].join(
        '\n',
      );
      expect(all, a.key).not.toMatch(/[—–]/);
    }
  });
});
