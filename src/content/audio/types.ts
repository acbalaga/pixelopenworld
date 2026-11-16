/** Audio buses. */
export type BusId = 'master' | 'music' | 'effects' | 'ambience' | 'ui';

/** Waveforms the synth knows. */
export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

/** An sfxr-style effect preset. Times in seconds, freq in Hz. */
export interface SfxDef {
  id: string;
  wave: WaveType;
  attack: number;
  sustain: number;
  decay: number;
  freq: number;
  /** Fractional pitch change over the effect, -1 to 1 (-0.3 drops 30%). */
  slide: number;
  /** Vibrato depth as a fraction of freq, and rate in Hz. */
  vibratoDepth?: number;
  vibratoRate?: number;
  /** Lowpass cutoff as a fraction of 12 kHz, 0 to 1. Omit for no filter. */
  lowpass?: number;
  gain: number;
  /** Random pitch spread per play, fraction of freq. */
  variance: number;
  bus: 'effects' | 'ui';
}

/** A tracker instrument. */
export interface InstrumentDef {
  wave: WaveType;
  attack: number;
  /** Seconds of decay after the note ends. */
  release: number;
  gain: number;
}

/** One channel's pattern: text tokens `NOTE:rows`, `.:rows` for rest. See content/audio/music. */
export type PatternDef = readonly string[];

/** A tracker track. */
export interface TrackDef {
  id: string;
  /** Beats per minute. One row is an eighth note. */
  bpm: number;
  rowsPerPattern: number;
  channels: readonly { name: string; instrument: InstrumentDef }[];
  patterns: Readonly<Record<string, PatternDef>>;
  /** One entry per order step, naming one pattern per channel. */
  order: readonly (readonly string[])[];
}
