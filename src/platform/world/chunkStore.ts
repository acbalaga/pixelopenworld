/**
 * Chunk file cache (M4-03). Keyed by region, chunk and bake hash, so a new bake never reads an old
 * file. Backed by IndexedDB in the browser. Every failure here degrades to "not cached": the game
 * fetches again, it never stops.
 */

/** Where fetched chunk files and manifests are kept. */
export interface ChunkStore {
  get(key: string): Promise<Uint8Array | undefined>;
  /** Stores bytes. `replaces` is a key prefix whose other entries are dropped (older hashes). */
  put(key: string, bytes: Uint8Array, replaces?: string): Promise<void>;
  /** Keys that start with `prefix`. */
  keys(prefix: string): Promise<string[]>;
}

/** Key of a chunk file. */
export const chunkFileKey = (region: string, cx: number, cy: number, hash: string): string =>
  `${region}/${cx},${cy}/${hash}`;
/** Prefix shared by every version of one chunk. */
export const chunkPrefix = (region: string, cx: number, cy: number): string =>
  `${region}/${cx},${cy}/`;
/** Key of a region's manifest copy, kept for offline starts. */
export const manifestKey = (region: string): string => `${region}/manifest`;

/** An in-memory store, for tests and for browsers with no IndexedDB. */
export function memoryStore(): ChunkStore {
  const m = new Map<string, Uint8Array>();
  return {
    get: async (k) => m.get(k),
    put: async (k, b, replaces) => {
      if (replaces)
        for (const o of [...m.keys()]) if (o.startsWith(replaces) && o !== k) m.delete(o);
      m.set(k, b);
    },
    keys: async (p) => [...m.keys()].filter((k) => k.startsWith(p)),
  };
}

const DB = 'pow-world';
const STORE = 'files';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

/** Opens the IndexedDB store. Falls back to memory if IndexedDB is missing or refuses. */
export async function openChunkStore(): Promise<ChunkStore> {
  try {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onsuccess = () => res(open.result);
      open.onerror = () => rej(open.error);
    });
    const store = (mode: IDBTransactionMode): IDBObjectStore =>
      db.transaction(STORE, mode).objectStore(STORE);
    return {
      get: async (k) => {
        try {
          const v = (await req(store('readonly').get(k))) as ArrayBuffer | undefined;
          return v ? new Uint8Array(v) : undefined;
        } catch {
          return undefined;
        }
      },
      put: async (k, bytes, replaces) => {
        try {
          const os = store('readwrite');
          if (replaces) {
            const old = (await req(
              os.getAllKeys(IDBKeyRange.bound(replaces, `${replaces}￿`)),
            )) as string[];
            for (const o of old) if (o !== k) os.delete(o);
          }
          // Copy: the caller may hand the same buffer to a decoder that transfers it.
          os.put(bytes.slice().buffer, k);
        } catch {
          // Not cached. The next load fetches again.
        }
      },
      keys: async (p) => {
        try {
          return (await req(
            store('readonly').getAllKeys(IDBKeyRange.bound(p, `${p}￿`)),
          )) as string[];
        } catch {
          return [];
        }
      },
    };
  } catch {
    return memoryStore();
  }
}
