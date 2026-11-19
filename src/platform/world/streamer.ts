import { WORLD_TUNABLES as W } from '../../content/balance/world';
import type { Chunk } from '../../sim/world/chunk';
import { ACTIVE_RADIUS, chunkKey, inWindow, loadOrder, windowChunks } from '../../sim/world/window';
import type { TileWorld } from '../../sim/world/world';
import type { ManifestFile, RegionManifest } from './chunkSource';
import type { ChunkLoader } from './loader';

/**
 * Keeps the tile world equal to the loaded window around the avatar (M4-03): 5 x 5 chunks, fetched
 * and decoded off the main thread, the nearest and the ones ahead of travel first, with a few
 * fetches in flight at a time. Chunks that fall more than {@link W.evictRadius} chunks behind are
 * dropped. Call {@link update} once per frame with the avatar's chunk. It does almost nothing
 * until the chunk changes or a fetch lands.
 */
export class ChunkStreamer {
  private readonly index = new Map<string, ManifestFile>();
  private readonly inflight = new Set<string>();
  private readonly failed = new Map<string, number>();
  private ax = Number.NaN;
  private ay = Number.NaN;
  private dx = 0;
  private dy = 0;
  private dirty = true;
  private tick = 0;
  /** Called with each chunk as it joins the world, and with the coordinates of each dropped one. */
  onChunk: (chunk: Chunk) => void = () => {};
  onDrop: (cx: number, cy: number) => void = () => {};
  /** Counters for tests and the debug line. */
  fetched = 0;
  evicted = 0;

  constructor(
    private readonly loader: ChunkLoader,
    readonly manifest: RegionManifest,
    private readonly world: TileWorld,
  ) {
    for (const f of manifest.files) this.index.set(chunkKey(f.cx, f.cy), f);
  }

  /** True for chunk coordinates outside the region. */
  beyondEdge = (cx: number, cy: number): boolean =>
    cx < 0 || cy < 0 || cx >= this.manifest.chunks.w || cy >= this.manifest.chunks.h;

  /** True if the region has a chunk file at these coordinates. */
  has(cx: number, cy: number): boolean {
    return this.index.has(chunkKey(cx, cy));
  }

  /** True once every chunk of the active window that exists has arrived. */
  activeReady(): boolean {
    for (let cy = this.ay - ACTIVE_RADIUS; cy <= this.ay + ACTIVE_RADIUS; cy++)
      for (let cx = this.ax - ACTIVE_RADIUS; cx <= this.ax + ACTIVE_RADIUS; cx++)
        if (this.has(cx, cy) && !this.world.chunk(cx, cy)) return false;
    return true;
  }

  /** Chunks being fetched now. */
  get loading(): number {
    return this.inflight.size;
  }

  /** Tells the streamer where the avatar is. Cheap when nothing changed. */
  update(cx: number, cy: number): void {
    if (cx !== this.ax || cy !== this.ay) {
      if (!Number.isNaN(this.ax)) {
        this.dx = Math.sign(cx - this.ax) || this.dx;
        this.dy = Math.sign(cy - this.ay) || this.dy;
      }
      this.ax = cx;
      this.ay = cy;
      this.dirty = true;
      this.evict();
    }
    this.tick++;
    if (!this.dirty) return;
    this.pump();
  }

  private evict(): void {
    // Walk the index: it is the region's chunk list, a few hundred entries at most.
    for (const f of this.index.values()) {
      if (!this.world.chunk(f.cx, f.cy)) continue;
      if (inWindow(f.cx, f.cy, this.ax, this.ay, W.evictRadius)) continue;
      this.world.remove(f.cx, f.cy);
      this.onDrop(f.cx, f.cy);
      this.evicted++;
    }
  }

  private pump(): void {
    let wantsMore = false;
    for (const c of loadOrder(this.ax, this.ay, this.dx, this.dy)) {
      const key = chunkKey(c.cx, c.cy);
      const f = this.index.get(key);
      if (!f || this.world.chunk(c.cx, c.cy) || this.inflight.has(key)) continue;
      // A failed chunk is tried again after a pause, so a dropped connection recovers by itself.
      if ((this.failed.get(key) ?? 0) > this.tick) {
        wantsMore = true;
        continue;
      }
      if (this.inflight.size >= W.fetchesInFlight) {
        wantsMore = true;
        break;
      }
      this.inflight.add(key);
      wantsMore = true;
      void this.loader.load(this.manifest.region, f).then(
        (chunk) => {
          this.inflight.delete(key);
          // The avatar may have moved on while it was in flight.
          if (inWindow(chunk.cx, chunk.cy, this.ax, this.ay, W.evictRadius)) {
            this.world.set(chunk);
            this.fetched++;
            this.onChunk(chunk);
          }
          this.dirty = true;
        },
        () => {
          this.inflight.delete(key);
          this.failed.set(key, this.tick + 120);
          this.dirty = true;
        },
      );
    }
    // Stay dirty while there is more to fetch, so the next completions start the next fetches.
    this.dirty = wantsMore;
  }

  /**
   * Loads the active window around a chunk the avatar is about to be moved to (Waystone travel),
   * so it lands on ground that is there. Chunks already in, or in flight, are left alone.
   */
  async preload(cx: number, cy: number): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const c of windowChunks(cx, cy, ACTIVE_RADIUS)) {
      const key = chunkKey(c.cx, c.cy);
      const f = this.index.get(key);
      if (!f || this.world.chunk(c.cx, c.cy)) continue;
      jobs.push(
        this.loader.load(this.manifest.region, f).then((chunk) => {
          if (this.world.chunk(chunk.cx, chunk.cy)) return;
          this.world.set(chunk);
          this.fetched++;
          this.onChunk(chunk);
        }),
      );
    }
    await Promise.all(jobs);
    this.dirty = true;
  }

  /** Resolves when the active window has arrived. Rejects if the start chunk has no file. */
  async whenReady(): Promise<void> {
    for (let i = 0; i < 6000; i++) {
      this.update(this.ax, this.ay);
      if (this.activeReady() && this.inflight.size === 0) return;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('chunks did not load');
  }
}
