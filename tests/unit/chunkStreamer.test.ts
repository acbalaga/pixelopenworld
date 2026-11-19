import { describe, expect, it } from 'vitest';
import { ChunkSource, type RegionManifest } from '../../src/platform/world/chunkSource';
import { memoryStore } from '../../src/platform/world/chunkStore';
import { directLoader } from '../../src/platform/world/loader';
import { ChunkStreamer } from '../../src/platform/world/streamer';
import { createChunk, encodeChunk } from '../../src/sim/world/chunk';
import { TileWorld } from '../../src/sim/world/world';

const W = 10;
const H = 3;

function files(hashOf: (cx: number, cy: number) => string) {
  const out = new Map<string, Uint8Array>();
  const list = [];
  for (let cy = 0; cy < H; cy++)
    for (let cx = 0; cx < W; cx++) {
      const c = createChunk(cx, cy);
      c.ground.fill(1 + ((cx + cy) % 3));
      out.set(`chunk-${cx}-${cy}.bin`, encodeChunk(c));
      list.push({ file: `chunk-${cx}-${cy}.bin`, cx, cy, hash: hashOf(cx, cy) });
    }
  const manifest: RegionManifest = { region: 'r', hash: 'm1', chunks: { w: W, h: H }, files: list };
  return { out, manifest };
}

/** A fake server with a request log, and a switch to take the network away. */
function server(out: Map<string, Uint8Array>, manifest: RegionManifest) {
  const log: string[] = [];
  let online = true;
  const fetchFn = async (url: string): Promise<Response> => {
    log.push(url);
    if (!online) throw new TypeError('offline');
    const path = url.split('?')[0] as string;
    if (path.endsWith('manifest.json')) return new Response(JSON.stringify(manifest));
    const f = out.get(path.split('/').pop() as string);
    return f ? new Response(f.slice().buffer) : new Response('', { status: 404 });
  };
  return { fetchFn, log, offline: () => (online = false) };
}

describe('ChunkSource', () => {
  it('fetches once, then serves from the cache', async () => {
    const { out, manifest } = files(() => 'a');
    const srv = server(out, manifest);
    const src = new ChunkSource(memoryStore(), srv.fetchFn);
    const f = manifest.files[0]!;
    await src.chunk('r', f);
    await src.chunk('r', f);
    expect(srv.log.filter((u) => u.includes('chunk-0-0'))).toHaveLength(1);
  });

  it('a new bake hash is a new cache entry and drops the old one', async () => {
    const store = memoryStore();
    const one = files(() => 'a');
    const src = new ChunkSource(store, server(one.out, one.manifest).fetchFn);
    await src.chunk('r', one.manifest.files[0]!);
    const two = files(() => 'b');
    const srv2 = server(two.out, two.manifest);
    const src2 = new ChunkSource(store, srv2.fetchFn);
    await src2.chunk('r', two.manifest.files[0]!);
    expect(srv2.log.some((u) => u.includes('h=b'))).toBe(true);
    expect(await store.keys('r/0,0/')).toEqual(['r/0,0/b']);
  });

  it('starts offline from a prefetched region and from the kept manifest', async () => {
    const { out, manifest } = files(() => 'a');
    const store = memoryStore();
    const srv = server(out, manifest);
    const src = new ChunkSource(store, srv.fetchFn);
    expect(await src.complete(manifest)).toBe(false);
    await src.manifest('r');
    await src.prefetch(manifest);
    expect(await src.complete(manifest)).toBe(true);
    srv.offline();
    const m = await src.manifest('r');
    expect(m.hash).toBe('m1');
    for (const f of m.files) expect((await src.chunk('r', f)).ground[0]).toBeGreaterThan(0);
  });

  it('keeps a pin', async () => {
    const src = new ChunkSource(memoryStore(), async () => new Response(''));
    expect(await src.pinned('r')).toBe(false);
    await src.setPinned('r', true);
    expect(await src.pinned('r')).toBe(true);
  });
});

describe('ChunkStreamer', () => {
  const setup = () => {
    const { out, manifest } = files(() => 'a');
    const srv = server(out, manifest);
    const world = new TileWorld();
    const s = new ChunkStreamer(
      directLoader(new ChunkSource(memoryStore(), srv.fetchFn)),
      manifest,
      world,
    );
    return { s, world, srv };
  };
  const settle = async (s: ChunkStreamer, cx: number, cy: number): Promise<void> => {
    for (let i = 0; i < 100; i++) {
      s.update(cx, cy);
      if (s.loading === 0) return;
      await new Promise((r) => setTimeout(r, 1));
    }
  };

  it('loads the 5 x 5 window clipped to the region, and nothing more', async () => {
    const { s, world } = setup();
    s.update(4, 1);
    await settle(s, 4, 1);
    await settle(s, 4, 1);
    // x 2..6 by y 0..2 (rows -1 and 3 do not exist).
    expect(world.size).toBe(5 * 3);
    expect(s.activeReady()).toBe(true);
  });

  it('never has more than the allowed fetches in flight', async () => {
    const { s } = setup();
    s.update(4, 1);
    expect(s.loading).toBeLessThanOrEqual(4);
  });

  it('crossing the region keeps the loaded set bounded and drops what is behind', async () => {
    const { s, world } = setup();
    let most = 0;
    for (let cx = 0; cx < W; cx++) {
      await settle(s, cx, 1);
      await settle(s, cx, 1);
      most = Math.max(most, world.size);
      expect(world.chunk(cx, 1)).toBeDefined();
    }
    // Window 5 wide plus one chunk of hysteresis behind, 3 rows.
    expect(most).toBeLessThanOrEqual(6 * 3);
    expect(world.chunk(0, 1)).toBeUndefined();
    expect(s.evicted).toBeGreaterThan(0);
  });

  it('reports drops and arrivals, and says what lies beyond the edge', async () => {
    const { s } = setup();
    const got: string[] = [];
    s.onChunk = (c) => got.push(`${c.cx},${c.cy}`);
    await settle(s, 0, 0);
    await settle(s, 0, 0);
    expect(got).toContain('0,0');
    expect(s.beyondEdge(-1, 0)).toBe(true);
    expect(s.beyondEdge(0, 0)).toBe(false);
    expect(s.beyondEdge(W, 0)).toBe(true);
  });

  it('with no network and nothing cached, stays empty and does not throw', async () => {
    const { s, srv, world } = setup();
    srv.offline();
    s.update(0, 0);
    await settle(s, 0, 0);
    expect(world.size).toBe(0);
  });
});
