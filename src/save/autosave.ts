/** Why a save was asked for. Only for reports and tests. */
export type SaveReason = 'timer' | 'transition' | 'trial' | 'hidden' | 'pagehide' | 'manual';

/**
 * Runs saves one at a time. A request made while one is running does not start a second; it runs
 * once more when the first finishes, so the newest state is always the last thing written and
 * two writes never overlap.
 */
export class AutoSaver {
  private running: Promise<void> | null = null;
  private again = false;
  /** Reason of the last save that finished, for tests and the indicator. */
  lastReason: SaveReason | null = null;

  constructor(
    private readonly save: () => Promise<void>,
    private readonly onError: (e: unknown) => void = () => undefined,
    private readonly onSaved: (reason: SaveReason) => void = () => undefined,
  ) {}

  request(reason: SaveReason): void {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = this.run(reason);
  }

  private async run(reason: SaveReason): Promise<void> {
    try {
      await this.save();
      this.lastReason = reason;
      this.onSaved(reason);
    } catch (e) {
      this.onError(e);
    } finally {
      this.running = null;
      if (this.again) {
        this.again = false;
        this.request(reason);
      }
    }
  }

  /** Resolves when nothing is running or waiting. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }
}
