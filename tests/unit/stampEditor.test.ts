import { describe, expect, it } from 'vitest';
import { CREATURES } from '../../src/content/creatures';
import { REGION_SPECS } from '../../src/content/world/regions/index';
import { SAMPLE_REGION } from '../../src/content/world/regions/sample/spec';
import { ROSTERS } from '../../src/content/world/rosters';
import { STAMPS } from '../../src/content/world/stamps';
import { SAMPLE_HOUSE } from '../../src/content/world/stamps/sample';
import { rosterTemperaments, TEMPERAMENT_MARK } from '../../src/dev/map';
import {
  exportLayers,
  paintCell,
  paintChars,
  parseLayers,
  resolveForEditor,
  stampToChunks,
  type LayerName,
} from '../../src/dev/stampEdit';
import { CHUNK_TILES, decodeChunk, tileIndex } from '../../src/sim/world/chunk';
import { resolveStamp, type StampV2 } from '../../src/sim/world/stamp';
import { bakeRegion } from '../../tools/bake-world/bake';
import { collisionOfCell } from '../../tools/bake-assets/world';

describe('stamp editing', () => {
  it('paints one cell of one layer and leaves the rest and the original alone', () => {
    const s = paintCell(SAMPLE_HOUSE, 'object', 4, 4, 'W');
    expect(s.layers.object?.[4]).toBe('    W   ');
    expect(SAMPLE_HOUSE.layers.object?.[4]).toBe('        ');
    expect(s.layers.ground).toBe(SAMPLE_HOUSE.layers.ground);
    expect(paintCell(s, 'object', 4, 4, ' ').layers.object?.[4]).toBe('        ');
  });

  it('refuses a cell outside the stamp and a character the layer cannot take', () => {
    expect(() => paintCell(SAMPLE_HOUSE, 'object', 99, 0, 'W')).toThrow(/outside/);
    expect(() => paintCell(SAMPLE_HOUSE, 'ground', 0, 0, 'z')).toThrow(/no ground value/);
    expect(paintChars(SAMPLE_HOUSE, 'overhead')).toEqual(['r']);
  });

  it('creates a layer the stamp does not have yet, blank', () => {
    const bare: StampV2 = {
      ...SAMPLE_HOUSE,
      layers: { ground: SAMPLE_HOUSE.layers.ground as readonly string[] },
    };
    const s = paintCell(bare, 'overhead', 1, 1, 'r');
    expect(s.layers.overhead).toHaveLength(5);
    expect(s.layers.overhead?.[1]).toBe(' r      ');
  });

  it('exports source that parses back to the same layers', () => {
    const s = paintCell(paintCell(SAMPLE_HOUSE, 'object', 4, 4, 'W'), 'object', 2, 0, ' ');
    expect(parseLayers(exportLayers(s))).toEqual(s.layers);
    // Quotes and backslashes in a row survive.
    const odd: StampV2 = { ...s, layers: { ground: ["a'b\\c"] } };
    expect(parseLayers(exportLayers(odd))).toEqual(odd.layers);
  });
});

describe('what the editor shows is what the baker writes', () => {
  const edited = paintCell(
    paintCell(paintCell(SAMPLE_HOUSE, 'object', 4, 4, 'W'), 'object', 2, 0, ' '),
    'overhead',
    7,
    2,
    'r',
  );
  const pasted: StampV2 = { ...edited, layers: parseLayers(exportLayers(edited)) };

  const bake = (stamp: StampV2): Map<string, Uint8Array | string> =>
    bakeRegion(SAMPLE_REGION, { ...STAMPS, sample_house: stamp });

  it('the exported stamp bakes to the same bytes as the edited one', () => {
    const a = bake(edited);
    const b = bake(pasted);
    expect([...b.keys()]).toEqual([...a.keys()]);
    for (const [name, v] of a) expect(b.get(name), name).toEqual(v);
    // And the edit changed the bake.
    const orig = bakeRegion(SAMPLE_REGION, STAMPS);
    expect([...a].some(([n, v]) => JSON.stringify(orig.get(n)) !== JSON.stringify(v))).toBe(true);
  });

  it('every tile the editor draws is the tile the baked chunk holds', () => {
    const files = bake(pasted);
    const r = resolveStamp(pasted);
    const shown = stampToChunks(resolveForEditor(pasted), collisionOfCell);
    const place = SAMPLE_REGION.placements.find((p) => p.stamp === 'sample_house');
    // The placement coordinate is the stamp's anchor tile.
    const ox = (place?.x ?? 0) - r.anchor.x;
    const oy = (place?.y ?? 0) - r.anchor.y;
    let compared = 0;
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const cell = r.cells[y * r.w + x];
        if (!cell) continue;
        const wx = ox + x;
        const wy = oy + y;
        const baked = decodeChunk(
          files.get(
            `sample/chunk-${Math.floor(wx / CHUNK_TILES)}-${Math.floor(wy / CHUNK_TILES)}.bin`,
          ) as Uint8Array,
        );
        const i = tileIndex(wx % CHUNK_TILES, wy % CHUNK_TILES);
        const sh = shown[0]!;
        const j = tileIndex(x, y);
        for (const layer of ['ground', 'detail', 'object', 'overhead'] as LayerName[]) {
          const want = cell[layer];
          if (want === undefined || (layer === 'ground' && want === 0)) continue;
          expect(baked[layer][i], `${layer} at ${x},${y}`).toBe(want);
          expect(sh[layer][j], `shown ${layer} at ${x},${y}`).toBe(want);
        }
        expect(baked.collision[i], `collision at ${x},${y}`).toBe(sh.collision[j]);
        compared++;
      }
    expect(compared).toBeGreaterThan(20);
  });
});

describe('rosters and the temperament marks', () => {
  it('every zone of every region spec names a roster that exists, with real creatures', () => {
    for (const spec of Object.values(REGION_SPECS))
      for (const z of spec.zones) expect(ROSTERS[z.roster], `${spec.id} ${z.id}`).toBeDefined();
    for (const r of Object.values(ROSTERS))
      for (const c of r.creatures) expect(CREATURES[c], `${r.id} ${c}`).toBeDefined();
  });

  it('a roster reads as its temperaments, most dangerous first, each with a glyph and colour', () => {
    const t = rosterTemperaments('roster.wood_edge');
    expect(t.length).toBeGreaterThan(0);
    for (const x of t) {
      expect(TEMPERAMENT_MARK[x].glyph).toHaveLength(1);
      expect(TEMPERAMENT_MARK[x].color).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(rosterTemperaments('roster.nowhere')).toEqual([]);
  });
});
