import type { Chunk } from '../../sim/world/chunk';
import { ChunkSource, type ManifestFile, type RegionManifest } from './chunkSource';
import { openChunkStore } from './chunkStore';
import type { WorkerReply, WorkerRequest } from './protocol';

/** What the streamer needs to get chunks. Backed by the worker in the browser. */
export interface ChunkLoader {
  manifest(region: string): Promise<RegionManifest>;
  load(region: string, file: ManifestFile): Promise<Chunk>;
  /** Fetches every chunk of the region into the cache. */
  prefetch(
    manifest: RegionManifest,
    progress?: (done: number, total: number) => void,
  ): Promise<void>;
  /** Whether the region is fully cached and whether the player keeps it. */
  status(manifest: RegionManifest): Promise<{ complete: boolean; pinned: boolean }>;
  pin(region: string, on: boolean): Promise<void>;
}

/** Runs a {@link ChunkSource} on this thread. For tests and for browsers without module workers. */
export function directLoader(source: ChunkSource): ChunkLoader {
  return {
    manifest: (r) => source.manifest(r),
    load: (r, f) => source.chunk(r, f),
    prefetch: (m, p) => source.prefetch(m, p),
    status: async (m) => ({
      complete: await source.complete(m),
      pinned: await source.pinned(m.region),
    }),
    pin: (r, on) => source.setPinned(r, on),
  };
}

/** The chunk worker as a loader. Replies are matched to requests by id. */
export function workerLoader(worker: Worker): ChunkLoader {
  let next = 1;
  const waiting = new Map<
    number,
    {
      ok: (r: WorkerReply) => void;
      fail: (e: Error) => void;
      progress?: ((d: number, t: number) => void) | undefined;
    }
  >();
  worker.onmessage = (e: MessageEvent<WorkerReply>) => {
    const m = e.data;
    const w = waiting.get(m.id);
    if (!w) return;
    if (m.type === 'progress') {
      w.progress?.(m.done, m.total);
      return;
    }
    waiting.delete(m.id);
    if (m.type === 'error') w.fail(new Error(m.message));
    else w.ok(m);
  };
  const ask = (
    make: (id: number) => WorkerRequest,
    progress?: (d: number, t: number) => void,
  ): Promise<WorkerReply> =>
    new Promise((ok, fail) => {
      const id = next++;
      waiting.set(id, { ok, fail, progress });
      worker.postMessage(make(id));
    });
  return {
    manifest: async (region) => {
      const r = await ask((id) => ({ type: 'manifest', id, region }));
      if (r.type !== 'manifest') throw new Error('bad reply');
      return r.manifest;
    },
    load: async (region, file) => {
      const r = await ask((id) => ({ type: 'chunk', id, region, file }));
      if (r.type !== 'chunk') throw new Error('bad reply');
      return r.chunk;
    },
    prefetch: async (manifest, progress) => {
      await ask((id) => ({ type: 'prefetch', id, manifest }), progress);
    },
    status: async (manifest) => {
      const r = await ask((id) => ({ type: 'status', id, manifest }));
      if (r.type !== 'status') throw new Error('bad reply');
      return { complete: r.complete, pinned: r.pinned };
    },
    pin: async (region, on) => {
      await ask((id) => ({ type: 'pin', id, region, on }));
    },
  };
}

/** The loader for this browser: the worker if it starts, otherwise this thread. */
export async function browserLoader(): Promise<ChunkLoader> {
  try {
    return workerLoader(
      new Worker(new URL('./chunkWorker.ts', import.meta.url), { type: 'module' }),
    );
  } catch {
    return directLoader(new ChunkSource(await openChunkStore(), (u) => fetch(u)));
  }
}
