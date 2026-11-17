import { describe, expect, it } from 'vitest';
import {
  REMINDER_PLAY_SECONDS,
  loadReminder,
  reminderDue,
  saveReminder,
  type ReminderStore,
} from '../../src/platform/exportReminder';

const memory = (): ReminderStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('export reminder', () => {
  it('is due after 5 hours of play since the last export, and not a second sooner', () => {
    const st = { exportedAt: 1000, dismissedAt: 0 };
    expect(reminderDue(1000 + REMINDER_PLAY_SECONDS - 1, st)).toBe(false);
    expect(reminderDue(1000 + REMINDER_PLAY_SECONDS, st)).toBe(true);
    expect(REMINDER_PLAY_SECONDS).toBe(5 * 3600);
  });

  it('a dismissal waits another 5 hours of play, and an export resets the count', () => {
    const dismissed = { exportedAt: 0, dismissedAt: 20_000 };
    expect(reminderDue(20_000 + REMINDER_PLAY_SECONDS - 1, dismissed)).toBe(false);
    expect(reminderDue(20_000 + REMINDER_PLAY_SECONDS, dismissed)).toBe(true);
    expect(reminderDue(50_000, { exportedAt: 40_000, dismissedAt: 0 })).toBe(false);
  });

  it('a save with no record starts counting from now, so an import is not nagged at once', () => {
    const store = memory();
    const st = loadReminder(store, 'abc', 90_000);
    expect(st).toEqual({ exportedAt: 90_000, dismissedAt: 90_000 });
    expect(reminderDue(90_000, st)).toBe(false);
    expect(store.data.get('pow-backup:abc')).toBeDefined();
  });

  it('remembers state per save, and survives broken or blocked storage', () => {
    const store = memory();
    saveReminder(store, 'a', { exportedAt: 5, dismissedAt: 9 });
    expect(loadReminder(store, 'a', 0)).toEqual({ exportedAt: 5, dismissedAt: 9 });
    expect(loadReminder(store, 'b', 100)).toEqual({ exportedAt: 100, dismissedAt: 100 });
    store.data.set('pow-backup:c', 'not json');
    expect(loadReminder(store, 'c', 7)).toEqual({ exportedAt: 7, dismissedAt: 7 });
    expect(loadReminder(null, 'x', 3)).toEqual({ exportedAt: 3, dismissedAt: 3 });
    const throwing: ReminderStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadReminder(throwing, 'x', 3)).toEqual({ exportedAt: 3, dismissedAt: 3 });
    expect(() => saveReminder(throwing, 'x', { exportedAt: 1, dismissedAt: 1 })).not.toThrow();
  });
});
