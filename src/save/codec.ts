import type { SaveCodec, SavePlain } from './types';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Version 1: JSON text as UTF-8. Unencrypted, as the ticket says. */
export class JsonCodec implements SaveCodec {
  async encode(plain: SavePlain): Promise<Uint8Array> {
    return enc.encode(JSON.stringify(plain));
  }

  async decode(bytes: Uint8Array): Promise<SavePlain> {
    const raw = JSON.parse(dec.decode(bytes)) as Partial<SavePlain> | null;
    if (
      !raw ||
      typeof raw.schema !== 'number' ||
      typeof raw.saveId !== 'string' ||
      typeof raw.seq !== 'number' ||
      typeof raw.sim !== 'string'
    )
      throw new Error('not a save');
    return raw as SavePlain;
  }
}

/** SHA-256 of bytes, as lowercase hex. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
