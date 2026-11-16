import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BLOB_MASKS, NB, blobIndex, canonicalMask, quadrants } from '../../src/shared/autotile';
import { blobMask } from '../../src/content/sprites/gen/autotile';
import { Terrain, TILESET, tilesetId } from '../../src/content/world/tileset';
import { TEST_MAP } from '../../src/content/world/test-map';
import {
  CHUNK_TILES,
  Solid,
  createChunk,
  decodeChunk,
  encodeChunk,
  tileIndex,
} from '../../src/sim/world/chunk';
import { buildChunks, type Stamp } from '../../src/sim/world/stamp';
import { TileWorld } from '../../src/sim/world/world';
import { TILE_FX, moveBox, overlapsSolid, type Box } from '../../src/sim/systems/collision';
import { bakeWorld, collisionOfCell } from '../../tools/bake-assets/world';

const px = (n: number): number => n * 256;

describe('blob autotile', () => {
  it('collapses 256 neighbor masks to 47 pictures, with a stable index', () => {
    expect(BLOB_MASKS).toHaveLength(47);
    expect(blobIndex(0)).toBe(0);
    expect(blobIndex(255)).toBe(46);
    for (let m = 0; m < 256; m++) expect(BLOB_MASKS).toContain(canonicalMask(m));
  });

  it('a diagonal neighbor only matters when both adjacent edges are set', () => {
    expect(blobIndex(NB.NE)).toBe(blobIndex(0));
    expect(blobIndex(NB.N | NB.NE)).toBe(blobIndex(NB.N));
    expect(blobIndex(NB.N | NB.E | NB.NE)).not.toBe(blobIndex(NB.N | NB.E));
    expect(quadrants(0xff)).toEqual({ tl: 'full', tr: 'full', bl: 'full', br: 'full' });
    expect(quadrants(0).tl).toBe('corner');
  });

  it('generated masks are 16 x 16, full is solid overlay, isolated has rim and base all round', () => {
    for (let i = 0; i < 47; i++) {
      const m = blobMask(i);
      expect(m).toHaveLength(16);
      for (const row of m) expect(row).toMatch(/^[#.e]{16}$/);
    }
    expect(blobMask(46).every((r) => r === '#'.repeat(16))).toBe(true);
    const iso = blobMask(0).join('');
    expect(iso).toContain('e');
    expect(iso).toContain('.');
    expect(blobMask(0)[0]).toBe('.'.repeat(16));
  });

  it('neighboring tiles line up: shared edges match for any consistent terrain layout', () => {
    // Pseudo-random layouts from a fixed seed. Compare the touching pixel columns and rows.
    let s = 12345;
    const rnd = (): number => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let trial = 0; trial < 20; trial++) {
      const n = 10;
      const g = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() < 0.6));
      const mask = (x: number, y: number): number => {
        const w = (dx: number, dy: number): boolean => g[y + dy]?.[x + dx] === true;
        return (
          (w(0, -1) ? NB.N : 0) |
          (w(1, -1) ? NB.NE : 0) |
          (w(1, 0) ? NB.E : 0) |
          (w(1, 1) ? NB.SE : 0) |
          (w(0, 1) ? NB.S : 0) |
          (w(-1, 1) ? NB.SW : 0) |
          (w(-1, 0) ? NB.W : 0) |
          (w(-1, -1) ? NB.NW : 0)
        );
      };
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (!g[y]![x]) continue;
          const a = blobMask(blobIndex(mask(x, y)));
          if (x + 1 < n && g[y]![x + 1]) {
            const b = blobMask(blobIndex(mask(x + 1, y)));
            expect(a.map((r) => r[15]).join(''), `h ${trial} ${x},${y}`).toBe(
              b.map((r) => r[0]).join(''),
            );
          }
          if (y + 1 < n && g[y + 1]![x]) {
            const b = blobMask(blobIndex(mask(x, y + 1)));
            expect(a[15], `v ${trial} ${x},${y}`).toBe(b[0]);
          }
        }
      }
    }
  });
});

describe('chunk codec', () => {
  it('encode then decode is exact, and re-encoding gives the same bytes', () => {
    const c = createChunk(-3, 7);
    let s = 99;
    const rnd = (n: number): number => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) % n;
    for (let i = 0; i < CHUNK_TILES * CHUNK_TILES; i++) {
      c.ground[i] = rnd(4);
      c.detail[i] = rnd(30);
      c.object[i] = rnd(30);
      c.overhead[i] = rnd(65535);
      c.collision[i] = rnd(3);
    }
    c.objects.push({ x: 5, y: 31, kind: 'spawn.player' }, { x: 0, y: 0, kind: 'sign.ünïcode' });
    const bytes = encodeChunk(c);
    expect(decodeChunk(bytes)).toEqual(c);
    expect(encodeChunk(decodeChunk(bytes))).toEqual(bytes);
  });

  it('rejects bad headers, versions and truncated files', () => {
    const bytes = encodeChunk(createChunk(0, 0));
    expect(() => decodeChunk(new Uint8Array(20))).toThrow(/not a chunk/);
    const wrongVersion = bytes.slice();
    wrongVersion[4] = 9;
    expect(() => decodeChunk(wrongVersion)).toThrow(/version/);
    expect(() => decodeChunk(bytes.slice(0, 500))).toThrow(/truncated/);
  });

  it('every committed chunk file decodes and re-encodes to the same bytes', () => {
    const dir = join(__dirname, '..', '..', 'baked');
    const files = readdirSync(dir).filter((n) => n.startsWith('chunk-test-'));
    expect(files).toHaveLength(9);
    for (const f of files) {
      const raw = new Uint8Array(readFileSync(join(dir, f)));
      expect(encodeChunk(decodeChunk(raw))).toEqual(raw);
    }
  });
});

describe('stamp and test map', () => {
  it('reports the row and column of a bad cell, and bad sizes', () => {
    const legend = { '.': { ground: Terrain.Grass } };
    const row = '.'.repeat(32);
    const ok = Array(32).fill(row);
    const bad = (rows: string[]): Stamp => ({ id: 's', legend, rows });
    expect(() =>
      buildChunks(bad(ok.map((r, i) => (i === 4 ? r.slice(0, 5) + '?' + r.slice(6) : r))), () => 0),
    ).toThrow("row 4 col 5: unknown character '?'");
    expect(() => buildChunks(bad(ok.map((r, i) => (i === 2 ? r.slice(1) : r))), () => 0)).toThrow(
      'row 2: width 31',
    );
    expect(() => buildChunks(bad(ok.slice(1)), () => 0)).toThrow('not a multiple');
  });

  it('the test map is 3 x 3 chunks with water, dirt, trees, a spawn, and matching collision', () => {
    const chunks = buildChunks(TEST_MAP, collisionOfCell);
    expect(chunks).toHaveLength(9);
    const all = chunks.flatMap((c) => [...c.ground]);
    for (const t of [Terrain.Grass, Terrain.Dirt, Terrain.Water]) expect(all).toContain(t);
    const world = new TileWorld(chunks);
    const spawn = chunks.flatMap((c) =>
      c.objects
        .filter((o) => o.kind === 'spawn.player')
        .map((o) => [c.cx * 32 + o.x, c.cy * 32 + o.y]),
    )[0]!;
    expect(spawn).toEqual([48, 40]);
    expect(world.solidAt(spawn[0]!, spawn[1]!)).toBe(Solid.None);
    for (const c of chunks) {
      for (let i = 0; i < 1024; i++) {
        const water = c.ground[i] === Terrain.Water;
        const trunk =
          c.object[i] === tilesetId('tile.rock') ||
          TILESET[(c.object[i] as number) - 1]?.endsWith('_trunk');
        expect(c.collision[i]).toBe(water ? Solid.Water : trunk ? Solid.Full : Solid.None);
      }
    }
  });

  it('baking is deterministic', () => {
    expect(bakeWorld()).toEqual(bakeWorld());
  });

  it('autotile neighbors see across chunk borders, and the map border draws no edge', () => {
    const world = new TileWorld(buildChunks(TEST_MAP, collisionOfCell));
    // Find a water tile on the east side of chunk (0,1) next to water in chunk (1,1).
    let found = 0;
    for (let ty = 32; ty < 64; ty++) {
      if (world.terrainAt(31, ty) === Terrain.Water && world.terrainAt(32, ty) === Terrain.Water) {
        expect(world.neighborMask(31, ty, Terrain.Water) & NB.E).toBe(NB.E);
        expect(world.neighborMask(32, ty, Terrain.Water) & NB.W).toBe(NB.W);
        found++;
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(world.neighborMask(0, 0, Terrain.Grass)).toBe(255);
  });
});

/** A one-chunk world from rows: `#` solid, `~` water, anything else open. */
function grid(rows: string[]): TileWorld {
  const c = createChunk(0, 0);
  rows.forEach((r, y) =>
    [...r].forEach(
      (ch, x) =>
        (c.collision[tileIndex(x, y)] =
          ch === '#' ? Solid.Full : ch === '~' ? Solid.Water : Solid.None),
    ),
  );
  return new TileWorld([c]);
}
const open = (): string[] => Array.from({ length: 32 }, () => '.'.repeat(32));
const withTiles = (cells: [number, number, string][]): TileWorld => {
  const rows = open().map((r) => r.split(''));
  for (const [x, y, ch] of cells) rows[y]![x] = ch;
  return grid(rows.map((r) => r.join('')));
};
const box = (xPx: number, yPx: number, w = 10, h = 6): Box => ({
  x: px(xPx),
  y: px(yPx),
  w: px(w),
  h: px(h),
});

describe('collision', () => {
  it('moves freely in open ground', () => {
    const w = withTiles([]);
    expect(moveBox(w, box(100, 100), px(5), px(-3))).toEqual(box(105, 97));
  });

  it('cannot enter a solid or water tile, and stops flush against it', () => {
    const w = withTiles([
      [10, 5, '#'],
      [14, 5, '~'],
    ]);
    const b = box(140, 82); // right edge at 150, tile 10 starts at 160
    expect(moveBox(w, b, px(30), 0).x).toBe(160 * 256 - px(10));
    const c = moveBox(w, box(178, 82), px(-30), 0); // moving left from tile 10's right side
    expect(c.x).toBe(11 * TILE_FX);
    const water = moveBox(w, box(200, 82), px(30), 0);
    expect(water.x).toBe(14 * TILE_FX - px(10));
    for (const m of [moveBox(w, b, px(40), px(3)), c, water])
      expect(overlapsSolid(w, m)).toBe(false);
  });

  it('blocks vertically too, both directions', () => {
    const w = withTiles([
      [6, 10, '#'],
      [6, 4, '#'],
    ]);
    expect(moveBox(w, box(96, 140), 0, px(40)).y).toBe(10 * TILE_FX - px(6));
    expect(moveBox(w, box(96, 90), 0, px(-40)).y).toBe(5 * TILE_FX);
  });

  it('slides along a wall when pushed diagonally into it', () => {
    const w = withTiles(
      Array.from({ length: 10 }, (_, i): [number, number, string] => [10, i + 3, '#']),
    );
    const start = box(145, 100); // right edge 155, wall at x=160
    const m = moveBox(w, start, px(8), px(6));
    expect(m.x).toBe(160 * 256 - px(10));
    expect(m.y).toBe(start.y + px(6));
  });

  it('does not tunnel through a one tile wall at any speed', () => {
    const w = withTiles(
      Array.from({ length: 8 }, (_, i): [number, number, string] => [15, i + 2, '#']),
    );
    for (const speed of [1, 16, 100, 400, 480]) {
      const m = moveBox(w, box(40, 60), px(speed), 0);
      expect(m.x + m.w, `speed ${speed}`).toBeLessThanOrEqual(15 * TILE_FX);
      expect(overlapsSolid(w, m)).toBe(false);
    }
    // Many small steps from a random start also never end inside a wall.
    let b = box(30, 60);
    for (let i = 0; i < 500; i++) {
      b = moveBox(w, b, px(7), px(i % 2 ? 1 : -1));
      expect(overlapsSolid(w, b)).toBe(false);
    }
  });

  it('does not catch on seams between tiles while sliding along a wall', () => {
    const wall = Array.from({ length: 12 }, (_, i): [number, number, string] => [10, i + 2, '#']);
    const w = withTiles(wall);
    // Hugging the wall from the left, walk down the full height. Must never lose a pixel of travel.
    let b = box(150, 40); // right edge flush at 160
    for (let i = 0; i < 60; i++) {
      const n = moveBox(w, b, px(1), px(2));
      expect(n.y - b.y).toBe(px(2));
      expect(n.x).toBe(b.x);
      b = n;
    }
    // Floor seam: walk along a row of solid tiles from above.
    const floor = Array.from({ length: 14 }, (_, i): [number, number, string] => [i + 2, 10, '#']);
    const fw = withTiles(floor);
    let f = box(40, 154); // bottom flush at 160
    for (let i = 0; i < 100; i++) {
      const n = moveBox(fw, f, px(2), px(1));
      expect(n.x - f.x).toBe(px(2));
      expect(n.y).toBe(f.y);
      f = n;
    }
  });

  it('treats the edge of the loaded world as solid', () => {
    const w = withTiles([]);
    expect(moveBox(w, box(500, 100), px(100), 0).x + px(10)).toBeLessThanOrEqual(32 * TILE_FX);
    expect(moveBox(w, box(8, 100), px(-100), 0).x).toBe(0);
  });

  it('squeezes through a gap exactly as wide as the box and not narrower', () => {
    const w = withTiles([
      [10, 5, '#'],
      [12, 5, '#'],
    ]); // one tile gap, 16 px
    expect(moveBox(w, box(176, 40, 16, 6), 0, px(100)).y).toBeGreaterThan(px(80));
    const narrow = moveBox(w, box(176, 40, 17, 6), 0, px(100));
    expect(narrow.y).toBe(5 * TILE_FX - px(6));
  });
});
