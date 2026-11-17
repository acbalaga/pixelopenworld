/**
 * The backup reminder (tech/02, T9): after 5 hours of play since the last export, the game asks
 * once, and the player can dismiss it. Counted in play seconds, so time with the game closed
 * does not count. Kept per save in localStorage; losing it only means a reminder comes again.
 */

/** Play seconds between a backup (or a dismissal) and the next reminder. */
export const REMINDER_PLAY_SECONDS = 5 * 3600;

/** Play seconds at the last export and at the last dismissal. */
export interface ReminderState {
  exportedAt: number;
  dismissedAt: number;
}

/** Whether to show the reminder now. */
export function reminderDue(playSeconds: number, state: ReminderState): boolean {
  return playSeconds - Math.max(state.exportedAt, state.dismissedAt) >= REMINDER_PLAY_SECONDS;
}

/** Where the state lives. A tiny subset of Storage. */
export interface ReminderStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const key = (saveId: string): string => `pow-backup:${saveId}`;

/**
 * Reads the state for a save. A save with no record yet starts counting from now, so a player
 * who has just imported or migrated is not asked at once.
 */
export function loadReminder(
  store: ReminderStore | null,
  saveId: string,
  playSeconds: number,
): ReminderState {
  try {
    const raw = store?.getItem(key(saveId));
    if (raw) {
      const v = JSON.parse(raw) as Partial<ReminderState>;
      if (typeof v.exportedAt === 'number' && typeof v.dismissedAt === 'number')
        return { exportedAt: v.exportedAt, dismissedAt: v.dismissedAt };
    }
  } catch {
    // Fall through to a fresh state.
  }
  const fresh = { exportedAt: playSeconds, dismissedAt: playSeconds };
  saveReminder(store, saveId, fresh);
  return fresh;
}

/** Writes the state. Never throws. */
export function saveReminder(
  store: ReminderStore | null,
  saveId: string,
  state: ReminderState,
): void {
  try {
    store?.setItem(key(saveId), JSON.stringify(state));
  } catch {
    // Storage may be blocked or full. The reminder is a convenience.
  }
}

/** The browser's localStorage, or null where it is blocked. */
export function browserReminderStore(): ReminderStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
