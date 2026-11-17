import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../../src/platform/audio/engine';
import { VoicePool } from '../../src/platform/audio/voices';
import {
  compileTrack,
  loopSeconds,
  noteFreq,
  parsePattern,
  rowSeconds,
  TrackCursor,
} from '../../src/platform/audio/tracker';
import { SFX } from '../../src/content/audio/sfx';
import { THEME_TRACK } from '../../src/content/audio/music';
import { playForEvents } from '../../src/platform/audio/mapping';

class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}
class FakeNode {
  connected: FakeNode[] = [];
  gain = new FakeParam();
  frequency = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
  stopped = 0;
  connect(n: FakeNode) {
    this.connected.push(n);
    return n;
  }
  start() {}
  stop() {
    this.stopped++;
  }
}
class FakeCtx {
  static created = 0;
  currentTime = 0;
  state = 'suspended';
  sampleRate = 8000;
  destination = new FakeNode();
  nodes: FakeNode[] = [];
  constructor() {
    FakeCtx.created++;
  }
  private n() {
    const n = new FakeNode();
    this.nodes.push(n);
    return n;
  }
  createGain() {
    return this.n();
  }
  createOscillator() {
    return this.n();
  }
  createBufferSource() {
    return this.n();
  }
  createBiquadFilter() {
    return this.n();
  }
  createDynamicsCompressor() {
    return this.n();
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
  async resume() {
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
}

function makeEngine() {
  const holder: { ctx: FakeCtx | null } = { ctx: null };
  const engine = new AudioEngine({
    createContext: () => (holder.ctx = new FakeCtx()) as unknown as AudioContext,
    rand: () => 0.5,
    sfx: new Map(SFX.map((s) => [s.id, s])),
    tracks: new Map([[THEME_TRACK.id, THEME_TRACK]]),
  });
  return { engine, holder };
}

describe('audio context lifecycle', () => {
  it('creates no context before a gesture, and play calls are silent no-ops', () => {
    FakeCtx.created = 0;
    const { engine } = makeEngine();
    expect(engine.playSfx('sfx.chime')).toBe(false);
    engine.playTrack('music.theme');
    expect(FakeCtx.created).toBe(0);
    expect(engine.ready).toBe(false);
    engine.unlock();
    engine.unlock();
    expect(FakeCtx.created).toBe(1);
    expect(engine.playSfx('sfx.chime')).toBe(true);
  });

  it('suspends when hidden and resumes when visible', () => {
    const { engine, holder } = makeEngine();
    engine.unlock();
    engine.setHidden(true);
    expect(holder.ctx?.state).toBe('suspended');
    engine.setHidden(false);
    expect(holder.ctx?.state).toBe('running');
  });

  it('ducks only the music bus during dialogue, and restores it', () => {
    const { engine } = makeEngine();
    engine.unlock();
    engine.setVolume('music', 0.6);
    engine.setVolume('effects', 0.9);
    engine.setDucked(true);
    expect(engine.busGain('music')).toBeCloseTo(0.6 * 0.35);
    expect(engine.busGain('effects')).toBe(0.9);
    engine.setDucked(false);
    expect(engine.busGain('music')).toBe(0.6);
  });

  it('muting each bus zeroes it and unmuting restores the volume', () => {
    const { engine } = makeEngine();
    engine.unlock();
    for (const bus of ['master', 'music', 'effects', 'ambience', 'ui'] as const) {
      engine.setVolume(bus, 0.5);
      engine.setMuted(bus, true);
      expect(engine.busGain(bus)).toBe(0);
      engine.setMuted(bus, false);
      expect(engine.busGain(bus)).toBe(0.5);
    }
  });
});

describe('voice cap', () => {
  it('40 effects in one tick never exceed 16 voices', () => {
    const { engine } = makeEngine();
    engine.unlock();
    let max = 0;
    for (let i = 0; i < 40; i++) {
      engine.playSfx(i % 2 ? 'sfx.hit_heavy' : 'sfx.pickup');
      max = Math.max(max, engine.voiceCount());
    }
    expect(max).toBe(16);
    expect(engine.voiceCount()).toBe(16);
  });

  it('drops lowest priority first and stops the stolen voice', () => {
    const pool = new VoicePool(2);
    const stopped: string[] = [];
    expect(pool.acquire(0, 1, 5, () => stopped.push('music'))).toBe(true);
    expect(pool.acquire(0, 2, 5, () => stopped.push('ui'))).toBe(true);
    expect(pool.acquire(0, 3, 5, () => stopped.push('fx'))).toBe(true);
    expect(stopped).toEqual(['music']);
    expect(pool.acquire(0, 1, 5, () => {})).toBe(false);
    expect(pool.size(6)).toBe(0);
  });
});

describe('tracker', () => {
  it('note frequencies', () => {
    expect(noteFreq('A4')).toBeCloseTo(440);
    expect(noteFreq('A5')).toBeCloseTo(880);
    expect(noteFreq('C4')).toBeCloseTo(261.63, 1);
  });

  it('the theme compiles, every pattern fills its rows, and it is 30 to 45 seconds', () => {
    for (const p of Object.values(THEME_TRACK.patterns))
      parsePattern(p, THEME_TRACK.rowsPerPattern);
    const len = loopSeconds(THEME_TRACK);
    expect(len).toBeGreaterThanOrEqual(30);
    expect(len).toBeLessThanOrEqual(45);
    expect(compileTrack(THEME_TRACK).length).toBeGreaterThan(100);
  });

  it('rejects a short pattern', () => {
    expect(() => parsePattern(['A4:2'], 16)).toThrow();
  });

  it('loops with an exact, drift-free seam', () => {
    const notes = compileTrack(THEME_TRACK);
    const len = loopSeconds(THEME_TRACK);
    const start = 10.05;
    const cur = new TrackCursor(notes, len, start);
    const all = cur.take(start + len * 50);
    const perLoop = notes.length;
    // Same note in loop 0 and loop 49 differs by exactly 49 loop lengths.
    const first = all[0]!;
    const again = all[perLoop * 49]!;
    expect(again.note).toBe(first.note);
    expect(again.at - first.at).toBeCloseTo(len * 49, 9);
    // The first note after the seam lands exactly one row after the last row of the loop would.
    const lastLoopFirst = all[perLoop]!;
    expect(lastLoopFirst.at - start).toBeCloseTo(len, 9);
    expect(len / rowSeconds(THEME_TRACK.bpm)).toBe(128);
    for (let i = 1; i < all.length; i++) expect(all[i]!.at).toBeGreaterThanOrEqual(all[i - 1]!.at);
  });

  it('crossfades by starting a second track player without exceeding the voice cap', () => {
    const { engine } = makeEngine();
    engine.unlock();
    engine.playTrack('music.theme', 0.1);
    expect(engine.voiceCount()).toBeLessThanOrEqual(16);
    engine.stopMusic(0.1);
  });
});

describe('event mapping', () => {
  it('plays the mapped effect for a sim event', () => {
    const { engine } = makeEngine();
    engine.unlock();
    playForEvents(engine, [{ type: 'bounce', id: 1, axis: 'x' }]);
    expect(engine.voiceCount()).toBe(1);
  });
});
