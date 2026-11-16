/** Voice cap with priority. Pure bookkeeping, so it is testable without Web Audio. */

interface Voice {
  priority: number;
  endTime: number;
  stop: () => void;
}

/** Tracks live voices. When full, the lowest priority (then soonest ending) voice is stolen. */
export class VoicePool {
  private voices: Voice[] = [];

  constructor(private readonly cap: number) {}

  /** Number of live voices at `now`. */
  size(now: number): number {
    this.prune(now);
    return this.voices.length;
  }

  /**
   * Requests a voice. Returns false if the pool is full of equal or higher priority voices.
   * A stolen voice has its `stop` called.
   */
  acquire(now: number, priority: number, endTime: number, stop: () => void): boolean {
    this.prune(now);
    if (this.voices.length >= this.cap) {
      let victim = 0;
      for (let i = 1; i < this.voices.length; i++) {
        const v = this.voices[i] as Voice;
        const w = this.voices[victim] as Voice;
        if (v.priority < w.priority || (v.priority === w.priority && v.endTime < w.endTime))
          victim = i;
      }
      const w = this.voices[victim] as Voice;
      if (w.priority >= priority) return false;
      w.stop();
      this.voices.splice(victim, 1);
    }
    this.voices.push({ priority, endTime, stop });
    return true;
  }

  /** Stops everything. */
  clear(): void {
    for (const v of this.voices) v.stop();
    this.voices = [];
  }

  private prune(now: number): void {
    this.voices = this.voices.filter((v) => v.endTime > now);
  }
}
