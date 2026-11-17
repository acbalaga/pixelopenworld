import { UI_BALANCE } from '../../content/balance/ui';

/**
 * Fade when idle (design/09): an element drops to a low opacity after it has been unchanged for a
 * few seconds, and snaps back on change. Time is the caller's clock in ms, so this is pure.
 */
export class FadeTracker {
  private last = new Map<string, { sig: string; changedAt: number }>();

  /** Reports the element's current value as a string. A different string counts as a change. */
  observe(key: string, sig: string, now: number): void {
    const e = this.last.get(key);
    if (!e) this.last.set(key, { sig, changedAt: now });
    else if (e.sig !== sig) {
      e.sig = sig;
      e.changedAt = now;
    }
  }

  /** Forces an element back to full, for example while it is in use. */
  wake(key: string, now: number): void {
    const e = this.last.get(key);
    if (e) e.changedAt = now;
    else this.last.set(key, { sig: '', changedAt: now });
  }

  /** Opacity 0 to 1 for the element, before the player's own opacity setting. */
  alpha(key: string, now: number, reducedMotion = false): number {
    const e = this.last.get(key);
    const H = UI_BALANCE.hud;
    if (!e) return 1;
    const idle = now - e.changedAt;
    if (idle < H.idleMs) return 1;
    if (reducedMotion) return H.fadedAlpha;
    const t = Math.min(1, (idle - H.idleMs) / H.fadeOutMs);
    return 1 - (1 - H.fadedAlpha) * t;
  }
}
