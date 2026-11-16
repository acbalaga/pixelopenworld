import './style.css';
import { startScene } from './demo/scene';
import { startWorldDemo } from './demo/world';

function start(): void {
  const el = document.getElementById('game');
  if (!(el instanceof HTMLCanvasElement)) throw new Error('canvas missing');
  // `?scene=drift` keeps the M0-05 drift scene (many moving rects). The default is the world demo.
  if (new URLSearchParams(location.search).get('scene') === 'drift') void startScene(el);
  else void startWorldDemo(el);
}

start();
