/**
 * Hand-edit attempts on a `.powsave` export, and the check that each is refused (tech/02, threats
 * T2 and T3). Pure of the command line so the test suite runs the same battery CI-side.
 *
 * Two kinds of attempt:
 * - Blind edits (T2): flipped bytes, truncation, extension, header edits, splicing two files.
 *   Each must be refused by import.
 * - A deliberate edit sealed again with the real key (T3): this is what someone who has read the
 *   bundle can do. It imports, and the integrity validator must mark it Flagged.
 */
import { HEADER_BYTES, openSave, sealSave } from '../../src/save/powsave';
import { planImport, ImportError } from '../../src/save/exportImport';
import type { SealSource } from '../../src/save/seal/source';
import type { SavePlain } from '../../src/save/types';
import { deserializeState, serializeState } from '../../src/sim/state';
import { findAvatar } from '../../src/shared/summary';

export interface Attempt {
  name: string;
  group: 'flip' | 'truncate' | 'extend' | 'header' | 'splice';
  bytes: Uint8Array;
}

export interface Outcome {
  name: string;
  group: Attempt['group'] | 'control' | 'reseal';
  /** `rejected` is what a tamper attempt must get. */
  result: 'rejected' | 'accepted';
  /** The refusal code, or for a re-sealed edit the integrity reason codes. */
  detail: string;
  /** Whether this outcome is what the design requires. */
  ok: boolean;
}

const SALT_AT = 7;
const IV_AT = SALT_AT + 16;

const flip = (b: Uint8Array, at: number): Uint8Array => {
  const out = b.slice();
  out[at] = (out[at] as number) ^ 0x01;
  return out;
};
const cat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** Every blind edit this tool knows, for file `a`, with `b` a second valid export to splice from. */
export function attempts(a: Uint8Array, b: Uint8Array): Attempt[] {
  const mid = HEADER_BYTES + Math.floor((a.length - HEADER_BYTES) / 2);
  const out: Attempt[] = [];
  const add = (group: Attempt['group'], name: string, bytes: Uint8Array): void => {
    out.push({ group, name, bytes });
  };
  const flips: [string, number][] = [
    ['magic byte 0', 0],
    ['format byte', 4],
    ['seal version, high byte', 5],
    ['seal version, low byte', 6],
    ['salt, first byte', SALT_AT],
    ['salt, last byte', IV_AT - 1],
    ['IV, first byte', IV_AT],
    ['IV, last byte', HEADER_BYTES - 1],
    ['ciphertext, first byte', HEADER_BYTES],
    ['ciphertext, middle byte', mid],
    ['ciphertext, last byte of data', a.length - 17],
    ['auth tag, first byte', a.length - 16],
    ['auth tag, last byte', a.length - 1],
  ];
  for (const [name, at] of flips) add('flip', `flip ${name}`, flip(a, at));
  add('truncate', 'empty file', new Uint8Array(0));
  add('truncate', 'header only', a.slice(0, HEADER_BYTES));
  add('truncate', 'cut the last byte', a.slice(0, a.length - 1));
  add('truncate', 'cut the auth tag', a.slice(0, a.length - 16));
  add('truncate', 'keep the first half', a.slice(0, Math.floor(a.length / 2)));
  add('extend', 'append one byte', cat(a, new Uint8Array([0])));
  add('extend', 'append 1 KB of zeros', cat(a, new Uint8Array(1024)));
  const header = (edit: (h: Uint8Array) => void): Uint8Array => {
    const out = a.slice();
    edit(out);
    return out;
  };
  add(
    'header',
    'format set to 2',
    header((h) => (h[4] = 2)),
  );
  add(
    'header',
    'seal version set to 0',
    header((h) => h.fill(0, 5, 7)),
  );
  add(
    'header',
    'seal version set to 65535',
    header((h) => h.fill(0xff, 5, 7)),
  );
  add(
    'header',
    'salt zeroed',
    header((h) => h.fill(0, SALT_AT, IV_AT)),
  );
  add(
    'header',
    'IV zeroed',
    header((h) => h.fill(0, IV_AT, HEADER_BYTES)),
  );
  add(
    'header',
    "header replaced with another file's",
    cat(b.slice(0, HEADER_BYTES), a.slice(HEADER_BYTES)),
  );
  add('splice', "A's header, B's ciphertext", cat(a.slice(0, HEADER_BYTES), b.slice(HEADER_BYTES)));
  add('splice', "B's header, A's ciphertext", cat(b.slice(0, HEADER_BYTES), a.slice(HEADER_BYTES)));
  add(
    'splice',
    "A's salt and IV, B's ciphertext",
    cat(a.slice(0, 5), b.slice(5, SALT_AT), a.slice(SALT_AT, HEADER_BYTES), b.slice(HEADER_BYTES)),
  );
  add('splice', 'first half of A, second half of B', cat(a.slice(0, mid), b.slice(mid)));
  add(
    'splice',
    "A with B's IV",
    cat(a.slice(0, IV_AT), b.slice(IV_AT, HEADER_BYTES), a.slice(HEADER_BYTES)),
  );
  return out;
}

/** Runs one file through import. */
async function tryImport(bytes: Uint8Array, source?: SealSource): Promise<string | null> {
  try {
    await planImport(bytes, source);
    return null;
  } catch (e) {
    if (e instanceof ImportError) return e.code;
    throw e;
  }
}

/** Adds one million coin to a save's avatar and leaves everything else alone. */
export function editCoin(plain: SavePlain, extra = 1_000_000): SavePlain {
  const state = deserializeState(plain.sim);
  const who = findAvatar(state);
  if (who === null) throw new Error('the save has no avatar');
  (state.entities.comps.avatar[who] as { coin: number }).coin += extra;
  return { ...plain, sim: serializeState(state) };
}

/** A second valid export of the same game, for splicing (a later snapshot, fresh salt and IV). */
export async function secondFile(a: Uint8Array, source?: SealSource): Promise<Uint8Array> {
  const plain = await openSave(a, source);
  return sealSave({ ...plain, seq: plain.seq + 1, createdAt: plain.createdAt + 1000 }, source);
}

/** The whole battery. */
export async function runBattery(
  file: Uint8Array,
  other?: Uint8Array,
  source?: SealSource,
): Promise<Outcome[]> {
  const b = other ?? (await secondFile(file, source));
  const out: Outcome[] = [];
  // The control: the untouched file must open, or every refusal below means nothing.
  const control = await tryImport(file, source);
  out.push({
    name: 'unmodified file (control)',
    group: 'control',
    result: control === null ? 'accepted' : 'rejected',
    detail: control ?? 'opens',
    ok: control === null,
  });
  for (const a of attempts(file, b)) {
    const code = await tryImport(a.bytes, source);
    out.push({
      name: a.name,
      group: a.group,
      result: code === null ? 'accepted' : 'rejected',
      detail: code ?? 'ACCEPTED',
      ok: code !== null,
    });
  }
  // The same file with one million coin added and sealed again with the real key.
  const edited = editCoin(await openSave(file, source));
  const resealed = await sealSave(edited, source);
  const plan = await planImport(resealed, source);
  out.push({
    name: 'decrypt, add 1,000,000 coin, seal with the real key',
    group: 'reseal',
    result: 'accepted',
    detail: `${plan.trust.state}: ${plan.trust.reasons.join(', ') || 'no reasons'}`,
    ok: plan.trust.state === 'flagged',
  });
  return out;
}
