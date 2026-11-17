import type { DollSpec } from '../content/dolls/parts';
import type { Ledger } from '../sim/ledger';
import type { Trust } from './integrity/reasons';
import type { SaveSummary } from '../shared/summary';

/** The save layout version. Bump it for any change to saved state, and add a migration. */
export const CURRENT_SCHEMA = 4;

/**
 * What a save holds, before any encoding (tech/02). `sim` is the canonical text from
 * `serializeState`, so it hashes and compares exactly. Encryption, the ledger and the integrity
 * check arrive with M2 and wrap this without changing it.
 */
export interface SavePlain {
  schema: number;
  /** Random 128-bit id made when the avatar is created. */
  saveId: string;
  /** Counts up by one on every committed save. */
  seq: number;
  /** SHA-256 (hex) of the previous save's encoded bytes, or the empty string for the first. */
  prevHash: string;
  /** Wall clock ms when this was written. Informational only. */
  createdAt: number;
  playSeconds: number;
  /** How the avatar looks. Owned by avatar creation (M1-10). */
  look: DollSpec;
  sim: string;
  summary: SaveSummary;
  /** Lifetime totals, a copy of the sim's ledger for the integrity check (M2-02). */
  ledger: Ledger;
  /** Wall clock ms of this save's first commit. Play time cannot exceed the time since. */
  startedAt: number;
  /** Intact or Flagged, with the reasons. Permanent once Flagged (tech/02). */
  trust: Trust;
}

/** The slots, newest first. `emergency` is written by the crash handler. `quarantine` keeps a record that failed to load, so nothing is ever lost. */
export const SLOTS = ['latest', 'previous', 'old', 'emergency', 'quarantine'] as const;
export type Slot = (typeof SLOTS)[number];

/** One stored snapshot. `bytes` is the codec's output. `checksum` is SHA-256 (hex) of `bytes`. */
export interface SaveRecord {
  seq: number;
  savedAt: number;
  checksum: string;
  bytes: Uint8Array;
}

export type Slots = Record<Slot, SaveRecord | null>;

/** Turns a SavePlain into bytes and back. Version 1 is plain JSON; M2 swaps in binary, compression, encryption. */
export interface SaveCodec {
  encode(plain: SavePlain): Promise<Uint8Array>;
  decode(bytes: Uint8Array): Promise<SavePlain>;
}

/**
 * Where snapshots live. `replaceAll` is atomic: after it resolves every slot holds what was
 * passed, and if it rejects or the page dies partway, every slot holds what it held before.
 */
export interface SaveStorage {
  readAll(): Promise<Slots>;
  replaceAll(slots: Slots): Promise<void>;
}

export function emptySlots(): Slots {
  return { latest: null, previous: null, old: null, emergency: null, quarantine: null };
}
