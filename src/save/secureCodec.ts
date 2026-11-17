import { packSave, unpackSave } from './binary';
import { gunzip, gzip } from './compress';
import { JsonCodec } from './codec';
import type { SaveCodec, SavePlain } from './types';

/** First bytes of every stored save. Not secret; it lets a loader fail fast on foreign data. */
const MAGIC = [0x50, 0x57];
/** Layout version. Bump it if the framing below changes. */
const FORMAT = 1;
const HEADER = MAGIC.length + 1;
const IV_BYTES = 12;

/** Supplies the device key. Called once per encode or decode. */
export type KeyProvider = () => Promise<CryptoKey>;

/**
 * The local save envelope (tech/02): packed binary, gzip, then AES-256-GCM under the device key
 * with a fresh random 96-bit IV per save. Stored bytes are `header | iv | ciphertext`. The header
 * is bound as authenticated data, so it cannot be changed without failing authentication.
 * A flipped byte anywhere, or the wrong key, makes `decode` reject.
 */
export class SecureCodec implements SaveCodec {
  /**
   * `readLegacyJson` lets `decode` also open the plain JSON saves M1 wrote (schema 2 and
   * earlier). They are migrated on load and written back encrypted by the next save. `encode`
   * never writes plain text.
   */
  constructor(
    private readonly key: KeyProvider,
    private readonly readLegacyJson = false,
  ) {}

  async encode(plain: SavePlain): Promise<Uint8Array> {
    const key = await this.key();
    const body = await gzip(packSave(plain));
    const header = Uint8Array.from([...MAGIC, FORMAT]);
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: header },
        key,
        body as BufferSource,
      ),
    );
    const out = new Uint8Array(HEADER + IV_BYTES + sealed.length);
    out.set(header, 0);
    out.set(iv, HEADER);
    out.set(sealed, HEADER + IV_BYTES);
    return out;
  }

  async decode(bytes: Uint8Array): Promise<SavePlain> {
    // A '{' cannot start a sealed save, whose first byte is 0x50.
    if (this.readLegacyJson && bytes[0] === 0x7b) return new JsonCodec().decode(bytes);
    if (bytes.length < HEADER + IV_BYTES + 16) throw new Error('save is too short');
    if (bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1]) throw new Error('not a save');
    if (bytes[2] !== FORMAT) throw new Error(`unknown save format ${bytes[2]}`);
    const header = bytes.slice(0, HEADER);
    const iv = bytes.slice(HEADER, HEADER + IV_BYTES);
    const sealed = bytes.slice(HEADER + IV_BYTES);
    let body: ArrayBuffer;
    try {
      body = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: header },
        await this.key(),
        sealed as BufferSource,
      );
    } catch {
      throw new Error('authentication failed');
    }
    return unpackSave(await gunzip(new Uint8Array(body)));
  }
}
