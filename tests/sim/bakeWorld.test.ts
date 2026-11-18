import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAMPLE_REGION } from '../../src/content/world/regions/sample/spec';
import type { RegionSpec } from '../../src/content/world/regions/types';
import { STAMPS } from '../../src/content/world/stamps';
import { SAMPLE_HOUSE } from '../../src/content/world/stamps/sample';
import { Terrain, tilesetId } from '../../src/content/world/tileset';
import { BakeError } from '../../src/sim/world/bakeError';
import {
  CHUNK_TILES,
  Solid,
  createChunk,
  decodeChunk,
  encodeChunk,
  tileIndex,
} from '../../src/sim/world/chunk';
import { resolveStamp, type StampV2 } from '../../src/sim/world/stamp';
import { bakeRegion } from '../../tools/bake-world/bake';
import { bakeAllRegions } from '../../tools/bake-world/index';

const bake = (spec: unknown = SAMPLE_REGION, lib = STAMPS) => bakeRegion(spec, lib);
const withSpec = (patch: Partial<RegionSpec>): RegionSpec => ({ ...SAMPLE_REGION, ...patch });
const fails = (f: () => unknown): BakeError => {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(BakeError);
    return e as BakeError;
  }
  throw new Error('expected a BakeError');
};
const chunkAt = (files: Map<string, Uint8Array | string>, cx: number, cy: number) =>
  decodeChunk(files.get(`sample/chunk-${cx}-${cy}.bin`) as Uint8Array);
const tile = (files: Map<string, Uint8Array | string>, x: number, y: number) => {
  const c = chunkAt(files, Math.floor(x / CHUNK_TILES), Math.floor(y / CHUNK_TILES));
  const i = tileIndex(x % CHUNK_TILES, y % CHUNK_TILES);
  return {
    ground: c.ground[i] as number,
    object: c.object[i] as number,
    overhead: c.overhead[i] as number,
    detail: c.detail[i] as number,
    collision: c.collision[i] as number,
  };
};

describe('bake determinism', () => {
  it('a repeat bake gives identical bytes, file for file', () => {
    const a = bake();
    const b = bake();
    expect([...a.keys()]).toEqual([...b.keys()]);
    for (const [name, v] of a) {
      const w = b.get(name) as Uint8Array | string;
      expect(typeof v === 'string' ? v : Buffer.from(v).toString('hex'), name).toBe(
        typeof w === 'string' ? w : Buffer.from(w).toString('hex'),
      );
    }
  });

  it('the committed baked/world matches the specs', () => {
    const root = join(__dirname, '..', '..', 'baked', 'world');
    for (const [name, v] of bakeAllRegions()) {
      const p = join(root, name);
      expect(existsSync(p), name).toBe(true);
      expect(readFileSync(p).equals(Buffer.from(v)), name).toBe(true);
    }
  });

  it('a different seed changes the scatter', () => {
    const a = bake();
    const b = bake({ ...SAMPLE_REGION, seed: SAMPLE_REGION.seed + 1 });
    expect(
      Buffer.from(a.get('sample/chunk-0-0.bin') as Uint8Array).equals(
        Buffer.from(b.get('sample/chunk-0-0.bin') as Uint8Array),
      ),
    ).toBe(false);
  });
});

describe('what the bake produces', () => {
  const files = bake();

  it('writes one file per chunk, an interior chunk set and a manifest', () => {
    for (const k of ['0-0', '1-0', '0-1', '1-1'])
      expect(files.has(`sample/chunk-${k}.bin`)).toBe(true);
    expect(files.has('sample/interior-cellar/chunk-0-0.bin')).toBe(true);
    const m = JSON.parse(files.get('sample/manifest.json') as string);
    expect(m.files).toHaveLength(4);
    expect(m.files[0].hash).toMatch(/^[0-9a-f]{16}$/);
    expect(m.interiors[0].id).toBe('interior.cellar');
    expect(m.interiors[0].entrances).toEqual([{ x: 24, y: 20 }]);
    expect(m.waystones).toHaveLength(1);
    expect(m.wakePoints).toHaveLength(1);
    expect(m.landmarks).toHaveLength(1);
  });

  it('every region chunk file is version 2 and decodes', () => {
    for (const [name, v] of files) {
      if (!name.endsWith('.bin')) continue;
      expect((v as Uint8Array)[4]).toBe(2);
      decodeChunk(v as Uint8Array);
    }
  });

  it('a stamp keeps every cell it names, and the door becomes an object', () => {
    // The anchor (the door) is at 24,20, so the stamp's top left is 21,17.
    expect(tile(files, 21, 17).ground).toBe(Terrain.Cobble);
    expect(tile(files, 24, 20).object).toBe(tilesetId('tile.wall_door'));
    expect(tile(files, 21, 17).overhead).toBe(tilesetId('tile.roof_red_0m'));
    expect(tile(files, 24, 20).collision).toBe(Solid.Full);
    const c = chunkAt(files, 0, 0);
    expect(c.objects).toContainEqual({ x: 24, y: 20, kind: 'door.cellar' });
  });

  it('fill never overwrites a stamp cell or a road', () => {
    // Along the road and under the stamp there is no scatter and no cliff.
    for (let x = 22; x < 29; x++) {
      const t = tile(files, x, 30);
      expect(t.object, `road ${x}`).toBe(0);
      expect(t.overhead).toBe(0);
    }
    const chunk = chunkAt(files, 0, 0);
    const house = new Set<number>();
    for (let y = 17; y < 22; y++) for (let x = 21; x < 29; x++) house.add(tileIndex(x, y));
    expect(house.size).toBe(40);
    expect(chunk.ground[tileIndex(21, 17)]).toBe(Terrain.Cobble);
  });

  it('a road that crosses the river becomes planks, and water blocks', () => {
    const m = JSON.parse(files.get('sample/manifest.json') as string);
    expect(m.bridgeTiles).toBeGreaterThan(0);
    expect(tile(files, 44, 8).ground).toBe(Terrain.Water);
    expect(tile(files, 44, 8).collision).toBe(Solid.Water);
    let planks = 0;
    for (let y = 20; y < 30; y++)
      for (let x = 40; x < 50; x++) if (tile(files, x, y).ground === Terrain.Planks) planks++;
    expect(planks).toBeGreaterThan(0);
  });

  it('a drop in elevation becomes a cliff with a solid face, except where a road climbs it', () => {
    const face = tilesetId('tile.cave_wall_face');
    // The plateau starts at x 32, y 40; its south edge is y 55.
    expect(tile(files, 36, 55).object).toBe(face);
    expect(tile(files, 36, 55).collision).toBe(Solid.Full);
    expect(chunkAt(files, 1, 1).elevation[tileIndex(5, 10)]).toBe(1);
  });

  it('an interior is its own chunk set, numbered from 0,0, with solid void outside', () => {
    const c = decodeChunk(files.get('sample/interior-cellar/chunk-0-0.bin') as Uint8Array);
    expect([c.cx, c.cy]).toEqual([0, 0]);
    expect(c.ground[tileIndex(1, 1)]).toBe(Terrain.Cave);
    expect(c.collision[tileIndex(1, 1)]).toBe(Solid.None);
    expect(c.collision[tileIndex(20, 20)]).toBe(Solid.Full);
  });
});

describe('chunk format', () => {
  it('v2 carries elevation, and a v1 file still decodes with elevation 0', () => {
    const c = createChunk(3, -2);
    c.elevation[7] = 4;
    c.objects.push({ x: 1, y: 2, kind: 'a.b' });
    const v2 = encodeChunk(c);
    expect(v2[4]).toBe(2);
    expect(decodeChunk(v2).elevation[7]).toBe(4);
    // A v1 file is the v2 one with version 1 and no trailing elevation grid.
    const v1 = v2.slice(0, v2.length - 1024);
    v1[4] = 1;
    const d = decodeChunk(v1);
    expect(d.elevation[7]).toBe(0);
    expect(d.objects).toEqual(c.objects);
  });
});

describe('stamp format v2', () => {
  it('resolves layers through one legend and finds the anchor', () => {
    const r = resolveStamp(SAMPLE_HOUSE);
    expect([r.w, r.h]).toEqual([8, 5]);
    expect(r.anchor).toEqual({ x: 3, y: 3 });
    expect(r.cells[0]?.object).toBe(tilesetId('tile.wall_plaster'));
    expect(r.cells[0]?.overhead).toBe(tilesetId('tile.roof_red_0m'));
    expect(r.cells[4 * 8]?.ground).toBe(Terrain.Cobble);
    expect(r.cells[4 * 8]?.object).toBeUndefined();
  });

  it('a variant replaces only the layers it names', () => {
    const r = resolveStamp(SAMPLE_HOUSE, { variant: 'plain' });
    expect(r.cells[0]?.overhead).toBeUndefined();
    expect(r.cells[0]?.object).toBe(tilesetId('tile.wall_plaster'));
  });

  it('mirror flips cells, objects, doors and the anchor', () => {
    const r = resolveStamp(SAMPLE_HOUSE, { rotate: 'mirror' });
    expect(r.anchor).toEqual({ x: 4, y: 3 });
    expect(r.doors[0]).toEqual({ x: 4, y: 3, interior: 'cellar' });
    expect(r.cells[3 * 8 + 4]?.object).toBe(tilesetId('tile.wall_door'));
  });

  it('90 degrees swaps width and height and moves the anchor with the cells', () => {
    const lib: StampV2 = { ...SAMPLE_HOUSE, rotate: '90' };
    const r = resolveStamp(lib, { rotate: 90 });
    expect([r.w, r.h]).toEqual([5, 8]);
    // (3,3) in an 8 x 5 stamp turns clockwise to (h-1-y, x) = (1, 3).
    expect(r.anchor).toEqual({ x: 1, y: 3 });
    expect(r.cells[r.anchor.y * r.w + r.anchor.x]?.object).toBe(tilesetId('tile.wall_door'));
    const four = resolveStamp(lib, { rotate: 270 });
    expect([four.w, four.h]).toEqual([5, 8]);
  });
});

describe('bake errors name the source, the layer and the tile', () => {
  const stamp = (patch: Partial<StampV2>): StampV2 => ({ ...SAMPLE_HOUSE, ...patch });
  const lib = (s: StampV2) => ({ ...STAMPS, [s.id]: s });

  it('an unknown legend character in a stamp', () => {
    const bad = stamp({
      layers: {
        ...SAMPLE_HOUSE.layers,
        object: ['WWZWWNWW', ...(SAMPLE_HOUSE.layers.object as string[]).slice(1)],
      },
    });
    const e = fails(() => bake(SAMPLE_REGION, lib(bad)));
    expect(e.source).toBe('stamp sample_house');
    expect(e.layer).toBe('object');
    expect(e.at).toEqual({ x: 2, y: 0 });
    expect(e.message).toContain("unknown character 'Z'");
  });

  it('a ragged row in a stamp', () => {
    const rows = [...(SAMPLE_HOUSE.layers.ground as string[])];
    rows[2] = 'ccc';
    const e = fails(() =>
      bake(SAMPLE_REGION, lib(stamp({ layers: { ...SAMPLE_HOUSE.layers, ground: rows } }))),
    );
    expect(e.layer).toBe('ground');
    expect(e.at?.y).toBe(2);
  });

  it('a legend character with no value for its layer', () => {
    const bad = stamp({
      layers: {
        ...SAMPLE_HOUSE.layers,
        overhead: ['cc      ', ...(SAMPLE_HOUSE.layers.overhead as string[]).slice(1)],
      },
    });
    const e = fails(() => bake(SAMPLE_REGION, lib(bad)));
    expect(e.layer).toBe('overhead');
    expect(e.message).toContain('no overhead value');
  });

  it('a second anchor, a rotation the rule forbids, an unknown variant', () => {
    const two = stamp({
      layers: {
        ...SAMPLE_HOUSE.layers,
        ground: ['@ccccccc', 'c@cccccc', ...(SAMPLE_HOUSE.layers.ground as string[]).slice(2)],
      },
    });
    expect(fails(() => resolveStamp(two)).message).toContain('second anchor');
    expect(fails(() => resolveStamp(SAMPLE_HOUSE, { rotate: 90 })).layer).toBe('rotate');
    expect(fails(() => resolveStamp(SAMPLE_HOUSE, { variant: 'nope' })).layer).toBe('variant');
  });

  it('an unknown stamp id, a stamp off the edge, two stamps on each other', () => {
    expect(
      fails(() => bake(withSpec({ placements: [{ kind: 'house', stamp: 'ghost', x: 5, y: 5 }] })))
        .message,
    ).toContain("unknown stamp 'ghost'");
    const off = fails(() =>
      bake(withSpec({ placements: [{ kind: 'house', stamp: 'sample_house', x: 62, y: 62 }] })),
    );
    expect(off.layer).toBe('placements');
    expect(off.message).toContain('does not fit');
    const two = fails(() =>
      bake(
        withSpec({
          placements: [
            { kind: 'house', stamp: 'sample_house', x: 24, y: 20 },
            { kind: 'house', stamp: 'sample_house', x: 26, y: 20 },
          ],
        }),
      ),
    );
    expect(two.message).toContain('overlaps stamp sample_house');
    expect(two.at).toBeDefined();
  });

  it('a door to an interior the region does not have', () => {
    const e = fails(() => bake(withSpec({ interiors: [] })));
    expect(e.source).toBe('stamp sample_house');
    expect(e.layer).toBe('doors');
  });

  it('a biome mask with the wrong size, an unknown biome character, a bad elevation digit', () => {
    expect(fails(() => bake(withSpec({ biomes: SAMPLE_REGION.biomes.slice(1) }))).layer).toBe(
      'biomes',
    );
    const row = [...SAMPLE_REGION.biomes];
    row[3] = 'mmmqmmpp';
    const q = fails(() => bake(withSpec({ biomes: row })));
    expect(q.layer).toBe('biomes');
    expect(q.at).toEqual({ x: 3, y: 3 });
    const el = [...SAMPLE_REGION.elevation];
    el[2] = '00x00000';
    const x = fails(() => bake(withSpec({ elevation: el })));
    expect(x.layer).toBe('elevation');
    expect(x.at).toEqual({ x: 2, y: 2 });
  });

  it('a road to a node that is not there, a river or object outside the region', () => {
    const edge = fails(() =>
      bake(
        withSpec({
          roads: {
            nodes: SAMPLE_REGION.roads.nodes,
            edges: [{ a: 'west', b: 'nowhere', width: 2, surface: 'dirt' }],
          },
        }),
      ),
    );
    expect(edge.layer).toBe('roads');
    expect(edge.message).toContain("no node 'nowhere'");
    const river = fails(() =>
      bake(
        withSpec({
          rivers: [
            {
              id: 'r',
              width: 2,
              points: [
                { x: 0, y: 0 },
                { x: 70, y: 5 },
              ],
            },
          ],
        }),
      ),
    );
    expect(river.layer).toBe('rivers r');
    expect(river.at).toEqual({ x: 70, y: 5 });
    const obj = fails(() =>
      bake(withSpec({ placements: [{ kind: 'node.oak_tree', x: 99, y: 1 }] })),
    );
    expect(obj.layer).toBe('placements');
    expect(obj.at).toEqual({ x: 99, y: 1 });
  });

  it('a spec that breaks the schema names the field', () => {
    const e = fails(() => bake({ ...SAMPLE_REGION, chunks: { w: 0, h: 2 } }));
    expect(e.layer).toBe('schema');
    expect(e.message).toContain('chunks.w');
  });
});
