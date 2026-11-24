/**
 * Settings persistence (tech/01: settings live in IndexedDB, outside the save). Losing a setting
 * is an annoyance, not data loss, so every failure here is swallowed and the defaults stay.
 */

import type { Settings, SettingsStore } from './settings';

/** Where the settings record is kept. */
export interface SettingsBackend {
  read(): Promise<unknown>;
  write(value: Settings): Promise<void>;
}

const NUMBERS = ['textScale', 'hudScale', 'buttonScale', 'hudOpacity'] as const;
const BOOLEANS = [
  'reducedMotion',
  'haptics',
  'muted',
  'guardToggle',
  'chatCollapsed',
  'minimap',
  'showGiverMarks',
  'showNames',
  'prefetchRegions',
] as const;

/** Keeps only the fields that are present and of the right type. The store clamps the numbers. */
export function sanitizeSettings(raw: unknown): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const k of NUMBERS) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  for (const k of BOOLEANS) {
    const v = r[k];
    if (typeof v === 'boolean') out[k] = v;
  }
  if (r.handedness === 'left' || r.handedness === 'right') out.handedness = r.handedness;
  if (r.controlScheme === 'flow' || r.controlScheme === 'classic')
    out.controlScheme = r.controlScheme;
  if (typeof r.chatTab === 'string' && r.chatTab.length <= 12) out.chatTab = r.chatTab;
  if (typeof r.menuTab === 'string' && r.menuTab.length <= 16) out.menuTab = r.menuTab;
  if (typeof r.menuScroll === 'number' && Number.isFinite(r.menuScroll) && r.menuScroll >= 0)
    out.menuScroll = Math.min(100_000, Math.floor(r.menuScroll));
  if (Array.isArray(r.pinnedRegions))
    out.pinnedRegions = r.pinnedRegions
      .filter((x): x is string => typeof x === 'string' && /^[a-z][a-z0-9_]{0,40}$/.test(x))
      .slice(0, 40);
  if (Array.isArray(r.quickItems))
    out.quickItems = r.quickItems
      .filter((x): x is string => typeof x === 'string' && /^item\.[a-z0-9_]{1,40}$/.test(x))
      .slice(-3);
  if (
    typeof r.quickPick === 'string' &&
    (r.quickPick === '' || /^item\.[a-z0-9_]{1,40}$/.test(r.quickPick))
  )
    out.quickPick = r.quickPick;
  if (Array.isArray(r.closedSections))
    out.closedSections = r.closedSections
      .filter((x): x is string => typeof x === 'string' && x.length <= 40)
      .slice(0, 60);
  return out;
}

/** Applies what the backend holds, if anything usable. Never throws. */
export async function restoreSettings(
  store: SettingsStore,
  backend: SettingsBackend,
): Promise<void> {
  try {
    store.set(sanitizeSettings(await backend.read()));
  } catch {
    // Keep the defaults.
  }
}

/** Writes the settings after every change. Returns the unsubscribe. Writes never overlap. */
export function persistSettings(store: SettingsStore, backend: SettingsBackend): () => void {
  let writing = false;
  let dirty = false;
  const flush = async (): Promise<void> => {
    if (writing) {
      dirty = true;
      return;
    }
    writing = true;
    try {
      do {
        dirty = false;
        await backend.write({ ...store.get() });
      } while (dirty);
    } catch {
      // The next change tries again.
    } finally {
      writing = false;
    }
  };
  return store.subscribe(() => void flush());
}

const DB_NAME = 'pow-settings';
const STORE = 'kv';
const KEY = 'settings';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onblocked = () => reject(new Error('indexedDB open blocked'));
  });
}

/** IndexedDB, one record. */
export class IdbSettingsBackend implements SettingsBackend {
  private db: Promise<IDBDatabase> | null = null;

  private conn(): Promise<IDBDatabase> {
    this.db ??= open();
    return this.db;
  }

  async read(): Promise<unknown> {
    const db = await this.conn();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('read failed'));
    });
  }

  async write(value: Settings): Promise<void> {
    const db = await this.conn();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('write aborted'));
    });
  }
}

/** The backend for this browser, or null where there is no IndexedDB. */
export function createSettingsBackend(): SettingsBackend | null {
  return typeof indexedDB === 'undefined' ? null : new IdbSettingsBackend();
}
