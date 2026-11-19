import { describe, expect, it } from 'vitest';
import { createAvatar } from '../../src/sim/avatar';
import { getComp, query } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, deserializeState, hashState, serializeState } from '../../src/sim/state';
import { createChunk, type Chunk } from '../../src/sim/world/chunk';
import {
  CHUNK_PX,
  ACTIVE_RADIUS,
  LOADED_RADIUS,
  chunkKey,
  loadOrder,
} from '../../src/sim/world/window';
import { newStream, streamSystem, frozenAt } from '../../src/sim/world/stream';
import { TileWorld } from '../../src/sim/world/world';
import { aiSystem } from '../../src/sim/systems/ai';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { findAvatar } from '../../src/shared/summary';
import { SPAWNERS } from '../../src/content/creatures';
import { kill } from '../../src/sim/combat/fighter';
import { spawnerSystem } from '../../src/sim/systems/spawner';
import { dayIndex } from '../../src/sim/time';

/** A strip of chunks along x, each with a chest and a herb patch at known tiles. */
function strip(n: number): TileWorld {
  const chunks: Chunk[] = [];
  for (let cx = 0; cx < n; cx++) {
    const c = createChunk(cx, 0);
    c.objects.push({ x: 4, y: 4, kind: 'fixture.chest_side' });
    c.objects.push({ x: 8, y: 4, kind: 'node.herb_patch' });
    chunks.push(c);
  }
  return new TileWorld(chunks);
}

function game(n: number, atChunk: number) {
  const s = createDemoState(7, 0);
  const w = strip(n);
  s.world = w;
  s.stream = newStream(w, false);
  createAvatar(s, px(atChunk * CHUNK_PX + 100), px(100));
  return s;
}

function moveTo(s: ReturnType<typeof game>, chunk: number): void {
  const p = getComp(s.entities, findAvatar(s)!, 'pos')!;
  p.x = px(chunk * CHUNK_PX + 100);
}

const fixtures = (s: ReturnType<typeof game>): number => query(s.entities, 'fixture').length;
const nodes = (s: ReturnType<typeof game>): number => query(s.entities, 'node').length;

describe('streaming windows', () => {
  it('orders the load active ring first, then ahead of travel', () => {
    const order = loadOrder(10, 10, 1, 0);
    expect(order).toHaveLength((2 * LOADED_RADIUS + 1) ** 2);
    expect(order[0]).toEqual({ cx: 10, cy: 10 });
    expect(order[1]).toEqual({ cx: 11, cy: 10 });
    const ring = (i: number): number =>
      Math.max(
        Math.abs((order[i] as { cx: number }).cx - 10),
        Math.abs((order[i] as { cy: number }).cy - 10),
      );
    const inner = (2 * ACTIVE_RADIUS + 1) ** 2;
    for (let i = 0; i < inner; i++) expect(ring(i)).toBeLessThanOrEqual(ACTIVE_RADIUS);
    for (let i = inner; i < order.length; i++) expect(ring(i)).toBe(LOADED_RADIUS);
    // Within the outer ring, the chunks ahead (cx = 12) come before the ones behind (cx = 8).
    const firstAhead = order.findIndex((c, i) => i >= inner && c.cx === 12);
    const firstBehind = order.findIndex((c, i) => i >= inner && c.cx === 8);
    expect(firstAhead).toBeLessThan(firstBehind);
  });
});

describe('entity streaming', () => {
  it('places objects only in the loaded window and removes them as it moves on', () => {
    const s = game(12, 0);
    streamSystem(s);
    // Window around chunk 0 covers chunks 0..2 (negative chunks are not loaded).
    expect(fixtures(s)).toBe(3);
    expect(nodes(s)).toBe(3);
    moveTo(s, 6);
    streamSystem(s);
    expect(fixtures(s)).toBe(5);
    expect(s.stream!.live.has(chunkKey(0, 0))).toBe(false);
    expect(s.stream!.live.has(chunkKey(8, 0))).toBe(true);
  });

  it('keeps what the player did across unload and reload of a chunk', () => {
    const s = game(12, 0);
    streamSystem(s);
    const c = s.entities.comps;
    const chest = query(s.entities, 'fixture').find(
      (i) => c.fixture[i]!.home.x === px(4 * 16 + 8),
    )!;
    c.fixture[chest]!.open = true;
    const herb = query(s.entities, 'node').find((i) => c.pos[i]!.x === px(8 * 16 + 8))!;
    s.worldTick = 100;
    c.node[herb]!.readyAt = 5000;
    moveTo(s, 8);
    streamSystem(s);
    expect(s.deltas[chunkKey(0, 0)]).toBeDefined();
    expect(Object.keys(s.deltas[chunkKey(0, 0)]!.objects)).toHaveLength(2);
    expect(s.deltas[chunkKey(1, 0)]).toBeUndefined();
    moveTo(s, 0);
    streamSystem(s);
    const chest2 = query(s.entities, 'fixture').find(
      (i) => c.fixture[i]!.home.x === px(4 * 16 + 8),
    )!;
    expect(c.fixture[chest2]!.open).toBe(true);
    const herb2 = query(s.entities, 'node').find((i) => c.pos[i]!.x === px(8 * 16 + 8))!;
    expect(c.node[herb2]!.readyAt).toBe(5000);
  });

  it('forgets a node whose respawn has passed, so untouched chunks cost nothing', () => {
    const s = game(12, 0);
    streamSystem(s);
    const c = s.entities.comps;
    const herb = query(s.entities, 'node')[0]!;
    c.node[herb]!.readyAt = 50;
    s.worldTick = 60;
    moveTo(s, 8);
    streamSystem(s);
    expect(Object.keys(s.deltas)).toHaveLength(0);
  });

  it('survives a save: deltas round trip and a restored game does not double its objects', () => {
    const s = game(12, 0);
    streamSystem(s);
    const c = s.entities.comps;
    c.fixture[query(s.entities, 'fixture')[0]!]!.open = true;
    moveTo(s, 8);
    streamSystem(s);
    const back = deserializeState(serializeState(s));
    expect(back.deltas).toEqual(s.deltas);
    expect(hashState(back)).toBe(hashState(s));
    back.world = s.world;
    back.stream = newStream(s.world as TileWorld, false);
    streamSystem(back);
    moveTo(back, 0);
    streamSystem(back);
    expect(fixtures(back)).toBe(3);
  });

  it('waits for a chunk that has not arrived and places it when it does', () => {
    const s = game(12, 0);
    const late = (s.world as TileWorld).chunk(1, 0)!;
    const w = new TileWorld([...[0, 2].map((cx) => (s.world as TileWorld).chunk(cx, 0)!)]);
    s.world = w;
    s.stream = newStream(w, false);
    streamSystem(s);
    expect(fixtures(s)).toBe(2);
    expect(s.stream.pending).toBe(true);
    w.set(late);
    streamSystem(s);
    expect(fixtures(s)).toBe(3);
  });

  it('freezes creatures outside the active window', () => {
    const s = game(12, 0);
    streamSystem(s);
    const near = spawnCreature(s, 'creature.mossling', 3 * 16, 100);
    const far = spawnCreature(s, 'creature.mossling', 2 * CHUNK_PX + 40, 100);
    expect(frozenAt(s, getComp(s.entities, near, 'pos')!.x, 0)).toBe(false);
    expect(
      frozenAt(s, getComp(s.entities, far, 'pos')!.x, getComp(s.entities, far, 'pos')!.y),
    ).toBe(true);
    const before = hashState(s);
    aiSystem(s);
    expect(getComp(s.entities, far, 'ai')!.t).toBe(0);
    expect(hashState(s)).not.toBe(before);
  });
});

describe('daily spawners across a chunk leaving and returning', () => {
  it('a crew cleared today stays cleared, and a new day brings it back', () => {
    (SPAWNERS as Record<string, unknown>)['spawner.test_daily2'] = {
      kind: 'spawner.test_daily2',
      creature: 'creature.mossling',
      cap: 1,
      respawn: 1,
      radius: 0,
      daily: true,
    };
    const chunks: Chunk[] = [];
    for (let cx = 0; cx < 12; cx++) {
      const c = createChunk(cx, 0);
      if (cx === 0) c.objects.push({ x: 8, y: 8, kind: 'spawner.test_daily2' });
      chunks.push(c);
    }
    const s = createDemoState(7, 0);
    const w = new TileWorld(chunks);
    s.world = w;
    s.stream = newStream(w, true);
    createAvatar(s, px(100), px(100));
    s.worldTick = 5;
    streamSystem(s);
    const sp = query(s.entities, 'spawner')[0]!;
    spawnerSystem(s);
    spawnerSystem(s);
    const sc = getComp(s.entities, sp, 'spawner')!;
    kill(s, sc.members[0] as number);
    spawnerSystem(s);
    expect(sc.clearedDay).toBe(dayIndex(5));
    // Walk away so the chunk unloads, then come back the same day: still cleared.
    moveTo(s as ReturnType<typeof game>, 9);
    streamSystem(s);
    expect(query(s.entities, 'spawner')).toHaveLength(0);
    moveTo(s as ReturnType<typeof game>, 0);
    streamSystem(s);
    const back = query(s.entities, 'spawner')[0]!;
    spawnerSystem(s);
    spawnerSystem(s);
    expect(getComp(s.entities, back, 'spawner')!.members).toHaveLength(0);
    // The next day it fills.
    let t = 5;
    while (dayIndex(t) === dayIndex(5)) t += 50;
    s.worldTick = t;
    spawnerSystem(s);
    spawnerSystem(s);
    expect(getComp(s.entities, back, 'spawner')!.members).toHaveLength(1);
  });
});
