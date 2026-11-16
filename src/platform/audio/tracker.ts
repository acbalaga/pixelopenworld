import type { TrackDef } from '../../content/audio/types';

/** A parsed note event within a pattern. */
export interface Cell {
  /** Row within the pattern, 0-based. */
  row: number;
  rows: number;
  /** Frequency in Hz, or null for a rest. */
  freq: number | null;
}

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency of a note name such as `A4`, `C#5`, `Bb3`. A4 = 440 Hz. */
export function noteFreq(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const midi = 12 * (Number(m[3]) + 1) + (SEMITONE[m[1] as string] as number) + acc;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Parses tokens like `E5:2` and `.:2`. Throws if the rows do not sum to `rowsPerPattern`. */
export function parsePattern(tokens: readonly string[], rowsPerPattern: number): Cell[] {
  const out: Cell[] = [];
  let row = 0;
  for (const tok of tokens) {
    const [name, len] = tok.split(':');
    const rows = Number(len);
    if (!name || !Number.isInteger(rows) || rows < 1) throw new Error(`bad token ${tok}`);
    out.push({ row, rows, freq: name === '.' ? null : noteFreq(name) });
    row += rows;
  }
  if (row !== rowsPerPattern)
    throw new Error(`pattern has ${row} rows, expected ${rowsPerPattern}`);
  return out;
}

/** A note ready to schedule. Times are relative to track start, in seconds. */
export interface TrackNote {
  channel: number;
  time: number;
  duration: number;
  freq: number;
}

/** Seconds per row. A row is an eighth note. */
export function rowSeconds(bpm: number): number {
  return 60 / bpm / 2;
}

/** Total rows in one pass of the track. */
export function trackRows(track: TrackDef): number {
  return track.order.length * track.rowsPerPattern;
}

/** Length of one loop in seconds. */
export function loopSeconds(track: TrackDef): number {
  return trackRows(track) * rowSeconds(track.bpm);
}

/** Parses and validates a whole track once. Returns notes sorted by time for one loop. */
export function compileTrack(track: TrackDef): TrackNote[] {
  const rs = rowSeconds(track.bpm);
  const notes: TrackNote[] = [];
  track.order.forEach((entry, o) => {
    if (entry.length !== track.channels.length)
      throw new Error(`order ${o} has wrong channel count`);
    entry.forEach((patName, ch) => {
      const tokens = track.patterns[patName];
      if (!tokens) throw new Error(`unknown pattern ${patName}`);
      for (const cell of parsePattern(tokens, track.rowsPerPattern)) {
        if (cell.freq === null) continue;
        notes.push({
          channel: ch,
          time: (o * track.rowsPerPattern + cell.row) * rs,
          duration: cell.rows * rs,
          freq: cell.freq,
        });
      }
    });
  });
  return notes.sort((a, b) => a.time - b.time || a.channel - b.channel);
}

/**
 * Cursor that yields notes due before a horizon, wrapping at the loop end. Times are absolute
 * on the audio clock: loop k starts at `start + k * loopLen` exactly, so the seam never drifts.
 */
export class TrackCursor {
  private index = 0;
  private loop = 0;
  readonly loopLen: number;

  constructor(
    private readonly notes: readonly TrackNote[],
    loopLen: number,
    private readonly start: number,
  ) {
    this.loopLen = loopLen;
  }

  /** Notes with absolute time < `horizon`, in order. */
  take(horizon: number): { note: TrackNote; at: number }[] {
    const out: { note: TrackNote; at: number }[] = [];
    if (this.notes.length === 0) return out;
    for (;;) {
      const note = this.notes[this.index] as TrackNote;
      const at = this.start + this.loop * this.loopLen + note.time;
      if (at >= horizon) break;
      out.push({ note, at });
      this.index++;
      if (this.index === this.notes.length) {
        this.index = 0;
        this.loop++;
      }
    }
    return out;
  }
}
