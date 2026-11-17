import {
  emptySlots,
  SLOTS,
  type SaveRecord,
  type SaveStorage,
  type Slot,
  type Slots,
} from './types';

/** In memory. For tests and for browsers with no IndexedDB (saving then lasts one page life). */
export class MemoryStorage implements SaveStorage {
  private slots: Slots = emptySlots();
  /** Test hook: the next `replaceAll` fails after staging, applying nothing, as an aborted transaction does. */
  failNext = false;

  async readAll(): Promise<Slots> {
    const out = emptySlots();
    for (const s of SLOTS) out[s] = this.slots[s] ? { ...(this.slots[s] as SaveRecord) } : null;
    return out;
  }

  async replaceAll(slots: Slots): Promise<void> {
    const staged = emptySlots();
    for (const s of SLOTS) staged[s] = slots[s] ? { ...(slots[s] as SaveRecord) } : null;
    if (this.failNext) {
      this.failNext = false;
      throw new Error('aborted');
    }
    this.slots = staged;
  }

  /** Test hook: edits a stored record's bytes in place, to simulate corruption. */
  corrupt(slot: Slot, at = 0): void {
    const r = this.slots[slot];
    if (r) r.bytes = r.bytes.map((b, i) => (i === at ? b ^ 0xff : b));
  }
}

const DB_NAME = 'pow-save';
const STORE = 'slots';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onblocked = () => reject(new Error('indexedDB open blocked'));
  });
}

/**
 * IndexedDB. Every write is ONE readwrite transaction covering all slots, so a tab killed
 * mid-save leaves the old records and never a half-written latest.
 */
export class IdbStorage implements SaveStorage {
  private db: Promise<IDBDatabase> | null = null;

  private conn(): Promise<IDBDatabase> {
    this.db ??= open();
    return this.db;
  }

  async readAll(): Promise<Slots> {
    const db = await this.conn();
    return new Promise((resolve, reject) => {
      const out = emptySlots();
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        for (const row of req.result as (SaveRecord & { slot: Slot })[]) {
          if (SLOTS.includes(row.slot)) {
            const { slot, ...rec } = row;
            out[slot] = rec;
          }
        }
      };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error ?? new Error('read failed'));
      tx.onabort = () => reject(tx.error ?? new Error('read aborted'));
    });
  }

  async replaceAll(slots: Slots): Promise<void> {
    const db = await this.conn();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const s of SLOTS) {
        const rec = slots[s];
        if (rec) store.put({ slot: s, ...rec });
        else store.delete(s);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('write aborted'));
    });
  }
}

/** The best storage this browser offers. */
export function createStorage(): SaveStorage {
  return typeof indexedDB === 'undefined' ? new MemoryStorage() : new IdbStorage();
}
