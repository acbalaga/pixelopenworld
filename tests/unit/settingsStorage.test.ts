import { describe, expect, it } from 'vitest';
import { SettingsStore, type Settings } from '../../src/platform/settings';
import {
  persistSettings,
  restoreSettings,
  sanitizeSettings,
  type SettingsBackend,
} from '../../src/platform/settingsStorage';

class MemoryBackend implements SettingsBackend {
  writes: Settings[] = [];
  constructor(public held: unknown = undefined) {}
  async read(): Promise<unknown> {
    return this.held;
  }
  async write(value: Settings): Promise<void> {
    this.writes.push(value);
    this.held = value;
  }
}

const fresh = (): SettingsStore => new SettingsStore({ prefersReducedMotion: () => false });
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('settings persistence', () => {
  it('a muted setting survives a new session', async () => {
    const backend = new MemoryBackend();
    const first = fresh();
    persistSettings(first, backend);
    first.set({ muted: true, controlScheme: 'classic', handedness: 'left', hudScale: 1.3 });
    await tick();

    const second = fresh();
    await restoreSettings(second, backend);
    expect(second.get().muted).toBe(true);
    expect(second.get().controlScheme).toBe('classic');
    expect(second.get().handedness).toBe('left');
    expect(second.get().hudScale).toBe(1.3);
  });

  it('keeps the defaults when nothing is stored or the read fails', async () => {
    const s = fresh();
    await restoreSettings(s, new MemoryBackend(undefined));
    expect(s.get().muted).toBe(false);
    const broken: SettingsBackend = {
      read: () => Promise.reject(new Error('no idb')),
      write: () => Promise.reject(new Error('no idb')),
    };
    await restoreSettings(s, broken);
    expect(s.get().controlScheme).toBe('flow');
    persistSettings(s, broken);
    expect(() => s.set({ muted: true })).not.toThrow();
  });

  it('drops fields of the wrong type and clamps numbers through the store', async () => {
    expect(
      sanitizeSettings({
        muted: 'yes',
        controlScheme: 'turbo',
        handedness: 'left',
        textScale: Number.NaN,
        hudScale: 9,
        extra: 1,
      }),
    ).toEqual({ handedness: 'left', hudScale: 9 });
    expect(sanitizeSettings(null)).toEqual({});
    const s = fresh();
    await restoreSettings(s, new MemoryBackend({ hudScale: 9 }));
    expect(s.get().hudScale).toBe(1.5);
  });

  it('writes the latest value when changes arrive while a write is running', async () => {
    const backend = new MemoryBackend();
    const s = fresh();
    persistSettings(s, backend);
    s.set({ muted: true });
    s.set({ muted: false });
    s.set({ haptics: false });
    await tick();
    await tick();
    expect(backend.writes.at(-1)).toMatchObject({ muted: false, haptics: false });
  });
});
