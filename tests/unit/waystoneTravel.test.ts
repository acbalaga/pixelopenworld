import { describe, expect, it } from 'vitest';
import { ROOMS } from '../../src/content/world/rooms';
import { WAYSTONES } from '../../src/content/world/waystones';
import { validateSave } from '../../src/save/integrity';
import { ChunkSource, type RegionManifest } from '../../src/platform/world/chunkSource';
import { memoryStore } from '../../src/platform/world/chunkStore';
import { directLoader } from '../../src/platform/world/loader';
import { ChunkStreamer } from '../../src/platform/world/streamer';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { attune, travelBlock } from '../../src/sim/systems/waystones';
import { createChunk, encodeChunk } from '../../src/sim/world/chunk';
import { newStream, streamSystem } from '../../src/sim/world/stream';
import { TileWorld } from '../../src/sim/world/world';
import { plainFor } from '../support/saves';

const stones = WAYSTONES['dawnmeadow']!;

describe('travel is blocked inside a dungeon', () => {
  it('refuses from a dungeon room and allows it outside', () => {
    const room = ROOMS.find((r) => !r.outdoors);
    expect(room, 'the slice cave is a closed room').toBeDefined();
    const s = createDemoState(3, 0);
    s.region = 'dawnmeadow';
    s.tick = 10_000;
    s.world = { solidAt: () => 0 };
    const f = feetAt(room!.x0 + 1, room!.y0 + 1);
    const me = createAvatar(s, f.x, f.y);
    attune(s, me, 'dawnmeadow', 'hearthford');
    expect(travelBlock(s, me, 'hearthford')).toBe('dungeon');
    s.entities.comps.pos[me] = feetAt(stones[1]!.x, stones[1]!.y);
    expect(travelBlock(s, me, 'hearthford')).toBeNull();
  });
});

describe('integrity of attuned stones', () => {
  const codes = (edit: (s: SimState) => void): string[] => {
    const s = createDemoState(3, 0);
    createAvatar(s, feetAt(5, 5).x, feetAt(5, 5).y);
    edit(s);
    return validateSave(plainFor(s)).reasons.map((r) => r.code);
  };
  it('accepts real stones and flags unknown or repeated ones', () => {
    expect(codes((s) => s.map.waystones.push('dawnmeadow:millbrook'))).not.toContain('MAP_STATE');
    expect(codes((s) => s.map.waystones.push('dawnmeadow:nowhere'))).toContain('MAP_STATE');
    expect(
      codes((s) => s.map.waystones.push('dawnmeadow:millbrook', 'dawnmeadow:millbrook')),
    ).toContain('MAP_STATE');
  });
});

describe('travel across chunk streaming', () => {
  // A region as wide as Dawnmeadow, so the stones are chunks apart.
  const W = 12;
  const H = 12;
  const out = new Map<string, Uint8Array>();
  const list: RegionManifest['files'] = [];
  for (let cy = 0; cy < H; cy++)
    for (let cx = 0; cx < W; cx++) {
      out.set(`chunk-${cx}-${cy}.bin`, encodeChunk(createChunk(cx, cy)));
      list.push({ file: `chunk-${cx}-${cy}.bin`, cx, cy, hash: 'a' });
    }
  const manifest: RegionManifest = {
    region: 'dawnmeadow',
    hash: 'm',
    chunks: { w: W, h: H },
    files: list,
  };
  const fetchFn = async (url: string): Promise<Response> => {
    const f = out.get((url.split('?')[0] as string).split('/').pop() as string);
    return f ? new Response(f.slice().buffer) : new Response('', { status: 404 });
  };

  it('every pair of attuned stones is reachable, loading ahead, in well under 500 ms', async () => {
    const grid = new TileWorld();
    const streamer = new ChunkStreamer(
      directLoader(new ChunkSource(memoryStore(), fetchFn)),
      manifest,
      grid,
    );
    const s = createDemoState(3, 0);
    s.region = 'dawnmeadow';
    s.tick = 10_000;
    s.world = grid;
    s.stream = newStream(grid, false);
    const first = stones[0]!;
    const f = feetAt(first.x, first.y + 1);
    const me = createAvatar(s, f.x, f.y);
    for (const w of stones) attune(s, me, 'dawnmeadow', w.id);
    streamer.update(Math.floor(first.x / 32), Math.floor(first.y / 32));
    await streamer.whenReady();
    streamSystem(s);

    let worst = 0;
    let at = first.id;
    for (const to of [...stones, ...stones.slice().reverse()]) {
      if (to.id === at) continue;
      const t0 = performance.now();
      // The game loads the ground around the stone, then sends the command.
      expect(travelBlock(s, me, to.id)).toBe('loading');
      await streamer.preload(Math.floor(to.x / 32), Math.floor(to.y / 32));
      stepWorld(s, me, { commands: [{ type: 'travel', stone: to.id }] } as never);
      worst = Math.max(worst, performance.now() - t0);
      const p = s.entities.comps.pos[me]!;
      expect(Math.floor(p.x / 256 / 16)).toBe(to.x);
      // The destination's chunk is in, so the avatar is on ground that is there.
      expect(grid.chunk(Math.floor(to.x / 32), Math.floor(to.y / 32))).toBeDefined();
      streamer.update(Math.floor(to.x / 32), Math.floor(to.y / 32));
      s.tick += 400;
      at = to.id;
    }
    expect(worst).toBeLessThan(500);
  });
});
