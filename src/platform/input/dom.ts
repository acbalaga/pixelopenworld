import { InputSampler } from './sampler';
import { GAME_KEYS } from './keyboard';
import { computeLayout } from './layout';
import { TouchController } from './touch';

/** Settings the input layer reads. */
export interface InputOptions {
  leftHanded: () => boolean;
}

/**
 * Attaches DOM listeners to the game surface and returns the sampler. Also suppresses browser
 * gestures: scroll, zoom, selection, context menu, pull to refresh.
 */
export function attachInput(
  surface: HTMLElement,
  opts: InputOptions,
): { sampler: InputSampler; layout: () => ReturnType<typeof computeLayout>; detach: () => void } {
  const rect = (): DOMRect => surface.getBoundingClientRect();
  const makeLayout = (): ReturnType<typeof computeLayout> => {
    const r = rect();
    return computeLayout(r.width, r.height, opts.leftHanded());
  };
  let layout = makeLayout();
  const touch = new TouchController(layout);
  const sampler = new InputSampler(touch, () => {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) if (p?.connected) return p;
    return null;
  });

  const local = (e: PointerEvent): { x: number; y: number } => {
    const r = rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const refresh = (): void => {
    layout = makeLayout();
    touch.setLayout(layout);
  };

  const ac = new AbortController();
  const o = { signal: ac.signal };
  const noPassive = { signal: ac.signal, passive: false } as const;

  surface.addEventListener(
    'pointerdown',
    (e) => {
      surface.setPointerCapture(e.pointerId);
      refresh();
      const p = local(e);
      touch.down(e.pointerId, p.x, p.y, e.timeStamp);
      e.preventDefault();
    },
    noPassive,
  );
  surface.addEventListener(
    'pointermove',
    (e) => {
      const p = local(e);
      touch.move(e.pointerId, p.x, p.y);
    },
    o,
  );
  surface.addEventListener(
    'pointerup',
    (e) => {
      const p = local(e);
      touch.up(e.pointerId, p.x, p.y, e.timeStamp);
    },
    o,
  );
  surface.addEventListener('pointercancel', (e) => touch.cancel(e.pointerId), o);
  for (const type of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart'] as const) {
    surface.addEventListener(type, (e) => e.preventDefault(), noPassive);
  }
  surface.addEventListener('touchstart', (e) => e.preventDefault(), noPassive);
  surface.addEventListener('touchmove', (e) => e.preventDefault(), noPassive);
  window.addEventListener('resize', refresh, o);
  window.addEventListener(
    'keydown',
    (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      sampler.keyboard.keyDown(e.code);
    },
    noPassive,
  );
  window.addEventListener('keyup', (e) => sampler.keyboard.keyUp(e.code), o);
  window.addEventListener('blur', () => sampler.keyboard.reset(), o);

  return { sampler, layout: () => layout, detach: () => ac.abort() };
}
