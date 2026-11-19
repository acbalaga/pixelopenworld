import { decodeChunk, type Chunk } from '../../sim/world/chunk';
import { chunkFileKey, chunkPrefix, manifestKey, type ChunkStore } from './chunkStore';

/** One chunk file named by a region manifest. */
export interface ManifestFile {
  file: string;
  cx: number;
  cy: number;
  hash: string;
}

/** The parts of a region manifest the loader reads. */
export interface RegionManifest {
  region: string;
  /** Hash of the whole bake. A change means some chunk changed. */
  hash: string;
  chunks: { w: number; h: number };
  files: ManifestFile[];
  /** Where a new character may start, in tiles. */
  wakePoints?: { id: string; x: number; y: number }[];
  waystones?: { id: string; x: number; y: number }[];
}

const dec = new TextDecoder();
const enc = new TextEncoder();

/**
 * Gets chunk files: the cache first, then the network, keeping what it fetched. Runs inside the
 * chunk worker, and directly in tests with an in-memory store and a fake `fetch`.
 */
export class ChunkSource {
  constructor(
    private readonly store: ChunkStore,
    private readonly fetchFn: (url: string) => Promise<Response>,
    private readonly base = '/world',
  ) {}

  /** URL of a chunk file. The hash is in the query so a new bake is a new URL for every cache. */
  url(region: string, f: ManifestFile): string {
    return `${this.base}/${region}/${f.file}?h=${f.hash}`;
  }

  /** The region manifest: the network when it answers, the stored copy when it does not. */
  async manifest(region: string): Promise<RegionManifest> {
    try {
      const res = await this.fetchFn(`${this.base}/${region}/manifest.json`);
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const parsed = JSON.parse(dec.decode(bytes)) as RegionManifest;
      await this.store.put(manifestKey(region), bytes);
      return parsed;
    } catch (e) {
      const kept = await this.store.get(manifestKey(region));
      if (!kept) throw e;
      return JSON.parse(dec.decode(kept)) as RegionManifest;
    }
  }

  /** The bytes of a chunk file. */
  async bytes(region: string, f: ManifestFile): Promise<Uint8Array> {
    const key = chunkFileKey(region, f.cx, f.cy, f.hash);
    const hit = await this.store.get(key);
    if (hit) return hit;
    const res = await this.fetchFn(this.url(region, f));
    if (!res.ok) throw new Error(`chunk ${region} ${f.cx},${f.cy}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    await this.store.put(key, bytes, chunkPrefix(region, f.cx, f.cy));
    return bytes;
  }

  /** A decoded chunk. A cached copy that fails to decode is dropped and fetched once more. */
  async chunk(region: string, f: ManifestFile): Promise<Chunk> {
    const bytes = await this.bytes(region, f);
    try {
      return decodeChunk(bytes);
    } catch {
      await this.store.put(chunkFileKey(region, f.cx, f.cy, f.hash), new Uint8Array(0));
      const res = await this.fetchFn(this.url(region, f));
      const fresh = new Uint8Array(await res.arrayBuffer());
      await this.store.put(
        chunkFileKey(region, f.cx, f.cy, f.hash),
        fresh,
        chunkPrefix(region, f.cx, f.cy),
      );
      return decodeChunk(fresh);
    }
  }

  /** Fetches every chunk file of a region into the cache, a few at a time. */
  async prefetch(
    manifest: RegionManifest,
    progress: (done: number, total: number) => void = () => {},
    parallel = 4,
  ): Promise<void> {
    const todo = [...manifest.files];
    let done = 0;
    const worker = async (): Promise<void> => {
      for (let f = todo.shift(); f; f = todo.shift()) {
        await this.bytes(manifest.region, f);
        progress(++done, manifest.files.length);
      }
    };
    await Promise.all(Array.from({ length: parallel }, worker));
  }

  /** True if every chunk file of the region is already in the cache. */
  async complete(manifest: RegionManifest): Promise<boolean> {
    for (const f of manifest.files)
      if (!(await this.store.get(chunkFileKey(manifest.region, f.cx, f.cy, f.hash)))) return false;
    return true;
  }

  /** Marks a region as one the player keeps. Read back by {@link pinned}. */
  async setPinned(region: string, on: boolean): Promise<void> {
    await this.store.put(`pin/${region}`, enc.encode(on ? '1' : '0'));
  }

  async pinned(region: string): Promise<boolean> {
    const v = await this.store.get(`pin/${region}`);
    return !!v && dec.decode(v) === '1';
  }
}
