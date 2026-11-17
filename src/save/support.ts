/** What the browser lacks for secure saves. Empty means it can. */
export interface SupportReport {
  ok: boolean;
  missing: string[];
}

/**
 * Checks, at boot, that this browser can keep a save safely: IndexedDB, native gzip streams, and
 * a key that cannot be exported. Without them the game says so. It never falls back to storing a
 * save in the clear (tech/02).
 */
export async function checkSaveSupport(): Promise<SupportReport> {
  const missing: string[] = [];
  if (typeof indexedDB === 'undefined') missing.push('IndexedDB');
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined')
    missing.push('CompressionStream');
  if (typeof crypto === 'undefined' || !crypto.subtle) missing.push('Web Crypto');
  else {
    try {
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
      ]);
      if (key.extractable) missing.push('non-extractable keys');
    } catch {
      missing.push('non-extractable keys');
    }
  }
  return { ok: missing.length === 0, missing };
}
