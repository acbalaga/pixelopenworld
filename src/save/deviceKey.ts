/**
 * The device key (tech/02): an AES-256-GCM CryptoKey generated once per browser profile with
 * `extractable = false`, and kept in IndexedDB as the key object itself. Script can use it to
 * encrypt and decrypt but can never read its bytes, so a local save cannot be opened outside
 * this profile.
 */

/** Where the CryptoKey object lives. */
export interface KeyStore {
  get(): Promise<CryptoKey | null>;
  put(key: CryptoKey): Promise<void>;
}

/** In memory. For tests. */
export class MemoryKeyStore implements KeyStore {
  private key: CryptoKey | null = null;
  async get(): Promise<CryptoKey | null> {
    return this.key;
  }
  async put(key: CryptoKey): Promise<void> {
    this.key = key;
  }
}

const DB_NAME = 'pow-keys';
const STORE = 'keys';
const ID = 'device';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onblocked = () => reject(new Error('indexedDB open blocked'));
  });
}

/** IndexedDB. A CryptoKey survives structured clone, so it is stored as it is. */
export class IdbKeyStore implements KeyStore {
  private db: Promise<IDBDatabase> | null = null;
  private conn(): Promise<IDBDatabase> {
    this.db ??= open();
    return this.db;
  }

  async get(): Promise<CryptoKey | null> {
    const db = await this.conn();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(ID);
      req.onsuccess = () => resolve((req.result as CryptoKey | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('key read failed'));
    });
  }

  async put(key: CryptoKey): Promise<void> {
    const db = await this.conn();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      // `add`, not `put`: if another tab created a key first, this fails and that key wins.
      tx.objectStore(STORE).add(key, ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('key write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('key write aborted'));
    });
  }
}

/** Generates a fresh non-extractable key. */
export function generateDeviceKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * Returns the device key, creating and storing it on first run. If two tabs race on first run,
 * the one whose write lost reads the winner's key back, so both use the same one.
 */
export async function loadDeviceKey(
  store: KeyStore,
  generate: () => Promise<CryptoKey> = generateDeviceKey,
): Promise<CryptoKey> {
  const have = await store.get();
  if (have) return have;
  const fresh = await generate();
  try {
    await store.put(fresh);
    return fresh;
  } catch {
    const winner = await store.get();
    if (winner) return winner;
    throw new Error('device key could not be stored');
  }
}
