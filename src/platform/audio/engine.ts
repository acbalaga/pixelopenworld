import { AUDIO_TUNABLES as T } from '../../content/balance/audio';
import type { BusId, SfxDef, TrackDef } from '../../content/audio/types';
import { VoicePool } from './voices';
import { playNote, playSfx, type Playing } from './synth';
import { compileTrack, loopSeconds, TrackCursor, type TrackNote } from './tracker';

const BUSES: readonly BusId[] = ['music', 'effects', 'ambience', 'ui'];

interface MusicPlayer {
  gain: GainNode;
  timer: ReturnType<typeof setInterval>;
  playing: Playing[];
}

/** Things the engine needs from outside. All injectable for tests. */
export interface EngineDeps {
  createContext: () => AudioContext;
  rand: () => number;
  sfx: ReadonlyMap<string, SfxDef>;
  tracks: ReadonlyMap<string, TrackDef>;
}

/**
 * Web Audio engine. The context is created only by {@link unlock}, which must be called from a
 * user gesture. Before that, every play call is a silent no-op.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buses = new Map<BusId, GainNode>();
  private volumes: Record<BusId, number> = { ...T.defaultVolumes };
  private ducked = false;
  private muted = new Set<BusId>();
  private pool = new VoicePool(T.voiceCap);
  private music: MusicPlayer | null = null;
  private currentTrack: string | null = null;
  private compiled = new Map<string, { notes: TrackNote[]; len: number }>();

  constructor(private readonly deps: EngineDeps) {}

  /** True once the context exists. */
  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Creates the context and graph (buses, limiter) and resumes it. Call from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const ctx = this.deps.createContext();
      this.ctx = ctx;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = T.limiter.threshold;
      limiter.knee.value = T.limiter.knee;
      limiter.ratio.value = T.limiter.ratio;
      limiter.attack.value = T.limiter.attack;
      limiter.release.value = T.limiter.release;
      limiter.connect(ctx.destination);
      const master = ctx.createGain();
      master.connect(limiter);
      this.buses.set('master', master);
      for (const id of BUSES) {
        const g = ctx.createGain();
        g.connect(master);
        this.buses.set(id, g);
      }
      for (const id of ['master', ...BUSES] as BusId[]) this.applyBus(id);
    }
    void this.ctx.resume();
  }

  /** Call on `visibilitychange`. Hidden pages are silenced by suspending the context. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  /** Sets a bus volume, 0 to 1. */
  setVolume(bus: BusId, v: number): void {
    this.volumes[bus] = Math.min(1, Math.max(0, v));
    this.applyBus(bus);
  }

  /** Mutes or unmutes a bus without losing its volume. */
  setMuted(bus: BusId, muted: boolean): void {
    if (muted) this.muted.add(bus);
    else this.muted.delete(bus);
    this.applyBus(bus);
  }

  /** Lowers the music while someone is talking, without touching the music volume setting. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyBus('music');
  }

  /** Effective gain of a bus (0 when muted). For tests and UI. */
  busGain(bus: BusId): number {
    if (this.muted.has(bus)) return 0;
    return bus === 'music' && this.ducked ? this.volumes[bus] * T.duckGain : this.volumes[bus];
  }

  private applyBus(bus: BusId): void {
    const g = this.buses.get(bus);
    if (g && this.ctx) g.gain.setValueAtTime(this.busGain(bus), this.ctx.currentTime);
  }

  /** Plays an effect by id. Returns false if skipped (locked, unknown, or no voice free). */
  playSfx(id: string): boolean {
    const ctx = this.ctx;
    const def = this.deps.sfx.get(id);
    const bus = def && this.buses.get(def.bus);
    if (!ctx || !def || !bus) return false;
    const now = ctx.currentTime;
    const { playing, end } = playSfx(ctx, bus, def, now, this.deps.rand);
    const ok = this.pool.acquire(now, T.priority[def.bus], end, playing.stop);
    if (!ok) playing.stop();
    return ok;
  }

  /** Starts a track, crossfading from the current one. No-op if it is already playing. */
  playTrack(id: string, fadeSec: number = T.crossfadeSec): void {
    const ctx = this.ctx;
    const track = this.deps.tracks.get(id);
    const bus = this.buses.get('music');
    if (!ctx || !track || !bus || this.currentTrack === id) return;
    this.stopMusic(fadeSec);
    this.currentTrack = id;

    let c = this.compiled.get(id);
    if (!c) {
      c = { notes: compileTrack(track), len: loopSeconds(track) };
      this.compiled.set(id, c);
    }
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + 0.05;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, t0 + fadeSec);
    gain.connect(bus);
    const cursor = new TrackCursor(c.notes, c.len, t0);
    const player: MusicPlayer = {
      gain,
      playing: [],
      timer: 0 as unknown as ReturnType<typeof setInterval>,
    };
    const pump = (): void => {
      const now = ctx.currentTime;
      for (const { note, at } of cursor.take(now + T.musicLookaheadSec)) {
        const inst = track.channels[note.channel]?.instrument;
        if (!inst) continue;
        const { playing, end } = playNote(
          ctx,
          gain,
          inst,
          note.freq,
          Math.max(at, now),
          note.duration,
        );
        const ok = this.pool.acquire(now, T.priority.music, end, playing.stop);
        if (!ok) playing.stop();
      }
    };
    pump();
    player.timer = setInterval(pump, T.musicTimerMs);
    this.music = player;
  }

  /** Fades out and stops the current track. */
  stopMusic(fadeSec: number = T.crossfadeSec): void {
    const ctx = this.ctx;
    const m = this.music;
    if (!ctx || !m) return;
    clearInterval(m.timer);
    m.gain.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.gain.setValueAtTime(m.gain.gain.value, ctx.currentTime);
    m.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeSec);
    this.music = null;
    this.currentTrack = null;
  }

  /** Live voice count, for tests and the dev overlay. */
  voiceCount(): number {
    return this.ctx ? this.pool.size(this.ctx.currentTime) : 0;
  }
}
