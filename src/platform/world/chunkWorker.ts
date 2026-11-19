/// <reference lib="webworker" />
/**
 * The chunk worker (M4-03): fetches chunk files through the cache and decodes them off the main
 * thread, then hands the layers back as transferred buffers so the game thread copies nothing.
 */
import { ChunkSource } from './chunkSource';
import { openChunkStore } from './chunkStore';
import type { WorkerReply, WorkerRequest } from './protocol';

const source = openChunkStore().then((store) => new ChunkSource(store, (u) => fetch(u)));

function reply(m: WorkerReply, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(m, transfer);
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const m = e.data;
  void (async () => {
    const src = await source;
    try {
      switch (m.type) {
        case 'manifest':
          reply({ type: 'manifest', id: m.id, manifest: await src.manifest(m.region) });
          break;
        case 'chunk': {
          const c = await src.chunk(m.region, m.file);
          reply({ type: 'chunk', id: m.id, chunk: c }, [
            c.ground.buffer,
            c.detail.buffer,
            c.object.buffer,
            c.overhead.buffer,
            c.collision.buffer,
            c.elevation.buffer,
          ]);
          break;
        }
        case 'prefetch':
          await src.prefetch(m.manifest, (done, total) =>
            reply({ type: 'progress', id: m.id, done, total }),
          );
          reply({ type: 'done', id: m.id });
          break;
        case 'pin':
          await src.setPinned(m.region, m.on);
          reply({ type: 'done', id: m.id });
          break;
        case 'status': {
          reply({
            type: 'status',
            id: m.id,
            complete: await src.complete(m.manifest),
            pinned: await src.pinned(m.manifest.region),
          });
          break;
        }
      }
    } catch (err) {
      reply({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) });
    }
  })();
};
