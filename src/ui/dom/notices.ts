import { TABLET_GLYPHS } from '../../content/world/fixtures';
import { UI_STRINGS as S } from '../../content/strings/ui';
import type { MessageRouter } from '../messages/router';

const SVG = 'http://www.w3.org/2000/svg';

/** Short clear-text messages and the carved tablet. DOM only, built with createElement. */
export class Notices {
  private tabletEl: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly router: MessageRouter,
  ) {
    window.addEventListener('keydown', (e) => {
      if (this.tabletEl && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        this.closeTablet();
      }
    });
  }

  get tabletOpen(): boolean {
    return this.tabletEl !== null;
  }

  /** A short system message, sent to the notice lane. The router places and times it. */
  toast(text: string, key?: string): void {
    this.router.post({ lane: 'notice', text, ...(key ? { key } : {}) });
  }

  /** The tablet: a line of glyphs and nothing else. Any tap or Escape closes it. */
  /**
   * Opens the tablet. With `order`, it shows that many marks, each a stroke at the left, middle or
   * right of its cell (1, 2 or 3): a sequence read from the stone.
   */
  openTablet(order?: readonly number[]): void {
    if (this.tabletEl) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pow-tablet';
    b.setAttribute('aria-label', S.world.tabletLabel);
    const svg = document.createElementNS(SVG, 'svg');
    const cell = 8;
    const glyphs: readonly (readonly (readonly [number, number][])[])[] = order
      ? order.map((n) => [
          [
            [(n - 1) * 2, 0],
            [(n - 1) * 2, 5],
          ],
          [
            [0, 6],
            [4, 6],
          ],
        ])
      : TABLET_GLYPHS;
    svg.setAttribute('viewBox', `-2 -2 ${glyphs.length * cell + 2} 11`);
    svg.setAttribute('class', 'pow-glyphs');
    svg.setAttribute('aria-hidden', 'true');
    glyphs.forEach((strokes, i) => {
      for (const line of strokes) {
        const path = document.createElementNS(SVG, 'polyline');
        path.setAttribute('points', line.map(([x, y]) => `${x + i * cell},${y + 1}`).join(' '));
        svg.appendChild(path);
      }
    });
    b.appendChild(svg);
    b.addEventListener('click', () => this.closeTablet());
    this.root.appendChild(b);
    this.tabletEl = b;
    b.focus();
  }

  closeTablet(): void {
    this.tabletEl?.remove();
    this.tabletEl = null;
  }
}
