import { ACTIVITIES } from '../../content/travelers/types';
import { MEMORY_RING, type MemoryEntry, type TravelerLife } from './types';
import { PLACE_LIST, SKILL_LIST } from './lists';

/**
 * Compact binary form of the life half (POW-M5-02, design/12 section 1). Fixed order, LEB128
 * varints, no field names. The result is wrapped in base64 and stored in the sim text, so the save
 * pipeline's compression and encryption cover it like the rest. Reading is strict: anything out of
 * range throws, so a damaged section fails the load instead of building a nonsense Traveler.
 */

const LIMITS = {
  count: 4096,
  coin: 0xffffffff,
  points: 100,
  guild: 255,
  tier: 3,
};

class Writer {
  private buf = new Uint8Array(4096);
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
  varint(n: number): void {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(`bad traveler value ${n}`);
    this.room(8);
    while (n >= 0x80) {
      this.buf[this.len++] = (n % 0x80) | 0x80;
      n = Math.floor(n / 0x80);
    }
    this.buf[this.len++] = n;
  }
  done(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

class Reader {
  pos = 0;
  constructor(private readonly b: Uint8Array) {}
  byte(): number {
    const v = this.b[this.pos++];
    if (v === undefined) throw new Error('truncated travelers');
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
  get left(): number {
    return this.b.length - this.pos;
  }
}

/** Encodes lives. Throws on a value outside its field. */
export function encodeLives(lives: readonly TravelerLife[]): Uint8Array {
  const w = new Writer();
  w.varint(lives.length);
  for (const l of lives) {
    w.varint(l.build.length);
    for (const [skill, pts] of l.build) {
      w.byte(skill);
      w.varint(pts);
    }
    w.varint(l.paths);
    w.varint(l.coin);
    w.varint(l.place);
    w.byte(l.activity);
    w.varint(l.subject);
    w.byte(l.guild);
    w.byte(l.regardTier);
    w.varint(l.regardPts);
    w.varint(l.flags);
    w.byte(l.memory.length);
    for (const m of l.memory) {
      w.byte(m.kind);
      w.varint(m.subject);
      w.varint(m.day);
    }
    w.varint(l.lastSeen);
    w.varint(l.lineCursor);
  }
  return w.done();
}

function bounded(n: number, max: number, what: string): number {
  if (n > max) throw new Error(`traveler ${what} out of range`);
  return n;
}

/** Decodes {@link encodeLives} output. Throws on anything malformed. */
export function decodeLives(bytes: Uint8Array): TravelerLife[] {
  const r = new Reader(bytes);
  const count = bounded(r.varint(), LIMITS.count, 'count');
  if (count > r.left) throw new Error('bad traveler count');
  const lives: TravelerLife[] = [];
  for (let i = 0; i < count; i++) {
    const nb = bounded(r.varint(), SKILL_LIST.length, 'build');
    const build: [number, number][] = [];
    let last = -1;
    for (let k = 0; k < nb; k++) {
      const skill = bounded(r.byte(), SKILL_LIST.length - 1, 'skill');
      if (skill <= last) throw new Error('traveler build out of order');
      last = skill;
      build.push([skill, bounded(r.varint(), LIMITS.points, 'points')]);
    }
    const paths = bounded(r.varint(), 0xffffffff, 'paths');
    const coin = bounded(r.varint(), LIMITS.coin, 'coin');
    const place = bounded(r.varint(), PLACE_LIST.length - 1, 'place');
    const activity = bounded(r.byte(), ACTIVITIES.length - 1, 'activity');
    const subject = bounded(r.varint(), 0xffff, 'subject');
    const guild = bounded(r.byte(), LIMITS.guild, 'guild');
    const regardTier = bounded(r.byte(), LIMITS.tier, 'regard');
    const regardPts = bounded(r.varint(), 0xffff, 'regard points');
    const flags = bounded(r.varint(), 0xffff, 'flags');
    const nm = bounded(r.byte(), MEMORY_RING, 'memory');
    const memory: MemoryEntry[] = [];
    for (let k = 0; k < nm; k++) {
      memory.push({
        kind: r.byte(),
        subject: bounded(r.varint(), 0xffff, 'memory subject'),
        day: bounded(r.varint(), 0xffff, 'memory day'),
      });
    }
    const lastSeen = bounded(r.varint(), 0xffffffff, 'lastSeen');
    const lineCursor = bounded(r.varint(), 0xffff, 'lineCursor');
    lives.push({
      build,
      paths,
      coin,
      place,
      activity,
      subject,
      guild,
      regardTier,
      regardPts,
      flags,
      memory,
      lastSeen,
      lineCursor,
    });
  }
  if (r.left !== 0) throw new Error('trailing traveler bytes');
  return lives;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_REV = new Map<string, number>([...B64].map((c, i) => [c, i]));

/** Base64 without padding. Pure JS, so the sim needs neither `btoa` nor `Buffer`. */
export function toBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = ((b[i] as number) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] as string;
    out += B64[(n >> 12) & 63] as string;
    if (i + 1 < b.length) out += B64[(n >> 6) & 63] as string;
    if (i + 2 < b.length) out += B64[n & 63] as string;
  }
  return out;
}

/** Inverse of {@link toBase64}. Throws on a character outside the alphabet or a bad length. */
export function fromBase64(s: string): Uint8Array {
  if (s.length % 4 === 1) throw new Error('bad base64 length');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let n = 0;
    let got = 0;
    for (let k = 0; k < 4; k++) {
      const c = s[i + k];
      n <<= 6;
      if (c === undefined) continue;
      const v = B64_REV.get(c);
      if (v === undefined) throw new Error('bad base64 character');
      n |= v;
      got++;
    }
    if (got >= 2) out[o++] = (n >> 16) & 255;
    if (got >= 3) out[o++] = (n >> 8) & 255;
    if (got >= 4) out[o++] = n & 255;
  }
  return out;
}

/** The text form kept in the sim state. */
export const livesToText = (lives: readonly TravelerLife[]): string => toBase64(encodeLives(lives));
export const livesFromText = (text: string): TravelerLife[] => decodeLives(fromBase64(text));
