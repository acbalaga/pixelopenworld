import { UI_BALANCE } from '../../../content/balance/ui';
import { UI_STRINGS as S } from '../../../content/strings/ui';
import { el, nextId } from './dom';

/**
 * Makes `b` a hold-to-confirm button (design/09 "Touch rules"): the action runs only after the
 * press is held for `holdConfirmMs`, by touch, mouse or keyboard. Returns the hint that describes
 * the button to screen readers.
 */
export function holdToConfirm(b: HTMLButtonElement, done: () => void): HTMLElement {
  const hint = el('span', 'pow-sr', S.dropping);
  hint.id = nextId('pow-hint');
  b.setAttribute('aria-describedby', hint.id);
  let start = 0;
  let t: number | null = null;
  const stop = (): void => {
    if (t !== null) window.clearInterval(t);
    t = null;
    b.style.setProperty('--hold', '0%');
    b.classList.remove('holding');
  };
  const begin = (): void => {
    if (t !== null) return;
    start = performance.now();
    b.classList.add('holding');
    t = window.setInterval(() => {
      const f = (performance.now() - start) / UI_BALANCE.menu.holdConfirmMs;
      b.style.setProperty('--hold', `${Math.min(100, Math.round(f * 100))}%`);
      if (f >= 1) {
        stop();
        done();
      }
    }, 30);
  };
  b.addEventListener('pointerdown', begin);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const)
    b.addEventListener(ev, stop);
  b.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      begin();
    }
  });
  b.addEventListener('keyup', stop);
  b.addEventListener('blur', stop);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return hint;
}
