/**
 * Packed binary encoding of a save (tech/02). Values are tagged, integers are varints, and every
 * string, keys included, is written once in a table at the front and referred to by index. Field
 * names therefore appear nowhere in the stream except that table, and the table is inside the
 * compressed, encrypted payload. The encoding is exact: `unpack(pack(x))` equals `x`, key order
 * and `-0` included.
 */

import { canonical } from '../sim/state';
import type { SavePlain } from './types';

/** The compact encoding of the Traveler lives (M5-02) lives with the sim and is re-exported here. */
export { decodeLives, encodeLives } from '../sim/travelers/codec';
import { fromBase64, toBase64 } from '../sim/travelers/codec';

const enum Tag {
  Null = 0,
  False = 1,
  True = 2,
  Uint = 3,
  Nint = 4,
  Float = 5,
  Str = 6,
  Arr = 7,
  Obj = 8,
  /** Raw bytes (M5-02): the Traveler lives, which the sim text carries as base64. */
  Bytes = 9,
}

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

/** Growable byte buffer. */
class Out {
  private buf = new Uint8Array(1024);
  len = 0;

  private room(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  byte(b: number): void {
    this.room(1);
    this.buf[this.len++] = b;
  }

  /** Unsigned LEB128. Uses division, not shifts, so it holds up to 2^53. */
  varint(n: number): void {
    this.room(8);
    while (n >= 0x80) {
      this.buf[this.len++] = (n % 0x80) | 0x80;
      n = Math.floor(n / 0x80);
    }
    this.buf[this.len++] = n;
  }

  bytes(b: Uint8Array): void {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }

  float(n: number): void {
    this.room(8);
    new DataView(this.buf.buffer).setFloat64(this.len, n, true);
    this.len += 8;
  }

  done(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

type Json = null | boolean | number | string | Uint8Array | Json[] | { [k: string]: Json };

function collect(v: Json, table: Map<string, number>): void {
  if (typeof v === 'string') {
    if (!table.has(v)) table.set(v, table.size);
  } else if (v instanceof Uint8Array) {
    // Bytes carry no strings.
  } else if (Array.isArray(v)) {
    for (const x of v) collect(x, table);
  } else if (v !== null && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      if (!table.has(k)) table.set(k, table.size);
      collect(v[k] as Json, table);
    }
  }
}

function write(v: Json, out: Out, table: Map<string, number>): void {
  if (v === null) out.byte(Tag.Null);
  else if (v === false) out.byte(Tag.False);
  else if (v === true) out.byte(Tag.True);
  else if (typeof v === 'number') {
    if (Number.isSafeInteger(v) && !Object.is(v, -0)) {
      if (v >= 0) {
        out.byte(Tag.Uint);
        out.varint(v);
      } else {
        out.byte(Tag.Nint);
        out.varint(-v);
      }
    } else {
      out.byte(Tag.Float);
      out.float(v);
    }
  } else if (typeof v === 'string') {
    out.byte(Tag.Str);
    out.varint(table.get(v) as number);
  } else if (v instanceof Uint8Array) {
    out.byte(Tag.Bytes);
    out.varint(v.length);
    out.bytes(v);
  } else if (Array.isArray(v)) {
    out.byte(Tag.Arr);
    out.varint(v.length);
    for (const x of v) write(x, out, table);
  } else {
    const obj = v as { [k: string]: Json };
    const keys = Object.keys(obj);
    out.byte(Tag.Obj);
    out.varint(keys.length);
    for (const k of keys) {
      out.varint(table.get(k) as number);
      write(obj[k] as Json, out, table);
    }
  }
}

/** Encodes any JSON-shaped value. Throws on `undefined`, functions and non-finite numbers. */
export function packValue(value: unknown): Uint8Array {
  const table = new Map<string, number>();
  collect(value as Json, table);
  const out = new Out();
  out.varint(table.size);
  for (const s of table.keys()) {
    const b = enc.encode(s);
    out.varint(b.length);
    out.bytes(b);
  }
  write(value as Json, out, table);
  return out.done();
}

/** Limits for reading untrusted bytes. */
const MAX_DEPTH = 64;

class In {
  pos = 0;
  constructor(private readonly b: Uint8Array) {}

  byte(): number {
    const v = this.b[this.pos++];
    if (v === undefined) throw new Error('truncated');
    return v;
  }

  varint(): number {
    let n = 0;
    let mul = 1;
    for (let i = 0; i < 8; i++) {
      const b = this.byte();
      n += (b & 0x7f) * mul;
      if ((b & 0x80) === 0) return n;
      mul *= 0x80;
    }
    throw new Error('varint too long');
  }

  take(len: number): Uint8Array {
    if (len > this.b.length - this.pos) throw new Error('truncated');
    const out = this.b.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  float(): number {
    const v = new DataView(this.b.buffer, this.b.byteOffset + this.pos, 8).getFloat64(0, true);
    this.take(8);
    return v;
  }

  get left(): number {
    return this.b.length - this.pos;
  }
}

function read(inp: In, table: string[], depth: number): Json {
  if (depth > MAX_DEPTH) throw new Error('too deep');
  const tag = inp.byte();
  switch (tag) {
    case Tag.Null:
      return null;
    case Tag.False:
      return false;
    case Tag.True:
      return true;
    case Tag.Uint:
      return inp.varint();
    case Tag.Nint:
      return -inp.varint();
    case Tag.Float:
      return inp.float();
    case Tag.Str: {
      const s = table[inp.varint()];
      if (s === undefined) throw new Error('bad string index');
      return s;
    }
    case Tag.Arr: {
      const n = inp.varint();
      if (n > inp.left) throw new Error('bad length');
      const out: Json[] = [];
      for (let i = 0; i < n; i++) out.push(read(inp, table, depth + 1));
      return out;
    }
    case Tag.Obj: {
      const n = inp.varint();
      if (n > inp.left) throw new Error('bad length');
      const out: { [k: string]: Json } = {};
      for (let i = 0; i < n; i++) {
        const k = table[inp.varint()];
        if (k === undefined) throw new Error('bad key index');
        out[k] = read(inp, table, depth + 1);
      }
      return out;
    }
    case Tag.Bytes: {
      const n = inp.varint();
      return inp.take(n).slice();
    }
    default:
      throw new Error(`bad tag ${tag}`);
  }
}

/** Decodes {@link packValue} output. Throws on anything malformed, never reads out of bounds. */
export function unpackValue(bytes: Uint8Array): unknown {
  const inp = new In(bytes);
  const count = inp.varint();
  if (count > inp.left) throw new Error('bad table');
  const table: string[] = [];
  for (let i = 0; i < count; i++) table.push(dec.decode(inp.take(inp.varint())));
  const v = read(inp, table, 0);
  if (inp.left !== 0) throw new Error('trailing bytes');
  return v;
}

/**
 * Packs a save. `sim` is the canonical text from `serializeState`; it is parsed so its fields
 * share the string table and the numbers become varints, then written back as the same canonical
 * text on unpack. A `sim` that is not canonical is refused, since it could not round trip.
 */
export function packSave(plain: SavePlain): Uint8Array {
  const parsed = JSON.parse(plain.sim) as Record<string, unknown>;
  if (canonical(parsed) !== plain.sim) throw new Error('sim text is not canonical');
  // The Traveler lives are bytes in the sim text as base64. Write them as bytes.
  const sim: Record<string, unknown> =
    typeof parsed.travelers === 'string'
      ? { ...parsed, travelers: fromBase64(parsed.travelers) }
      : parsed;
  return packValue({ ...plain, sim });
}

/** The inverse of {@link packSave}. Checks the fields every save must have. */
export function unpackSave(bytes: Uint8Array): SavePlain {
  const raw = unpackValue(bytes) as Partial<Omit<SavePlain, 'sim'>> & { sim?: unknown };
  if (
    !raw ||
    typeof raw !== 'object' ||
    typeof raw.schema !== 'number' ||
    typeof raw.saveId !== 'string' ||
    typeof raw.seq !== 'number' ||
    typeof raw.prevHash !== 'string' ||
    typeof raw.sim !== 'object' ||
    raw.sim === null
  )
    throw new Error('not a save');
  const sim = raw.sim as Record<string, unknown>;
  const text =
    sim.travelers instanceof Uint8Array ? { ...sim, travelers: toBase64(sim.travelers) } : sim;
  return { ...raw, sim: canonical(text) } as SavePlain;
}
