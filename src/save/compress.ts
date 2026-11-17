/** Largest a decompressed save may be. A guard against a small file that expands without end. */
export const MAX_INFLATED_BYTES = 32 * 1024 * 1024;

async function pump(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  cap: number,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const done = writer.write(bytes as BufferSource).then(() => writer.close());
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    total += value.length;
    if (total > cap) {
      // Cancelling aborts the writer too; that rejection is expected, not an error.
      done.catch(() => undefined);
      await reader.cancel();
      throw new Error('too large');
    }
    chunks.push(value);
  }
  await done;
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** gzip. Runs in the browser's native stream, off the main thread's critical path. */
export function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pump(bytes, new CompressionStream('gzip'), Number.MAX_SAFE_INTEGER);
}

/** gunzip, refusing output over `cap` bytes. */
export function gunzip(bytes: Uint8Array, cap = MAX_INFLATED_BYTES): Promise<Uint8Array> {
  return pump(bytes, new DecompressionStream('gzip'), cap);
}
