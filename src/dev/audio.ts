import { THEME_TRACK } from '../content/audio/music';
import { SFX } from '../content/audio/sfx';
import type { BusId } from '../content/audio/types';
import { attachAudioLifecycle, createGameAudio } from '../platform/audio';
import { el, mountDevPage } from './page';

const BUSES: readonly BusId[] = ['master', 'music', 'effects', 'ui', 'ambience'];

/** `/dev/audio`: play any effect or track, adjust bus volumes. */
export function startAudioPage(): void {
  const main = mountDevPage('Audio');
  main.id = 'pow-dev-audio';
  const engine = createGameAudio();
  attachAudioLifecycle(engine);

  const status = el('p');
  const refresh = (): void => {
    status.textContent = `context ${engine.ready ? 'running' : 'locked (tap anything)'}, voices ${engine.voiceCount()}`;
  };
  setInterval(refresh, 250);
  refresh();
  main.appendChild(status);

  main.appendChild(el('h2', undefined, 'Effects'));
  const sfx = el('div', 'dev-bar');
  for (const def of SFX) {
    const b = el('button', undefined, def.id);
    b.type = 'button';
    b.addEventListener('click', () => {
      engine.unlock();
      engine.playSfx(def.id);
    });
    sfx.appendChild(b);
  }
  main.appendChild(sfx);

  main.appendChild(el('h2', undefined, 'Music'));
  const music = el('div', 'dev-bar');
  const play = el('button', undefined, `Play ${THEME_TRACK.id}`);
  play.type = 'button';
  play.addEventListener('click', () => {
    engine.unlock();
    engine.playTrack(THEME_TRACK.id);
  });
  const stop = el('button', undefined, 'Stop');
  stop.type = 'button';
  stop.addEventListener('click', () => engine.stopMusic());
  music.appendChild(play);
  music.appendChild(stop);
  main.appendChild(music);

  main.appendChild(el('h2', undefined, 'Volume'));
  for (const bus of BUSES) {
    const row = el('label', 'dev-slider', bus);
    const input = el('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.value = String(engine.busGain(bus));
    input.addEventListener('input', () => engine.setVolume(bus, Number(input.value)));
    row.appendChild(input);
    main.appendChild(row);
  }
}
