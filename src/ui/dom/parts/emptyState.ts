import { el } from './dom';

/** One sentence that says what fills this space and how. Never a blank panel. */
export function emptyState(text: string): HTMLElement {
  return el('p', 'pow-part-empty', text);
}
