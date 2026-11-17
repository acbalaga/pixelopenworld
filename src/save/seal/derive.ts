/**
 * Seal key derivation (tech/02). The fragments live in separate modules and are combined here,
 * at the moment of use, through HKDF-SHA-256 into 32 bytes of material. That material then feeds
 * PBKDF2-SHA-256 with the file's random salt, and the result is a non-extractable AES-256-GCM
 * key. The material and the fragment copies exist only inside `sealKey`, and are zeroed before
 * it returns. Neither the material nor the key is ever written down as a literal.
 */

/** PBKDF2 iterations (tech/02 asks for at least 150,000). */
export const PBKDF2_ITERATIONS = 200_000;
export const SALT_BYTES = 16;

const enc = new TextEncoder();

function join(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * HKDF-SHA-256 over the four fragments: the first and third are the input keying material, the
 * second the salt, the fourth (with the version) the context. Returns fresh bytes the caller
 * must zero. Exported for the build check, which needs to know what to search the bundle for.
 */
export async function combineFragments(
  fragments: readonly Uint8Array[],
  version: number,
): Promise<Uint8Array> {
  if (fragments.length !== 4) throw new Error('seal material needs four fragments');
  const [a, b, c, d] = fragments as [Uint8Array, Uint8Array, Uint8Array, Uint8Array];
  const ikm = join(a, c);
  const info = join(d, enc.encode(`pow-seal-v${version}`));
  try {
    const base = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
      'deriveBits',
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: b as BufferSource, info: info as BufferSource },
      base,
      256,
    );
    return new Uint8Array(bits);
  } finally {
    ikm.fill(0);
    info.fill(0);
  }
}

/** The AES-256-GCM key for one file: the fragments, then PBKDF2 with the file's salt. */
export async function sealKey(
  fragments: readonly Uint8Array[],
  version: number,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const material = await combineFragments(fragments, version);
  try {
    const base = await crypto.subtle.importKey('raw', material as BufferSource, 'PBKDF2', false, [
      'deriveKey',
    ]);
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt as BufferSource,
        iterations: PBKDF2_ITERATIONS,
      },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    material.fill(0);
  }
}
