import type { InstrumentDef, SfxDef, WaveType } from '../../content/audio/types';

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    // Fixed LCG so noise is the same every run.
    let s = 12345;
    for (let i = 0; i < d.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      d[i] = s / 2147483648 - 1;
    }
    noiseBuffers.set(ctx, b);
  }
  return b;
}

/** A started sound. `stop` cuts it with a short fade to avoid clicks. */
export interface Playing {
  stop: () => void;
}

interface Source {
  node: AudioScheduledSourceNode;
  freq: AudioParam | null;
}

function makeSource(ctx: AudioContext, wave: WaveType, freq: number, when: number): Source {
  if (wave === 'noise') {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx);
    n.loop = true;
    n.start(when);
    return { node: n, freq: null };
  }
  const o = ctx.createOscillator();
  o.type = wave;
  o.frequency.setValueAtTime(freq, when);
  o.start(when);
  return { node: o, freq: o.frequency };
}

/** Plays one sfxr-style effect on `out`. `rand` is injected so tests are deterministic. */
export function playSfx(
  ctx: AudioContext,
  out: AudioNode,
  def: SfxDef,
  when: number,
  rand: () => number,
): { playing: Playing; end: number } {
  const f = def.freq * (1 + (rand() * 2 - 1) * def.variance);
  const { attack, sustain, decay } = def;
  const end = when + attack + sustain + decay;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(def.gain, when + Math.max(attack, 0.002));
  gain.gain.setValueAtTime(def.gain, when + attack + sustain);
  gain.gain.linearRampToValueAtTime(0, end);

  const src = makeSource(ctx, def.wave, f, when);
  if (def.lowpass !== undefined) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.max(80, def.lowpass * 12000), when);
    src.node.connect(lp);
    lp.connect(gain);
  } else {
    src.node.connect(gain);
  }
  if (src.freq) {
    src.freq.exponentialRampToValueAtTime(Math.max(20, f * (1 + def.slide)), end);
    if (def.vibratoDepth && def.vibratoRate) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.setValueAtTime(def.vibratoRate, when);
      depth.gain.setValueAtTime(f * def.vibratoDepth, when);
      lfo.connect(depth);
      depth.connect(src.freq);
      lfo.start(when);
      lfo.stop(end);
    }
  }
  gain.connect(out);
  src.node.stop(end + 0.02);
  return { playing: fadeStop(ctx, gain, src.node), end };
}

/** Plays one tracker note. Percussion (noise) maps pitch to a bandpass center. */
export function playNote(
  ctx: AudioContext,
  out: AudioNode,
  inst: InstrumentDef,
  freq: number,
  when: number,
  duration: number,
): { playing: Playing; end: number } {
  const end = when + duration + inst.release;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(inst.gain, when + Math.max(inst.attack, 0.004));
  gain.gain.setValueAtTime(inst.gain, when + duration);
  gain.gain.linearRampToValueAtTime(0, end);

  const src = makeSource(ctx, inst.wave, freq, when);
  if (inst.wave === 'noise') {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, when);
    src.node.connect(bp);
    bp.connect(gain);
  } else {
    src.node.connect(gain);
  }
  gain.connect(out);
  src.node.stop(end + 0.02);
  return { playing: fadeStop(ctx, gain, src.node), end };
}

function fadeStop(ctx: AudioContext, gain: GainNode, node: AudioScheduledSourceNode): Playing {
  return {
    stop: () => {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.015);
      node.stop(t + 0.02);
    },
  };
}
