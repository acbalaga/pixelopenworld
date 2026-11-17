import { deriveSummary } from '../shared/summary';
import type { DollSpec } from '../content/dolls/parts';
import { serializeState, type SimState } from '../sim/state';
import { intact, mergeTrust, type Reason, type Trust } from './integrity/reasons';
import { validateSave } from './integrity';
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
  /**
   * The hash chain between the loaded snapshot and the one before it (tech/02). `unchecked` when
   * there is no adjacent older snapshot to compare with. The integrity check (M2-02) turns
   * `broken` into a Flagged save.
   */
  chain: 'ok' | 'broken' | 'unchecked';
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
  /** Called with every committed save. Dev builds use it to run the validator on each save. */
  audit?: (plain: SavePlain) => void;
}

/** The save module's front door: commit snapshots, load with fallback. Callers never see storage or encoding. */
export class SaveManager {
  private saveId: string | null = null;
  private seq = 0;
  private lastHash = '';
  private startedAt: number | null = null;
  private trust: Trust = intact();

  constructor(private readonly deps: SaveManagerDeps) {}

  /** The record for a snapshot. Trust is whatever this save has earned so far. */
  private plainFor(input: CommitInput, saveId: string, seq: number, at: number): SavePlain {
    this.startedAt ??= at;
    return {
      schema: CURRENT_SCHEMA,
      saveId,
      seq,
      prevHash: this.lastHash,
      createdAt: at,
      playSeconds: input.playSeconds,
      look: input.look,
      sim: serializeState(input.sim),
      summary: deriveSummary(input.sim, input.playSeconds),
      ledger: structuredClone(input.sim.ledger),
      startedAt: this.startedAt,
      trust: structuredClone(this.trust),
    };
  }

  /**
   * A new character begins. Trust and the start time belong to a character, so they reset. The
   * sequence and hash chain carry on, so the old snapshots stay in rotation as backups.
   */
  startFresh(): void {
    this.trust = intact();
    this.startedAt = null;
    this.saveId = null;
  }

  /** Trust as it stands: Intact, or Flagged with the reasons. */
  currentTrust(): Trust {
    return structuredClone(this.trust);
  }

  /** Writes a snapshot. Rotates the older ones in the same atomic write. Returns the new seq. */
  async commit(input: CommitInput): Promise<number> {
    const { codec, storage, now } = this.deps;
    this.saveId ??= this.deps.newId();
    const seq = this.seq + 1;
    const plain = this.plainFor(input, this.saveId, seq, now());
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
    next.emergency = had.emergency;
    // A record that once failed to load stays where it was put, for a human to look at.
    next.quarantine = had.quarantine;
    await storage.replaceAll(next);
    this.deps.audit?.(plain);
    this.seq = seq;
    this.lastHash = await sha256Hex(bytes);
    return seq;
  }

  /**
   * The crash handler's write. Touches only the emergency slot, so a crash can never push a good
   * snapshot out of rotation, and it does not move the chain or the sequence.
   */
  async commitEmergency(input: CommitInput): Promise<void> {
    const { codec, storage, now } = this.deps;
    const plain = this.plainFor(input, this.saveId ?? this.deps.newId(), this.seq + 1, now());
    const bytes = await codec.encode(plain);
    const had = await storage.readAll();
    await storage.replaceAll({
      ...had,
      emergency: {
        seq: plain.seq,
        savedAt: plain.createdAt,
        checksum: await sha256Hex(bytes),
        bytes,
      },
    });
  }

  /**
   * Loads the newest snapshot that reads cleanly: checksum, decode, migrate. A snapshot that
   * fails is skipped and reported. The first one that failed is copied to the quarantine slot, so
   * a bad write never costs the player data. Null when there is no save at all.
   */
  async load(): Promise<LoadResult | null> {
    const { codec, storage } = this.deps;
    const slots = await storage.readAll();
    // The emergency slot is last: a crash may have been caused by the state it holds.
    const order: Slot[] = ['latest', 'previous', 'old', 'emergency'];
    const skipped: LoadReport['skipped'] = [];
    let maxSeq = 0;
    for (const s of order) maxSeq = Math.max(maxSeq, slots[s]?.seq ?? 0);
    let firstBad: SaveRecord | null = null;
    for (const s of order) {
      const rec = slots[s];
      if (!rec) continue;
      try {
        if ((await sha256Hex(rec.bytes)) !== rec.checksum) throw new Error('checksum mismatch');
        const migrated = migrate(await codec.decode(rec.bytes));
        const chain = chainOf(migrated, s, slots);
        // The validator runs on every load. A Flagged save stays Flagged; a new finding adds to it.
        const found: Reason[] = validateSave(migrated, { chain }).reasons;
        const trust = mergeTrust(migrated.trust, found, this.deps.now());
        const plain: SavePlain = { ...migrated, trust };
        this.trust = trust;
        this.startedAt = plain.startedAt;
        this.saveId = plain.saveId;
        this.seq = maxSeq;
        // The next commit chains to whatever sits in `latest` now, even a record that failed to
        // load: it becomes `previous`, so an honest fallback does not read as a broken chain.
        this.lastHash = slots.latest?.checksum ?? rec.checksum;
        if (firstBad) await this.quarantine(slots, firstBad);
        return {
          plain,
          report: {
            slot: s,
            fellBack: s !== 'latest' && (skipped.length > 0 || s === 'emergency'),
            skipped,
            chain,
          },
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

/** Checks the loaded snapshot's `prevHash` against the snapshot just before it, when one is there. */
function chainOf(plain: SavePlain, slot: Slot, slots: Slots): LoadReport['chain'] {
  const older = slot === 'latest' ? slots.previous : slot === 'previous' ? slots.old : null;
  if (!older || older.seq !== plain.seq - 1) return 'unchecked';
  return older.checksum === plain.prevHash ? 'ok' : 'broken';
}
