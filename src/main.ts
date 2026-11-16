function start(): void {
  const el = document.getElementById('game');
  if (!(el instanceof HTMLCanvasElement)) throw new Error('canvas missing');
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  const paint = (): void => {
    el.width = window.innerWidth;
    el.height = window.innerHeight;
    ctx.fillStyle = '#3a6ea5';
    ctx.fillRect(0, 0, el.width, el.height);
  };

  window.addEventListener('resize', paint);
  paint();
}

start();
