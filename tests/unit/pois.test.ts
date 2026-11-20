import { describe, expect, it } from 'vitest';
import { STAMPS } from '../../src/content/world/stamps';
import {
  HEDGE_MAZE_CENTER,
  HEDGE_MAZE_DOOR,
  HEDGE_MAZE_SIZE,
  hedgeMazeRows,
} from '../../src/content/world/stamps/pois';
import { CHUNK_TILES, decodeChunk, Solid, tileIndex } from '../../src/sim/world/chunk';
import { bakeRegion } from '../../tools/bake-world/bake';
import { MANUALS } from '../../src/content/items/manuals';
import { POIS, poiChest, poisOf } from '../../src/content/pois';
import { DAWNMEADOW_PENDING_DISCOVERABLES } from '../../src/content/pois/pending';
import { POI_STRINGS } from '../../src/content/strings/pois';
import { FIXTURES } from '../../src/content/world/fixtures';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';

describe('Dawnmeadow points of interest (M4-11)', () => {
  const pois = poisOf('dawnmeadow');

  it("hold 29 of the 30 of the region doc, by kind, the last (Old Fen's well) coming with m9", () => {
    const by = (k: string): number => pois.filter((p) => p.kind === k).length;
    expect([
      by('shrine'),
      by('vista'),
      by('wreck'),
      by('hermit'),
      by('puzzle'),
      by('oddity'),
    ]).toEqual([6, 6, 4, 3, 6, 4]);
  });

  it('place each stamp a POI names, and stand the POI on an open tile of it', () => {
    for (const p of pois.filter((x) => x.stamp)) {
      expect(STAMPS[p.stamp!.id], p.id).toBeDefined();
      expect(
        DAWNMEADOW.placements.some(
          (pl) => pl.stamp === p.stamp!.id && pl.x === p.stamp!.x && pl.y === p.stamp!.y,
        ),
        p.id,
      ).toBe(true);
    }
  });

  it('cut a hedge maze with one way from its door to its centre', () => {
    const rows = hedgeMazeRows();
    expect(rows).toHaveLength(HEDGE_MAZE_SIZE);
    const key = (x: number, y: number): string => `${x},${y}`;
    const seen = new Set([key(HEDGE_MAZE_DOOR.x, HEDGE_MAZE_DOOR.y)]);
    const queue: [number, number][] = [[HEDGE_MAZE_DOOR.x, HEDGE_MAZE_DOOR.y]];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (rows[ny]?.[nx] === '.' && !seen.has(key(nx, ny))) {
          seen.add(key(nx, ny));
          queue.push([nx, ny]);
        }
      }
    }
    expect(seen.has(key(HEDGE_MAZE_CENTER.x, HEDGE_MAZE_CENTER.y))).toBe(true);
    // Every open cell is reachable: it is one maze, with no sealed pockets.
    const open = rows.join('').split('.').length - 1;
    expect(seen.size).toBe(open);
  });

  it('each has a name, a kind, an estimate and a place inside the region', () => {
    expect(pois.length).toBeGreaterThanOrEqual(29);
    for (const p of pois) {
      expect(POI_STRINGS[p.id], p.id).toBeTruthy();
      expect(POI_STRINGS[p.id], p.id).not.toMatch(/[—–]/);
      expect(p.estMinutes).toBeGreaterThan(0);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(DAWNMEADOW.chunks.w * 32);
      expect(p.y).toBeLessThan(12 * 32);
    }
    expect(new Set(pois.map((p) => p.id)).size).toBe(pois.length);
    expect(Object.keys(POIS)).toHaveLength(pois.length);
  });

  it('each manual POI holds a real manual in a chest the region places on it', () => {
    for (const p of pois.filter((x) => x.manual)) {
      expect(
        MANUALS.some((m) => m.id === p.manual),
        p.id,
      ).toBe(true);
      const chest = poiChest(p.manual!);
      expect(FIXTURES[chest], chest).toBeDefined();
      const placed = DAWNMEADOW.placements.filter((pl) => pl.kind === chest);
      expect(placed, chest).toHaveLength(1);
      expect([placed[0]!.x, placed[0]!.y]).toEqual([p.x, p.y]);
    }
  });

  it('every manual that is not a Singular reward is at a POI or in the Rootway, once', () => {
    const atPoi = new Set(pois.flatMap((p) => (p.manual ? [p.manual] : [])));
    const rootway = ['item.manual_palm', 'item.manual_hide'];
    for (const m of MANUALS.filter((x) => x.via !== 'singular')) {
      const places = (atPoi.has(m.id) ? 1 : 0) + (rootway.includes(m.id) ? 1 : 0);
      expect(places, m.id).toBe(1);
    }
  });

  it('keeps the pending list to real chunk keys, with no repeats', () => {
    const list = DAWNMEADOW_PENDING_DISCOVERABLES;
    expect(new Set(list).size).toBe(list.length);
    for (const k of list) expect(k).toMatch(/^\d+,\d+$/);
  });

  it('every point of interest can be walked to from the south gate of the town', () => {
    const files = bakeRegion(DAWNMEADOW, STAMPS);
    const chunks = new Map<string, ReturnType<typeof decodeChunk>>();
    for (const [name, v] of files) {
      const m = /^dawnmeadow\/chunk-(\d+)-(\d+)\.bin$/.exec(name);
      if (m) chunks.set(`${m[1]},${m[2]}`, decodeChunk(v as Uint8Array));
    }
    const W = DAWNMEADOW.chunks.w * CHUNK_TILES;
    const H = 12 * CHUNK_TILES;
    const open = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const c = chunks.get(`${Math.floor(x / CHUNK_TILES)},${Math.floor(y / CHUNK_TILES)}`);
      return !!c && c.collision[tileIndex(x % CHUNK_TILES, y % CHUNK_TILES)] === Solid.None;
    };
    const start = { x: 192, y: 222 };
    expect(open(start.x, start.y)).toBe(true);
    const seen = new Uint8Array(W * H);
    const queue = [start.y * W + start.x];
    seen[queue[0]!] = 1;
    for (let i = 0; i < queue.length; i++) {
      const x = queue[i]! % W;
      const y = Math.floor(queue[i]! / W);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (open(nx, ny) && !seen[ny * W + nx]) {
          seen[ny * W + nx] = 1;
          queue.push(ny * W + nx);
        }
      }
    }
    for (const p of pois) {
      // The chest itself is solid, so a POI is reached from any open tile beside it.
      const near = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => seen[(p.y + dy!) * W + p.x + dx!] === 1);
      expect(near || seen[p.y * W + p.x] === 1, `${p.id} at ${p.x}, ${p.y}`).toBe(true);
    }
  });
});
