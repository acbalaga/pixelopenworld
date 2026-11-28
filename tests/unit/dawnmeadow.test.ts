import { describe, expect, it } from 'vitest';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { NPCS } from '../../src/content/dialogue';
import { NODES } from '../../src/content/items/recipes';
import { FIXTURES } from '../../src/content/world/fixtures';
import { DAWNMEADOW_CLUSTERS } from '../../src/content/world/regions/dawnmeadow/clusters';
import { DAWNMEADOW, TOWN_ORIGIN } from '../../src/content/world/regions/dawnmeadow/spec';
import type { RegionSpec } from '../../src/content/world/regions/types';
import { STAMPS } from '../../src/content/world/stamps';
import { HEARTHFORD, TOWN_PARTS } from '../../src/content/world/stamps/hearthford';
import { WAKE_IDS } from '../../src/content/world/wake';
import { CHUNK_TILES, decodeChunk } from '../../src/sim/world/chunk';
import { bakeRegion, type WorldFiles } from '../../tools/bake-world/bake';
import { rosterSpawnerKinds } from '../../src/content/creatures/zoneSpawners';
import { ROAMERS } from '../../src/content/creatures/roamers';
import { PEOPLE, PLACES } from '../../src/content/people';
import { ROSTERS } from '../../src/content/world/rosters';
import {
  MIN_LANDMARK_HEIGHT,
  MIN_STREET,
  validateRegion,
} from '../../tools/bake-world/validateRegion';

const files = bakeRegion(DAWNMEADOW, STAMPS);

/** Every object the bake placed, by world tile. */
function placed(f: WorldFiles): { kind: string; x: number; y: number }[] {
  const out: { kind: string; x: number; y: number }[] = [];
  for (const [name, v] of f) {
    const m = /^dawnmeadow\/chunk-(\d+)-(\d+)\.bin$/.exec(name);
    if (!m) continue;
    const c = decodeChunk(v as Uint8Array);
    for (const o of c.objects)
      out.push({ kind: o.kind, x: c.cx * CHUNK_TILES + o.x, y: c.cy * CHUNK_TILES + o.y });
  }
  return out;
}
const objects = placed(files);
const part = (id: string) => {
  const p = TOWN_PARTS.find((x) => x.id === id);
  if (!p) throw new Error(`no town part ${id}`);
  return { x: TOWN_ORIGIN.x + p.rect.x, y: TOWN_ORIGIN.y + p.rect.y, w: p.rect.w, h: p.rect.h };
};
/** True if a tile is inside the part, or in the rows just in front of it (stations stand in front of their workshop). */
const inOrBeside = (o: { x: number; y: number }, id: string, front = 2): boolean => {
  const r = part(id);
  return o.x >= r.x && o.x < r.x + r.w && o.y >= r.y && o.y < r.y + r.h + front;
};
const where = (kind: string) => objects.filter((o) => o.kind === kind);

describe('the Dawnmeadow spec', () => {
  it('is 12 by 12 chunks with the counts the region doc gives', () => {
    // 12 by 12 of land and sea, and 4 more rows underground for the Rootway (M4-21).
    expect(DAWNMEADOW.chunks).toEqual({ w: 12, h: 16 });
    expect(DAWNMEADOW.biomes).toHaveLength(64);
    expect(DAWNMEADOW.elevation).toHaveLength(64);
    expect(DAWNMEADOW.waystones).toHaveLength(6);
    expect(DAWNMEADOW.wakePoints.map((w) => w.id)).toEqual([...WAKE_IDS]);
    expect(DAWNMEADOW.landmarks.map((l) => l.id).sort()).toEqual([
      'bell_tower',
      'mill_sails',
      'quarry_crane',
    ]);
  });

  it('puts each wake point in the chunk the region doc names', () => {
    const chunkOf = (id: string): [number, number] => {
      const w = DAWNMEADOW.wakePoints.find((p) => p.id === id)!;
      return [Math.floor(w.x / CHUNK_TILES), Math.floor(w.y / CHUNK_TILES)];
    };
    expect(chunkOf('w1')).toEqual([8, 3]);
    expect(chunkOf('w2')).toEqual([8, 5]);
    expect(chunkOf('w3')).toEqual([7, 6]);
    expect(chunkOf('w4')).toEqual([2, 5]);
    expect(chunkOf('w5')).toEqual([5, 8]);
    expect(chunkOf('w6')).toEqual([9, 7]);
    expect(chunkOf('w7')).toEqual([3, 7]);
    expect(chunkOf('w8')).toEqual([5, 3]);
  });

  it('bakes the same bytes twice, and one file per chunk', () => {
    const again = bakeRegion(DAWNMEADOW, STAMPS);
    expect([...again.keys()]).toEqual([...files.keys()]);
    for (const [n, v] of files) expect(again.get(n), n).toEqual(v);
    expect([...files.keys()].filter((n) => n.endsWith('.bin'))).toHaveLength(192);
  });

  it('every object it places is something the game knows', () => {
    for (const o of objects) {
      const known =
        (o.kind.startsWith('fixture.') && FIXTURES[o.kind]) ||
        (o.kind.startsWith('node.') && NODES[o.kind]) ||
        (o.kind.startsWith('npc.') && NPCS[o.kind]) ||
        (o.kind.startsWith('spawner.') && SPAWNERS[o.kind]) ||
        o.kind === 'prop.camp_pot' ||
        // Empty lore slots (DM-F07 and the rest): markers for M10.
        o.kind.startsWith('marker.');
      expect(known, `${o.kind} at ${o.x}, ${o.y}`).toBeTruthy();
    }
    for (const s of Object.values(SPAWNERS)) expect(CREATURES[s.creature]).toBeDefined();
  });
});

describe('Hearthford', () => {
  it('has eight homes, four gates, and the districts of the hub rules', () => {
    const kinds = (k: string) => TOWN_PARTS.filter((p) => p.kind === k);
    expect(kinds('home').filter((p) => p.id.startsWith('home_'))).toHaveLength(8);
    expect(kinds('gate')).toHaveLength(4);
    expect(kinds('square')).toHaveLength(1);
    expect(
      kinds('craft_row')
        .map((p) => p.id)
        .sort(),
    ).toEqual(['apothecary', 'carpentry', 'smithy', 'tailor', 'tinker_shed']);
    for (const id of ['rune_house', 'inn', 'inn_yard', 'guard_yard', 'brin_shop'])
      expect(part(id)).toBeDefined();
  });

  it('every street is at least 3 tiles wide', () => {
    for (const p of TOWN_PARTS.filter((x) => x.kind === 'street'))
      expect(Math.min(p.rect.w, p.rect.h), p.id).toBeGreaterThanOrEqual(MIN_STREET);
  });

  it('is 56 tiles square, inside about 3 by 3 chunks', () => {
    expect(HEARTHFORD.layers.ground).toHaveLength(56);
  });

  it('moves every M3 square fixture to its workshop, as the region doc lists', () => {
    const one = (kind: string) => {
      const found = where(kind);
      expect(found, kind).toHaveLength(1);
      return found[0]!;
    };
    expect(inOrBeside(one('fixture.anvil'), 'smithy')).toBe(true);
    expect(inOrBeside(one('fixture.workbench'), 'carpentry')).toBe(true);
    expect(inOrBeside(one('fixture.loom'), 'tailor')).toBe(true);
    expect(inOrBeside(one('fixture.alchemy_table'), 'apothecary')).toBe(true);
    expect(inOrBeside(one('fixture.tinker_bench'), 'tinker_shed')).toBe(true);
    expect(inOrBeside(one('fixture.rune_stone'), 'rune_house')).toBe(true);
    for (const k of ['fixture.storage', 'fixture.mirror'])
      expect(inOrBeside(one(k), 'inn_yard', 0), k).toBe(true);
    // The bed moved upstairs to the inn room (POW-M6-07).
    expect(where('fixture.bed')).toHaveLength(0);
    // The inn's cook pot, and an old one on the porch of an empty house (POW-M4-20, region doc 11).
    const pots = where('prop.camp_pot');
    expect(pots).toHaveLength(2);
    expect(pots.filter((p) => inOrBeside(p, 'inn_yard', 0))).toHaveLength(1);
    expect(inOrBeside(one('spawner.training_dummy'), 'guard_yard', 0)).toBe(true);
    // The Waystone and the board stay in the square.
    const inSquare = (o: { x: number; y: number }): boolean => inOrBeside(o, 'square', 0);
    expect(where('fixture.waystone').some(inSquare)).toBe(true);
    expect(inSquare(one('fixture.board'))).toBe(true);
  });

  it('puts the M3 people at their stations', () => {
    const at = (kind: string, id: string, front = 2): boolean =>
      where(kind).some((o) => inOrBeside(o, id, front));
    expect(at('npc.smith', 'smithy')).toBe(true);
    expect(at('npc.outfitter', 'tailor')).toBe(true);
    expect(at('npc.herbalist', 'apothecary')).toBe(true);
    expect(at('npc.scholar', 'rune_house')).toBe(true);
    expect(at('npc.cook', 'inn_yard', 0)).toBe(true);
    expect(at('npc.guard', 'guard_yard', 0)).toBe(true);
    expect(at('npc.shopkeeper', 'brin_shop')).toBe(true);
    expect(at('npc.pilgrim', 'square', 0)).toBe(true);
  });

  it('moves the element set pieces to a practice field outside the north gate', () => {
    const gateN = part('gate_n');
    for (const k of [
      'fixture.brush_wall',
      'fixture.fire_barrier',
      'fixture.windmill_gate',
      'fixture.stone_gap',
      'fixture.withered_vine',
      'fixture.hidden_niche',
    ]) {
      const o = where(k);
      expect(o, k).toHaveLength(1);
      expect(o[0]!.y).toBeLessThan(gateN.y);
      expect(gateN.y - o[0]!.y).toBeLessThan(30);
    }
  });

  it('holds the ten manual chests: eight at their places of interest, two in the Rootway', () => {
    expect(objects.filter((o) => o.kind.startsWith('fixture.chest_manual_'))).toHaveLength(10);
  });
});

describe('the region checks', () => {
  it('pass for Dawnmeadow', () => {
    expect(validateRegion(DAWNMEADOW, files)).toEqual([]);
  });

  const bakeWith = (spec: RegionSpec, lib = STAMPS): { spec: RegionSpec; f: WorldFiles } => ({
    spec,
    f: bakeRegion(spec, lib),
  });

  it('reject a crafting station in the square', () => {
    const bad = {
      ...HEARTHFORD,
      objects: [...(HEARTHFORD.objects ?? []), { x: 30, y: 32, kind: 'fixture.anvil' }],
    };
    const { spec, f } = bakeWith(DAWNMEADOW, { ...STAMPS, hearthford: bad });
    expect(
      validateRegion(spec, f).some((e) => e.includes('fixture.anvil') && e.includes('civic only')),
    ).toBe(true);
    // A bed, a shop counter and the cook pot are barred too.
    for (const kind of ['fixture.bed', 'npc.shopkeeper', 'prop.camp_pot']) {
      const b = { ...HEARTHFORD, objects: [...(HEARTHFORD.objects ?? []), { x: 30, y: 32, kind }] };
      const r = bakeWith(DAWNMEADOW, { ...STAMPS, hearthford: b });
      expect(
        validateRegion(r.spec, r.f).some((e) => e.includes(kind)),
        kind,
      ).toBe(true);
    }
  });

  it('reject a street under 3 tiles wide, and a street with something solid in it', () => {
    const narrow: RegionSpec = {
      ...DAWNMEADOW,
      districts: [
        ...(DAWNMEADOW.districts ?? []),
        { id: 'alley', kind: 'street', x: 200, y: 200, w: 2, h: 8 },
      ],
    };
    expect(validateRegion(narrow, files).some((e) => e.includes("'alley' is 2 tiles wide"))).toBe(
      true,
    );
    const guard = part('guard_yard');
    const blocked: RegionSpec = {
      ...DAWNMEADOW,
      districts: [
        ...(DAWNMEADOW.districts ?? []),
        { id: 'through_the_yard', kind: 'street', ...guard },
      ],
    };
    expect(
      validateRegion(blocked, files).some((e) => e.includes("'through_the_yard' is blocked")),
    ).toBe(true);
  });

  it('reject a landmark that is too short, and one hidden behind a rise', () => {
    const short: RegionSpec = {
      ...DAWNMEADOW,
      landmarkHeights: { ...DAWNMEADOW.landmarkHeights, mill_sails: MIN_LANDMARK_HEIGHT - 1 },
    };
    expect(
      validateRegion(short, files).some((e) => e.includes('mill_sails') && e.includes('tall')),
    ).toBe(true);
    // Raise everything around the bell tower to elevation 9 and it cannot be seen from afar.
    const l = DAWNMEADOW.landmarks.find((x) => x.id === 'bell_tower')!;
    const ring = DAWNMEADOW.elevation.map((row, y) =>
      [...row]
        .map((_c, x) => (Math.abs(x * 8 - l.x) <= 8 && Math.abs(y * 8 - l.y) <= 16 ? '0' : '9'))
        .join(''),
    );
    const hidden = { ...DAWNMEADOW, elevation: ring };
    const r = bakeWith(hidden);
    expect(
      validateRegion(r.spec, r.f).some(
        (e) => e.includes('bell_tower') && e.includes('two chunks away'),
      ),
    ).toBe(true);
  });

  it('reject a Waystone with no object, an unlisted Waystone, and a wake point in water', () => {
    const extra: RegionSpec = {
      ...DAWNMEADOW,
      waystones: [...DAWNMEADOW.waystones, { id: 'ghost', x: 100, y: 100 }],
    };
    expect(validateRegion(extra, files).some((e) => e.includes('Waystone ghost'))).toBe(true);
    const fewer: RegionSpec = { ...DAWNMEADOW, waystones: DAWNMEADOW.waystones.slice(1) };
    expect(validateRegion(fewer, files).some((e) => e.includes('not listed'))).toBe(true);
    const wet: RegionSpec = {
      ...DAWNMEADOW,
      wakePoints: [{ id: 'w1', x: 20, y: 370 }, ...DAWNMEADOW.wakePoints.slice(1)],
    };
    expect(validateRegion(wet, files).some((e) => e.includes('wake point w1'))).toBe(true);
  });
});

describe('the discoverable check (M4-11)', () => {
  const land = (spec: RegionSpec): string[] =>
    validateRegion(spec, files).filter((e) => e.includes('chunk'));
  // The region as it stood before the node clusters: the chunks they cover are pending again.
  const chunkOf = (p: { x: number; y: number }): string =>
    `${Math.floor(p.x / CHUNK_TILES)},${Math.floor(p.y / CHUNK_TILES)}`;
  const poiChunks = new Set((DAWNMEADOW.pois ?? []).map(chunkOf));
  const clusterChunks = [...new Set(DAWNMEADOW_CLUSTERS.map(chunkOf))].filter(
    (k) => !poiChunks.has(k),
  );
  const bare: RegionSpec = {
    ...DAWNMEADOW,
    // The fishing spots (POW-M4-23B) and iron veins (POW-M4-23D) added later are node clusters too.
    placements: DAWNMEADOW.placements.filter(
      (p) =>
        !DAWNMEADOW_CLUSTERS.includes(p) &&
        !(p.kind.startsWith('node.fishing_') && !(p.x === 238 && p.y === 170)) &&
        // The first iron vein, at 185,75, is old.
        !(p.kind === 'node.iron_vein' && !(p.x === 185 && p.y === 75)),
    ),
    pendingDiscoverables: clusterChunks,
  };

  it('finds nothing pending in the region: every land chunk holds a discoverable', () => {
    expect(DAWNMEADOW.pendingDiscoverables ?? []).toEqual([]);
    expect(land(DAWNMEADOW)).toEqual([]);
    expect(land(bare)).toEqual([]);
    expect(clusterChunks.length).toBeGreaterThan(50);
  });

  it('puts a cluster of at least two nodes of different kinds in each chunk it covers', () => {
    for (const key of clusterChunks) {
      const here = DAWNMEADOW_CLUSTERS.filter(
        (c) => `${Math.floor(c.x / CHUNK_TILES)},${Math.floor(c.y / CHUNK_TILES)}` === key,
      );
      expect(here.length, key).toBeGreaterThanOrEqual(2);
      expect(new Set(here.map((c) => c.kind)).size, key).toBeGreaterThanOrEqual(2);
      for (const c of here) expect(NODES[c.kind], c.kind).toBeDefined();
    }
  });

  it('rejects a land chunk with nothing to find that is not listed as pending', () => {
    const unlisted: RegionSpec = { ...bare, pendingDiscoverables: clusterChunks.slice(1) };
    const first = clusterChunks[0]!;
    expect(land(unlisted).some((e) => e.includes(`chunk ${first} holds no discoverable`))).toBe(
      true,
    );
  });

  it('rejects a pending chunk that has something now, and a pending chunk that is sea', () => {
    const stale: RegionSpec = {
      ...DAWNMEADOW,
      // Hearthford's own chunk, and open sea.
      pendingDiscoverables: ['5,5', '0,11'],
    };
    const bad = land(stale);
    expect(bad.some((e) => e.includes('chunk 5,5') && e.includes('remove it'))).toBe(true);
    expect(bad.some((e) => e.includes('chunk 0,11') && e.includes('not land'))).toBe(true);
  });

  it('counts a point of interest: one placed in a pending chunk takes it off the list', () => {
    const key = clusterChunks[0]!;
    const [cx, cy] = key.split(',').map(Number) as [number, number];
    const withPoi: RegionSpec = {
      ...bare,
      pois: [...(DAWNMEADOW.pois ?? []), { id: 'poi.test', x: cx * 32 + 3, y: cy * 32 + 3 }],
    };
    expect(land(withPoi).some((e) => e.includes(`chunk ${key}`) && e.includes('remove it'))).toBe(
      true,
    );
  });

  it('rejects a point of interest that stands in water or in rock', () => {
    const wet: RegionSpec = {
      ...DAWNMEADOW,
      pois: [...(DAWNMEADOW.pois ?? []), { id: 'poi.wet', x: 20, y: 370 }],
    };
    expect(
      validateRegion(wet, files).some((e) => e.includes('poi.wet') && e.includes('open')),
    ).toBe(true);
  });
});

describe('Dawnmeadow spawn zones (M4-05)', () => {
  const zoneSpawns = objects.filter((o) => /^spawner\.z[abc]_/.test(o.kind));

  it('places creatures in every zone of section 3, at each zone step, by day and by night', () => {
    for (const r of Object.values(ROSTERS).filter((x) => x.id.startsWith('roster.dm_'))) {
      const kinds = new Set(rosterSpawnerKinds(r.id));
      const here = zoneSpawns.filter((o) => kinds.has(o.kind));
      expect(
        here.some((o) => SPAWNERS[o.kind]?.when === 'day'),
        `${r.id} by day`,
      ).toBe(true);
      expect(
        here.some((o) => SPAWNERS[o.kind]?.when === 'night'),
        `${r.id} by night`,
      ).toBe(true);
    }
    // The Commons, where a new character first walks, has its day roster: hares, sparrows, Mosslings.
    for (const c of ['meadow_hare', 'hedge_sparrow', 'mossling'])
      expect(
        zoneSpawns.some((o) => o.kind === `spawner.za_d_${c}`),
        c,
      ).toBe(true);
    expect(zoneSpawns.length).toBeGreaterThan(100);
  });

  it('keeps hostile and territorial spawns 12 tiles from wake points, roads and walls', () => {
    // The check runs inside the bake, so a clean bake is the pass. A boar planted near a wake point fails it.
    const w = DAWNMEADOW.wakePoints[0]!;
    const bad: RegionSpec = {
      ...DAWNMEADOW,
      placements: [
        ...DAWNMEADOW.placements,
        { kind: 'spawner.zb_d_bramble_boar', x: w.x + 3, y: w.y },
      ],
    };
    expect(() => bakeRegion(bad, STAMPS)).toThrow(/within 12 tiles/);
  });
});

describe('Hollowhorn route check (M4-05)', () => {
  it('bakes with its spawner placed, and the bake rejects a route over bad ground', () => {
    expect(objects.some((o) => o.kind === 'spawner.hollowhorn')).toBe(true);
    const def = ROAMERS['creature.hollowhorn']!;
    const stops = def.stops;
    try {
      // A stop in the cairn ring, inside the 12 tile margin of its stones.
      (def as { stops: unknown }).stops = stops.map((s, i) =>
        i === 1 ? { ...s, x: 44, y: 44 } : s,
      );
      expect(() => bakeRegion(DAWNMEADOW, STAMPS)).toThrow(/creature\.hollowhorn route at/);
    } finally {
      (def as { stops: unknown }).stops = stops;
    }
    expect(() => bakeRegion(DAWNMEADOW, STAMPS)).not.toThrow();
  });
});

describe('Dawnmeadow people (M4-12)', () => {
  it('places each of the sixteen named people once, and each stands on open ground', () => {
    const grid = new Map<string, Uint8Array>();
    for (const [name, v] of files) if (name.endsWith('.bin')) grid.set(name, v as Uint8Array);
    const npcs = objects.filter((o) => o.kind.startsWith('npc.'));
    for (const id of Object.keys(PEOPLE))
      expect(
        npcs.filter((o) => o.kind === id),
        id,
      ).toHaveLength(1);
    expect(npcs).toHaveLength(Object.keys(PEOPLE).length);
    // Each stands on a tile nothing solid occupies.
    for (const o of npcs) {
      const c = decodeChunk(
        grid.get(
          `dawnmeadow/chunk-${Math.floor(o.x / CHUNK_TILES)}-${Math.floor(o.y / CHUNK_TILES)}.bin`,
        )!,
      );
      const i = (o.y % CHUNK_TILES) * CHUNK_TILES + (o.x % CHUNK_TILES);
      expect(c.collision[i], `${o.kind} at ${o.x}, ${o.y}`).toBe(0);
    }
  });

  it("gives every named place a rectangle and open standing tiles, bar the two awaiting the Hermit's Well", () => {
    const solid = (x: number, y: number): boolean => {
      const c = decodeChunk(
        files.get(
          `dawnmeadow/chunk-${Math.floor(x / CHUNK_TILES)}-${Math.floor(y / CHUNK_TILES)}.bin`,
        ) as Uint8Array,
      );
      return (
        c.collision[(y % CHUNK_TILES) * CHUNK_TILES + (x % CHUNK_TILES)] !== 0 ||
        objects.some((o) => o.x === x && o.y === y)
      );
    };
    for (const [id, p] of Object.entries(PLACES)) {
      expect(p.spot, id).toBeDefined();
      const { rect, slots } = p.spot!;
      if (p.part) expect(rect, id).toEqual(part(p.part));
      expect(slots.length, id).toBeGreaterThanOrEqual(3);
      for (const [x, y] of slots) {
        expect(solid(x, y), `${id} slot ${x},${y}`).toBe(false);
        // In the place, or in the rows just in front of a building.
        expect(x, id).toBeGreaterThanOrEqual(rect.x - 1);
        expect(x, id).toBeLessThanOrEqual(rect.x + rect.w);
        expect(y, id).toBeGreaterThanOrEqual(rect.y);
        expect(y, id).toBeLessThanOrEqual(rect.y + rect.h + 2);
      }
    }
  });
});
