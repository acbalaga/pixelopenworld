import { SFX } from '../../content/audio/sfx';
import { THEME_TRACK } from '../../content/audio/music';
import { AudioEngine } from './engine';

/** Builds the game's engine from content. Nothing is created until the first user gesture. */
export function createGameAudio(): AudioEngine {
  return new AudioEngine({
    createContext: () => new AudioContext({ latencyHint: 'interactive' }),
    rand: Math.random,
    sfx: new Map(SFX.map((s) => [s.id, s])),
    tracks: new Map([[THEME_TRACK.id, THEME_TRACK]]),
  });
}

/** Unlocks on the first user gesture and silences output while the page is hidden. */
export function attachAudioLifecycle(engine: AudioEngine): () => void {
  const ac = new AbortController();
  const unlock = (): void => engine.unlock();
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) {
    window.addEventListener(type, unlock, { signal: ac.signal, capture: true });
  }
  document.addEventListener('visibilitychange', () => engine.setHidden(document.hidden), {
    signal: ac.signal,
  });
  return () => ac.abort();
}
