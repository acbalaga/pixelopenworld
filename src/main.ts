import './style.css';
import { startScene } from './demo/scene';
import { startUiDemo } from './demo/ui';
import { startWorldDemo } from './demo/world';

function start(): void {
  // Dev pages exist only in dev builds. The whole branch is removed from production, which
  // tools/check-dev-absent.mjs verifies.
  if (import.meta.env.DEV) {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === '/dev/sprites') {
      void import('./dev/sprites').then((m) => m.startSpritesPage());
      return;
    }
    if (path === '/dev/audio') {
      void import('./dev/audio').then((m) => m.startAudioPage());
      return;
    }
  }
  const el = document.getElementById('game');
  if (!(el instanceof HTMLCanvasElement)) throw new Error('canvas missing');
  // `?scene=drift` is the M0-05 drift scene (many moving rects), `?scene=ui` the M0-09 UI demo.
  // The default is the world demo.
  const scene = new URLSearchParams(location.search).get('scene');
  if (scene === 'drift') void startScene(el);
  else if (scene === 'ui') void startUiDemo(el);
  else void startWorldDemo(el);
}

start();
