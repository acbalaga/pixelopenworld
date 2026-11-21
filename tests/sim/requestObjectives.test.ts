import { describe, expect, it } from 'vitest';
import { PAGE_SITES, REQUEST_VIGILS } from '../../src/content/pois/requestSites';
import { PLACES } from '../../src/content/people/places';
import { FIXTURES } from '../../src/content/world/fixtures';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { give } from '../../src/sim/items';
import { emit } from '../../src/sim/kernel/events';
import { destroy } from '../../src/sim/kernel/entities';
import { requestState } from '../../src/sim/journal';
import { startRequest } from '../../src/sim/systems/requests';
import { REQUESTS } from '../../src/content/requests';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { requestsSystem } from '../../src/sim/systems/requests';
import { SUBPX } from '../../src/sim/kernel/fixed';
import { CHUNK_TILES, Solid, decodeChunk } from '../../src/sim/world/chunk';
import { bakeRegion } from '../../tools/bake-world/bake';
import { rig, journal } from '../support/requestPlay';

const NIGHT = (() => {
  for (let t = 0; ; t += 1800) if (t % (48 * 1800) >= 40 * 1800) return t;
})();

describe('request objectives: sell, carry, read (M4-11)', () => {
  const begin = (key: string) => {
    const r = rig('npc.shopkeeper');
    expect(startRequest(r.s, r.me, REQUESTS[`request.${key}`]!)).toBe(true);
    return r;
  };
  const state = (r: ReturnType<typeof rig>, key: string) =>
    requestState(journal(r), `request.${key}`);
  const sold = (r: ReturnType<typeof rig>, item: string, qty: number): void => {
    r.s.events.list.length = 0;
    emit(r.s.events, { type: 'sold', who: r.me, item, qty, coin: 1, haggled: false });
    requestsSystem(r.s);
  };

  it('sell counts only goods a recipe makes, and finishes at the count', () => {
    const r = begin('stock_stalls');
    sold(r, 'item.river_pebble', 20);
    expect(state(r, 'stock_stalls')).toBe('active');
    sold(r, 'item.oak_plank', 6);
    sold(r, 'item.oak_plank', 3);
    expect(state(r, 'stock_stalls')).toBe('active');
    sold(r, 'item.oak_plank', 1);
    expect(state(r, 'stock_stalls')).toBe('ready');
  });

  it('read counts different tablets, and a tablet read twice counts once', () => {
    const r = begin('readings_wren');
    const read = (kind: string): void => {
      const id = spawnFixture(r.s, kind, 30, 30);
      r.s.events.list.length = 0;
      emit(r.s.events, { type: 'tabletRead', id, who: r.me });
      requestsSystem(r.s);
      destroy(r.s.entities, id);
    };
    read('fixture.m9_note_a');
    read('fixture.m9_note_a');
    read('fixture.tablet');
    read('fixture.m9_note_b');
    expect(state(r, 'readings_wren')).toBe('active');
    read('fixture.m9_note_d');
    expect(state(r, 'readings_wren')).toBe('ready');
  });

  it('carry hands over the letter only at the chapel, after dark', () => {
    const r = rig('npc.pilgrim');
    startRequest(r.s, r.me, REQUESTS['request.pilgrim_errand']!);
    const inv = r.s.entities.comps.inventory[r.me]!;
    expect(inv.slots.some((s) => s?.item === 'item.pilgrim_letter')).toBe(true);
    const rect = PLACES['wayside.chapel']!.spot!.rect;
    const at = (x: number, y: number): void => {
      r.s.entities.comps.pos[r.me] = { x: (x * 16 + 8) * SUBPX, y: (y * 16 + 8) * SUBPX };
      r.s.events.list.length = 0;
      requestsSystem(r.s);
    };
    // By day at the chapel, and at night away from it: nothing.
    r.s.worldTick = 0;
    at(rect.x, rect.y);
    expect(state(r, 'pilgrim_errand')).toBe('active');
    r.s.worldTick = NIGHT;
    at(rect.x + 40, rect.y);
    expect(state(r, 'pilgrim_errand')).toBe('active');
    at(rect.x, rect.y);
    expect(state(r, 'pilgrim_errand')).toBe('ready');
    expect(inv.slots.some((s) => s?.item === 'item.pilgrim_letter')).toBe(false);
    void give;
  });
});

describe('where the requests send people', () => {
  it('place a page at four points of interest and the two vigils, on open ground', () => {
    const files = bakeRegion(DAWNMEADOW, STAMPS);
    const open = (x: number, y: number): boolean => {
      const c = decodeChunk(
        files.get(
          `dawnmeadow/chunk-${Math.floor(x / CHUNK_TILES)}-${Math.floor(y / CHUNK_TILES)}.bin`,
        ) as Uint8Array,
      );
      return c.collision[(y % CHUNK_TILES) * CHUNK_TILES + (x % CHUNK_TILES)] === Solid.None;
    };
    for (const p of PAGE_SITES) {
      expect(FIXTURES[`fixture.page_${p.id}`]?.loot?.items[0]?.item).toBe('item.wren_page');
      expect(DAWNMEADOW.placements.filter((x) => x.kind === `fixture.page_${p.id}`)).toHaveLength(
        1,
      );
      expect(open(p.x, p.y), p.id).toBe(true);
    }
    for (const v of REQUEST_VIGILS) {
      expect(FIXTURES[v.kind]?.type).toBe('vigil');
      expect(DAWNMEADOW.placements.some((x) => x.kind === v.kind)).toBe(true);
      expect(open(v.x, v.y), v.kind).toBe(true);
    }
  });
});
