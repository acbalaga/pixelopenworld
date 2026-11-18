import { REQUEST_STRINGS as T } from '../../content/strings/requests';
import { boardPosted, boardReady, requestLog, type PostedView } from '../../sim/requestLog';
import type { Command } from '../../sim/kernel/commands';
import type { SimEvent } from '../../sim/kernel/events';
import type { SimState } from '../../sim/state';

/** What the board panel needs from the game. It reads words from `sim/requestLog` and sends commands. */
export interface BoardDeps {
  read: () => { state: SimState; who: number };
  send: (c: Command) => void;
  /** Called with true when the panel opens and false when it closes, so play can pause its keys. */
  onOpenChange?: (open: boolean) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function put<K extends HTMLElement>(parent: K, ...kids: HTMLElement[]): K {
  for (const k of kids) parent.appendChild(k);
  return parent;
}

/**
 * The request board (M3-11): a sheet of clear text listing what is posted, with a button to take
 * each, and the requests this board gave that are ready to hand in. It shows no place and no
 * direction. It redraws when the sim reports a request taken or finished.
 */
export class BoardSheet {
  private sheet: HTMLElement | null = null;
  private board = '';
  private sig = '';
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.code !== 'Escape') return;
    e.stopPropagation();
    this.close();
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly deps: BoardDeps,
  ) {}

  get isOpen(): boolean {
    return this.sheet !== null;
  }

  onEvent(e: SimEvent): void {
    if (e.type === 'boardOpened') this.open(e.board);
    else if (this.sheet && (e.type === 'requestStarted' || e.type === 'requestCompleted'))
      this.render(true);
  }

  /** Called each frame while open: redraws only when what it shows has changed. */
  update(): void {
    if (this.sheet) this.render(false);
  }

  open(board: string): void {
    this.close();
    this.board = board;
    const sheet = el('section', 'pow-panel pow-sheet pow-board');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', T['request.board.title'] as string);
    this.root.appendChild(sheet);
    this.sheet = sheet;
    window.addEventListener('keydown', this.onKey, true);
    this.deps.onOpenChange?.(true);
    this.render(true);
  }

  close(): void {
    if (!this.sheet) return;
    window.removeEventListener('keydown', this.onKey, true);
    this.sheet.remove();
    this.sheet = null;
    this.deps.onOpenChange?.(false);
  }

  private signature(): string {
    const { state, who } = this.deps.read();
    return JSON.stringify([
      boardPosted(state, this.board),
      boardReady(state, who, this.board),
      requestLog(state, who).length,
    ]);
  }

  private render(force: boolean): void {
    const sheet = this.sheet;
    if (!sheet) return;
    const sig = this.signature();
    if (!force && sig === this.sig) return;
    this.sig = sig;
    const { state, who } = this.deps.read();
    sheet.textContent = '';
    put(sheet, el('h2', 'pow-sheet-title', T['request.board.title']));

    const ready = boardReady(state, who, this.board);
    if (ready.length > 0) {
      const log = requestLog(state, who).filter((r) => ready.includes(r.id));
      put(sheet, el('h3', 'pow-h', T['request.board.yours']));
      for (const r of log) {
        const row = el('div', 'pow-board-row');
        const btn = el('button', 'pow-button', T['request.board.turnIn']);
        btn.type = 'button';
        btn.dataset.key = `turnin-${r.id}`;
        btn.addEventListener('click', () => this.deps.send({ type: 'turnInRequest', id: r.id }));
        put(row, el('strong', undefined, r.title), el('p', 'pow-hint', r.reward), btn);
        sheet.appendChild(row);
      }
    }

    const posted: PostedView[] = boardPosted(state, this.board);
    if (posted.length === 0) put(sheet, el('p', 'pow-hint', T['request.board.empty']));
    for (const p of posted) {
      const row = el('div', 'pow-board-row');
      row.dataset.request = p.id;
      put(row, el('strong', undefined, p.title), el('p', 'pow-request-ask', p.ask));
      for (const w of p.ways) {
        const way = el('ul', 'pow-request-way');
        way.setAttribute('aria-label', w.label);
        for (const st of w.steps) way.appendChild(el('li', 'pow-step', st.text));
        row.appendChild(way);
      }
      row.appendChild(el('p', 'pow-hint', p.reward));
      const take = el('button', 'pow-button', T['request.board.take']);
      take.type = 'button';
      take.dataset.key = `take-${p.id}`;
      take.addEventListener('click', () =>
        this.deps.send({ type: 'takeRequest', board: this.board, id: p.id }),
      );
      row.appendChild(take);
      sheet.appendChild(row);
    }
    const close = el('button', 'pow-button', T['request.board.close']);
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    sheet.appendChild(close);
    if (force) (sheet.querySelector('button') as HTMLButtonElement | null)?.focus();
  }
}
