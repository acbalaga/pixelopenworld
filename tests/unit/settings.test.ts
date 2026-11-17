import { describe, expect, it } from 'vitest';
import { SettingsStore } from '../../src/platform/settings';

describe('settings mute', () => {
  it('starts unmuted and notifies once when toggled', () => {
    const s = new SettingsStore({ prefersReducedMotion: () => false });
    expect(s.get().muted).toBe(false);
    let n = 0;
    s.subscribe(() => n++);
    s.set({ muted: true });
    s.set({ muted: true });
    expect(s.get().muted).toBe(true);
    expect(n).toBe(1);
  });
});
