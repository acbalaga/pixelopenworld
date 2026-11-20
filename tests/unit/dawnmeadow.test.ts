import { describe, expect, it } from 'vitest';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { NPCS } from '../../src/content/dialogue';
import { NODES } from '../../src/content/items/recipes';
import { FIXTURES } from '../../src/content/world/fixtures';
import { DAWNMEADOW, TOWN_ORIGIN } from '../../src/content/world/regions/dawnmeadow/spec';
import type { RegionSpec } from '../../src/content/world/regions/types';
import { STAMPS } from '../../src/content/world/stamps';
import { HEARTHFORD, TOWN_PARTS } from '../../src/content/world/stamps/hearthford';
import { WAKE_IDS } from '../../src/content/world/wake';
import { CHUNK_TILES, decodeChunk } from '../../src/sim/world/chunk';
import { bakeRegion, type WorldFiles } from '../../tools/bake-world/bake';
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
    for (const k of ['fixture.bed', 'fixture.storage', 'fixture.mirror'])
      expect(inOrBeside(one(k), 'inn_yard', 0), k).toBe(true);
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

  it('keeps the ten manual chests as stand-ins', () => {
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
