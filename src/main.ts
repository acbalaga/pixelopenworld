import './style.css';
import { startScene } from './demo/scene';

function start(): void {
  const el = document.getElementById('game');
  if (!(el instanceof HTMLCanvasElement)) throw new Error('canvas missing');
  void startScene(el);
}

start();
