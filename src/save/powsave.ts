/**
 * The `.powsave` file (tech/02): the same compressed binary `SavePlain` the device keeps, sealed
 * for moving between devices.
 *
 *   magic "POWS" (4) | format (1) | sealVersion (2, big endian) | salt (16) | IV (12) | ciphertext
 *
 * Everything before the ciphertext is bound as AES-GCM additional authenticated data, so a
 * changed header byte fails authentication like a changed ciphertext byte does. The parser is
 * strict: anything unexpected is refused with a reason a player can read.
 */
import { packSave, unpackSave } from './binary';
import { gunzip, gzip } from './compress';
import { SALT_BYTES, sealKey } from './seal/derive';
import { defaultSealSource, type SealSource } from './seal/source';
import type { SavePlain } from './types';

export const MAGIC = [0x50, 0x4f, 0x57, 0x53];
export const FORMAT = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Magic, format, seal version, salt, IV. */
export const HEADER_BYTES = MAGIC.length + 1 + 2 + SALT_BYTES + IV_BYTES;
/** Import size cap (tech/02). The design target is under 500 KB at 200 hours. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** Why a file was refused. The UI turns each into a plain sentence. */
export type SealErrorCode =
  'too_large' | 'too_short' | 'not_a_save' | 'unknown_format' | 'unknown_seal' | 'damaged';

export class SealError extends Error {
  constructor(
    readonly code: SealErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SealError';
  }
}

/** Seals a save into file bytes, under the source's current version. */
export async function sealSave(
  plain: SavePlain,
  source: SealSource = defaultSealSource,
): Promise<Uint8Array> {
  const version = source.current;
  const fragments = await source.fragments(version);
  if (!fragments) throw new Error(`no seal material for version ${version}`);
  const body = await gzip(packSave(plain));
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC, 0);
  header[4] = FORMAT;
  header[5] = (version >> 8) & 0xff;
  header[6] = version & 0xff;
  header.set(salt, 7);
  header.set(iv, 7 + SALT_BYTES);
  const key = await sealKey(fragments, version, salt);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: header },
      key,
      body as BufferSource,
    ),
  );
  const out = new Uint8Array(HEADER_BYTES + sealed.length);
  out.set(header, 0);
  out.set(sealed, HEADER_BYTES);
  return out;
}

/** Parses and opens file bytes. Throws {@link SealError} for anything wrong with the file. */
export async function openSave(
  bytes: Uint8Array,
  source: SealSource = defaultSealSource,
): Promise<SavePlain> {
  if (bytes.length > MAX_FILE_BYTES) throw new SealError('too_large', 'file is over 4 MB');
  if (bytes.length < HEADER_BYTES + TAG_BYTES)
    throw new SealError('too_short', 'file is too short');
  for (let i = 0; i < MAGIC.length; i++)
    if (bytes[i] !== MAGIC[i]) throw new SealError('not_a_save', 'bad magic');
  if (bytes[4] !== FORMAT) throw new SealError('unknown_format', `format ${bytes[4]}`);
  const version = ((bytes[5] as number) << 8) | (bytes[6] as number);
  const fragments = await source.fragments(version);
  if (!fragments) throw new SealError('unknown_seal', `seal version ${version}`);
  const header = bytes.slice(0, HEADER_BYTES);
  const salt = bytes.slice(7, 7 + SALT_BYTES);
  const iv = bytes.slice(7 + SALT_BYTES, HEADER_BYTES);
  const sealed = bytes.slice(HEADER_BYTES);
  let body: Uint8Array;
  try {
    const key = await sealKey(fragments, version, salt);
    body = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: header },
        key,
        sealed as BufferSource,
      ),
    );
  } catch {
    throw new SealError('damaged', 'authentication failed');
  }
  try {
    return unpackSave(await gunzip(body));
  } catch {
    throw new SealError('damaged', 'contents could not be read');
  }
}
