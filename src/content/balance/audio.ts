/** Audio tunables. */
export const AUDIO_TUNABLES = {
  /** Simultaneous voices, effects and music notes together. */
  voiceCap: 16,
  /** Default bus volumes, 0 to 1. */
  defaultVolumes: { master: 0.8, music: 0.6, effects: 0.9, ambience: 0.7, ui: 0.8 },
  /** Scheduler lookahead and timer period for music, in seconds. */
  musicLookaheadSec: 0.25,
  musicTimerMs: 50,
  /** Default music crossfade, seconds. */
  crossfadeSec: 1.5,
  /** Limiter settings. */
  limiter: { threshold: -6, knee: 0, ratio: 20, attack: 0.003, release: 0.1 },
  /** Priorities, higher wins when the cap is full. */
  priority: { music: 1, ui: 2, effects: 3 },
} as const;
