import './style.css';
import { startScene } from './demo/scene';
import { startUiDemo } from './demo/ui';

function start(): void {
  const el = document.getElementById('game');
  if (!(el instanceof HTMLCanvasElement)) throw new Error('canvas missing');
  // `?scene=ui` is the M0-09 UI demo. The default is the drift scene.
  if (new URLSearchParams(location.search).get('scene') === 'ui') void startUiDemo(el);
  else void startScene(el);
}

start();
