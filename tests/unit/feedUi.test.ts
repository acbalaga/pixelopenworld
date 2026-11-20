import { describe, expect, it } from 'vitest';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { dirStep } from '../../src/sim/kernel/fixed';
import { addItem } from '../../src/sim/items';
import { createDemoState, type SimState } from '../../src/sim/state';
import { bestiaryView } from '../../src/ui/menu/bestiaryModel';
import { itemDetail } from '../../src/ui/menu/model';
import { stepWorld } from '../../src/sim/step';

function rig(): { s: SimState; me: number; place: (creature: string, px: number) => number } {
  const s = createDemoState(9, 0);
  s.world = { solidAt: () => 0 };
  const f = feetAt(30, 30);
  const me = createAvatar(s, f.x, f.y);
  return {
    s,
    me,
    place: (creature, dist) => {
      const a = s.entities.comps.avatar[me]!;
      const p = s.entities.comps.pos[me]!;
      const d = dirStep(a.facing);
      return spawnCreature(
        s,
        creature,
        Math.round(p.x / 256 + d.x * dist),
        Math.round(p.y / 256 + d.y * dist),
      );
    },
  };
}

const slotOf = (s: SimState, me: number, item: string): number =>
  s.entities.comps.inventory[me]!.slots.findIndex((x) => x?.item === item);

describe('feeding in the Bag and the Bestiary (M4-05)', () => {
  it('the Bag offers Feed only while a creature in reach would take that item', () => {
    const r = rig();
    const inv = r.s.entities.comps.inventory[r.me]!;
    addItem(inv, 'item.raw_meat', 1);
    const slot = slotOf(r.s, r.me, 'item.raw_meat');
    expect(itemDetail(r.s, r.me, slot)!.actions).not.toContain('feed');
    r.place('creature.moorhound', 16);
    expect(itemDetail(r.s, r.me, slot)!.actions).toEqual(['feed', 'drop']);
    // Cooked or raw, a food item that also feeds the avatar keeps its Use.
    addItem(inv, 'item.roast_meat', 1);
    const roast = slotOf(r.s, r.me, 'item.roast_meat');
    expect(itemDetail(r.s, r.me, roast)!.actions).toEqual(['use', 'feed', 'drop']);
  });

  it('shows the fed creature in the Bestiary as a friend', () => {
    const r = rig();
    addItem(r.s.entities.comps.inventory[r.me]!, 'item.raw_meat', 1);
    r.place('creature.moorhound', 16);
    expect(bestiaryView(r.s, r.me).rows).toEqual([]);
    stepWorld(r.s, r.me, {
      commands: [{ type: 'feed', slot: slotOf(r.s, r.me, 'item.raw_meat') }],
    });
    stepWorld(r.s, r.me, { commands: [] });
    expect(bestiaryView(r.s, r.me).rows[0]).toMatchObject({ name: 'Moorhound', befriended: true });
  });
});
