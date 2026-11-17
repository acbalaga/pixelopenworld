import { afterEach, describe, expect, it, vi } from 'vitest';
import { persistenceAsked, requestPersistence, takeUpdateNote } from '../../src/platform/pwa';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

afterEach(() => vi.unstubAllGlobals());

describe('the update note', () => {
  it('is not shown on the first launch, nor when the build is the same', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(takeUpdateNote('aaa')).toBe(false);
    expect(takeUpdateNote('aaa')).toBe(false);
  });
  it('is shown once when the build changed', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    takeUpdateNote('aaa');
    expect(takeUpdateNote('bbb')).toBe(true);
    expect(takeUpdateNote('bbb')).toBe(false);
  });
  it('is never shown when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(takeUpdateNote('aaa')).toBe(false);
  });
});

describe('storage persistence', () => {
  it('asks once, remembers, and reports the answer', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });
    expect(persistenceAsked()).toBe(false);
    expect(await requestPersistence()).toBe('granted');
    expect(persistenceAsked()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });
  it('reports denied, and unsupported where the browser has no such call', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.resolve(false) } });
    expect(await requestPersistence()).toBe('denied');
    vi.stubGlobal('navigator', {});
    expect(await requestPersistence()).toBe('unsupported');
  });
});
