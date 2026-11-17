import { deriveSummary } from '../shared/summary';
import type { DollSpec } from '../content/dolls/parts';
import { serializeState, type SimState } from '../sim/state';
import { migrate } from './migrations';
import { sha256Hex } from './codec';
import {
  CURRENT_SCHEMA,
  emptySlots,
  type SaveCodec,
  type SavePlain,
  type SaveRecord,
  type SaveStorage,
  type Slot,
  type Slots,
} from './types';

/** The third snapshot is the newest one at least this old (tech/02), so a bad stretch can be walked back. */
export const OLD_SNAPSHOT_MS = 30 * 60 * 1000;

/** What loading found. `fellBack` is true when the latest snapshot could not be used. */
export interface LoadReport {
  slot: Slot;
  fellBack: boolean;
  skipped: { slot: Slot; reason: string }[];
}

export interface LoadResult {
  plain: SavePlain;
  report: LoadReport;
}

/** Everything a commit needs from the running game. */
export interface CommitInput {
  sim: SimState;
  look: DollSpec;
  playSeconds: number;
}

export interface SaveManagerDeps {
  codec: SaveCodec;
  storage: SaveStorage;
  now: () => number;
  /** Random 128-bit id for a new save, as hex. */
  newId: () => string;
}

/** The save module's front door: commit snapshots, load with fallback. Callers never see storage or encoding. */
export class SaveManager {
  private saveId: string | null = null;
  private seq = 0;
  private lastHash = '';

  constructor(private readonly deps: SaveManagerDeps) {}

  /** Writes a snapshot. Rotates the older ones in the same atomic write. Returns the new seq. */
  async commit(input: CommitInput): Promise<number> {
    const { codec, storage, now } = this.deps;
    this.saveId ??= this.deps.newId();
    const seq = this.seq + 1;
    const plain: SavePlain = {
      schema: CURRENT_SCHEMA,
      saveId: this.saveId,
      seq,
      prevHash: this.lastHash,
      createdAt: now(),
      playSeconds: input.playSeconds,
      look: input.look,
      sim: serializeState(input.sim),
      summary: deriveSummary(input.sim, input.playSeconds),
      ledger: structuredClone(input.sim.ledger),
    };
    const bytes = await codec.encode(plain);
    const checksum = await sha256Hex(bytes);
    const record: SaveRecord = { seq, savedAt: plain.createdAt, checksum, bytes };
    const had = await storage.readAll();
    const next = emptySlots();
    next.latest = record;
    next.previous = had.latest;
    // Keep the newest snapshot that is old enough, from the one being pushed out and the old slot.
    const old = [had.previous, had.old]
      .filter((r): r is SaveRecord => r !== null && record.savedAt - r.savedAt >= OLD_SNAPSHOT_MS)
      .sort((a, b) => b.savedAt - a.savedAt)[0];
    next.old = old ?? had.old;
    // A record that once failed to load stays where it was put, for a human to look at.
    next.quarantine = had.quarantine;
    await storage.replaceAll(next);
    this.seq = seq;
    this.lastHash = await sha256Hex(bytes);
    return seq;
  }

  /**
   * Loads the newest snapshot that reads cleanly: checksum, decode, migrate. A snapshot that
   * fails is skipped and reported. The first one that failed is copied to the quarantine slot, so
   * a bad write never costs the player data. Null when there is no save at all.
   */
  async load(): Promise<LoadResult | null> {
    const { codec, storage } = this.deps;
    const slots = await storage.readAll();
    const order: Slot[] = ['latest', 'previous', 'old'];
    const skipped: LoadReport['skipped'] = [];
    let maxSeq = 0;
    for (const s of order) maxSeq = Math.max(maxSeq, slots[s]?.seq ?? 0);
    let firstBad: SaveRecord | null = null;
    for (const s of order) {
      const rec = slots[s];
      if (!rec) continue;
      try {
        if ((await sha256Hex(rec.bytes)) !== rec.checksum) throw new Error('checksum mismatch');
        const plain = migrate(await codec.decode(rec.bytes));
        this.saveId = plain.saveId;
        this.seq = maxSeq;
        this.lastHash = rec.checksum;
        if (firstBad) await this.quarantine(slots, firstBad);
        return {
          plain,
          report: { slot: s, fellBack: s !== 'latest' && skipped.length > 0, skipped },
        };
      } catch (e) {
        skipped.push({ slot: s, reason: e instanceof Error ? e.message : String(e) });
        firstBad ??= rec;
      }
    }
    if (firstBad) await this.quarantine(slots, firstBad);
    return null;
  }

  private async quarantine(slots: Slots, rec: SaveRecord): Promise<void> {
    if (slots.quarantine && slots.quarantine.seq >= rec.seq) return;
    await this.deps.storage.replaceAll({ ...slots, quarantine: rec });
  }
}
