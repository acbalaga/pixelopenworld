import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/content/items';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { emit } from '../../src/sim/kernel/events';
import { pointsOf, xpToNext } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { skillsSystem } from '../../src/sim/systems/skills';
import { FIXTURES } from '../../src/content/world/fixtures';
import { loadDawnmeadow } from '../../tools/endurance-bot/world';

const SKILL = 'skill.deciphering';
/** Every tablet in the baked Dawnmeadow, as kind and tile. */
const TABLETS = loadDawnmeadow().objects.filter((o) => FIXTURES[o.kind]?.type === 'tablet');
const MANUALS = Object.values(ITEMS).filter((i) => i.manual);

function rig(): { s: SimState; me: number; ids: number[] } {
  const s = createDemoState(51, 0);
  s.world = { solidAt: () => 0 };
  const f = feetAt(5, 5);
  const me = createAvatar(s, f.x, f.y);
  // The baked tiles are far apart. The sim only needs each tablet's kind and home tile.
  const ids = TABLETS.map((t) => spawnFixture(s, t.kind, t.x, t.y));
  return { s, me, ids };
}

function read(s: SimState, me: number, id: number): void {
  s.events.list.length = 0;
  emit(s.events, { type: 'tabletRead', id, who: me });
  skillsSystem(s);
}

const xpOf = (s: SimState): number => s.ledger.xpEarned[SKILL] ?? 0;

describe('Deciphering (POW-M4-23E)', () => {
  it('has the tablets and manuals the tunables were set for', () => {
    expect(TABLETS).toHaveLength(7);
    expect(MANUALS).toHaveLength(11);
  });

  it('reaches 14 with a full bar by reading every tablet at every band and every manual', () => {
    const { s, me, ids } = rig();
    for (const m of MANUALS) {
      s.events.list.length = 0;
      emit(s.events, { type: 'manualRead', who: me, item: m.id, technique: 'technique.x' });
      skillsSystem(s);
    }
    for (let round = 0; round < 40; round++) {
      for (const id of ids) read(s, me, id);
      if (
        pointsOf(s, me, SKILL) >= 14 &&
        (s.entities.comps.skills[me]!.xp[SKILL] ?? 0) >= xpToNext(14)
      )
        break;
    }
    expect(pointsOf(s, me, SKILL)).toBe(14);
    expect(s.entities.comps.skills[me]!.xp[SKILL]).toBeGreaterThanOrEqual(xpToNext(14));
  });

  it('pays a tablet once in a band, and again after the reader crosses into a new one', () => {
    const { s, me, ids } = rig();
    const first = ids[0]!;
    read(s, me, first);
    const paid = xpOf(s);
    expect(paid).toBeGreaterThan(0);
    read(s, me, first);
    expect(xpOf(s)).toBe(paid);
    // Another tablet pays on its own placement, even of the same kind elsewhere.
    read(s, me, ids[1]!);
    expect(xpOf(s)).toBeGreaterThan(paid);
    // Points rise into the next band: the first tablet pays again.
    s.entities.comps.skills[me]!.points[SKILL] = 1;
    const before = xpOf(s);
    read(s, me, first);
    expect(xpOf(s)).toBeGreaterThan(before);
  });

  it('pays a manual once', () => {
    const { s, me } = rig();
    const item = MANUALS[0]!.id;
    const go = (): void => {
      s.events.list.length = 0;
      emit(s.events, { type: 'manualRead', who: me, item, technique: 'technique.x' });
      skillsSystem(s);
    };
    go();
    const paid = xpOf(s);
    expect(paid).toBeGreaterThan(0);
    go();
    expect(xpOf(s)).toBe(paid);
  });
});
