import { startInputDemo } from './demo/inputDemo';

function start(): void {
  const el = document.getElementById('game');
  if (!(el instanceof HTMLCanvasElement)) throw new Error('canvas missing');
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  const fit = (): void => {
    el.width = window.innerWidth;
    el.height = window.innerHeight;
  };
  window.addEventListener('resize', fit);
  fit();
  startInputDemo(el, ctx);
}

start();
