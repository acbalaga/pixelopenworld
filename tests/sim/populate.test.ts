import { describe, expect, it } from 'vitest';
import { createDemoState, deserializeState, serializeState } from '../../src/sim/state';
import { query } from '../../src/sim/kernel/entities';
import { populateMap, type MapObject } from '../../src/sim/world/populate';

const BASE: MapObject[] = [
  { kind: 'fixture.anvil', tx: 10, ty: 10 },
  { kind: 'node.herb_patch', tx: 12, ty: 10 },
  { kind: 'npc.cook', tx: 14, ty: 10 },
  { kind: 'prop.camp_pot', tx: 16, ty: 10 },
  { kind: 'spawner.mossling', tx: 20, ty: 20 },
];

const all = (s: ReturnType<typeof createDemoState>): number => query(s.entities, 'pos').length;
const opts = { spawners: true, onlyMissing: true };

/** A game as it was saved by an older build: populated, played a little, written out, read back. */
function savedGame(): ReturnType<typeof createDemoState> {
  const s = createDemoState(5, 0);
  populateMap(s, BASE, { spawners: true, onlyMissing: false });
  return deserializeState(serializeState(s));
}

describe('populateMap', () => {
  it('a new game gets every object', () => {
    const s = createDemoState(5, 0);
    expect(populateMap(s, BASE, { spawners: true, onlyMissing: false })).toBe(5);
    expect(all(s)).toBe(5);
  });

  it('spawners can be left out', () => {
    const s = createDemoState(5, 0);
    expect(populateMap(s, BASE, { spawners: false, onlyMissing: false })).toBe(4);
  });

  it('a loaded game that already has everything gains nothing, and its state is untouched', () => {
    const s = savedGame();
    const before = serializeState(s);
    expect(populateMap(s, BASE, opts)).toBe(0);
    expect(serializeState(s)).toBe(before);
  });

  it('a loaded game gains only what a newer build added', () => {
    const s = savedGame();
    const grown: MapObject[] = [
      ...BASE,
      { kind: 'fixture.anvil', tx: 30, ty: 10 },
      { kind: 'node.herb_patch', tx: 31, ty: 10 },
      { kind: 'npc.guard', tx: 32, ty: 10 },
      { kind: 'spawner.mossling', tx: 33, ty: 10 },
    ];
    expect(populateMap(s, grown, opts)).toBe(4);
    expect(all(s)).toBe(9);
    // Running it again adds nothing: it is safe on every launch.
    expect(populateMap(s, grown, opts)).toBe(0);
  });

  it('keeps what the player did to the world', () => {
    const s = savedGame();
    const [anvil] = query(s.entities, 'fixture');
    const f = s.entities.comps.fixture[anvil as number];
    if (f) f.open = true;
    const [node] = query(s.entities, 'node');
    const n = s.entities.comps.node[node as number];
    if (n) n.readyAt = 999;
    populateMap(s, BASE, opts);
    expect(s.entities.comps.fixture[anvil as number]?.open).toBe(true);
    expect(s.entities.comps.node[node as number]?.readyAt).toBe(999);
  });

  it('a person who walked away from their tile is not added a second time', () => {
    const s = savedGame();
    const [cook] = query(s.entities, 'npc');
    const p = s.entities.comps.pos[cook as number];
    if (p) p.x += 5000;
    expect(populateMap(s, BASE, opts)).toBe(0);
  });

  it('adds a second person of a kind only when the map has two', () => {
    const s = savedGame();
    const two = [...BASE, { kind: 'npc.cook', tx: 40, ty: 10 }];
    expect(populateMap(s, two, opts)).toBe(1);
    expect(populateMap(s, two, opts)).toBe(0);
  });

  it('ignores kinds the content does not know', () => {
    const s = createDemoState(5, 0);
    expect(
      populateMap(s, [{ kind: 'fixture.nope', tx: 1, ty: 1 }], { ...opts, onlyMissing: false }),
    ).toBe(0);
  });
});
