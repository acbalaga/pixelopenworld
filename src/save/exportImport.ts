/**
 * Backup files, end to end (POW-M2-03). Export turns the current save into `.powsave` bytes.
 * Import opens a file, migrates it, runs the integrity validator, and returns what the player is
 * asked to confirm. Nothing here touches storage: `SaveManager.importSave` does that, after the
 * player says yes.
 */
import { findAvatar } from '../shared/summary';
import { deserializeState } from '../sim/state';
import { mergeTrust, validateSave, type Trust } from './integrity';
import { migrate } from './migrations';
import { openSave, SealError, sealSave, type SealErrorCode } from './powsave';
import type { SealSource } from './seal/source';
import type { SavePlain } from './types';

/** Why an import was refused: a file problem, or a save that cannot be played. */
export type ImportErrorCode = SealErrorCode | 'too_new' | 'unplayable';

export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

/** What the player is shown before an import replaces anything. */
export interface ImportPlan {
  /** The save, migrated to the current schema, with its trust folded in. */
  plain: SavePlain;
  handle: string;
  playSeconds: number;
  /** Wall clock ms the exported save was written. */
  savedAt: number;
  trust: Trust;
}

/** Opens file bytes into an import plan. Throws {@link ImportError}. */
export async function planImport(
  bytes: Uint8Array,
  source?: SealSource,
  now: () => number = Date.now,
): Promise<ImportPlan> {
  let opened: SavePlain;
  try {
    opened = await openSave(bytes, source);
  } catch (e) {
    if (e instanceof SealError) throw new ImportError(e.code, e.message);
    throw e;
  }
  let migrated: SavePlain;
  try {
    migrated = migrate(opened);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ImportError(msg.includes('newer') ? 'too_new' : 'unplayable', msg);
  }
  const verdict = validateSave(migrated);
  // A file that opens but is not a game state cannot be played, flagged or not.
  if (verdict.reasons.some((r) => r.code === 'MALFORMED_STATE' || r.code === 'AVATAR_COUNT'))
    throw new ImportError('unplayable', verdict.reasons[0]?.detail ?? 'not a game state');
  const trust = mergeTrust(migrated.trust, verdict.reasons, now());
  const sim = deserializeState(migrated.sim);
  const who = findAvatar(sim);
  const handle = (who !== null ? sim.entities.comps.avatar[who]?.handle : undefined) ?? 'Traveler';
  return {
    plain: { ...migrated, trust },
    handle,
    playSeconds: migrated.playSeconds,
    savedAt: migrated.createdAt,
    trust,
  };
}

/** Seals a save into file bytes. */
export function exportBytes(plain: SavePlain, source?: SealSource): Promise<Uint8Array> {
  return sealSave(plain, source);
}

/** `pow-<handle>-<date>.powsave`, with the handle reduced to letters, digits and underscores. */
export function exportFileName(handle: string, at: Date): string {
  const safe = handle.replace(/[^A-Za-z0-9_]/g, '') || 'save';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `pow-${safe}-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}.powsave`;
}
