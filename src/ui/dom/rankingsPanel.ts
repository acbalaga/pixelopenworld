import { RANKING_STRINGS as S } from '../../content/strings/rankings';
import { boardPage, boardSummaries, type RankRow } from '../menu/rankingsModel';
import type { SimState } from '../../sim/state';
import { el, put } from './parts';

/** What the panel needs: the sim to read and the map percent, which only the game knows. */
export interface RankingsDeps {
  read: () => { state: SimState; who: number };
  mapPercent: () => number;
}

const fill = (t: string, v: Record<string, string | number>): string =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

function line(r: RankRow, unit: string): HTMLElement {
  const li = el('li', r.isYou ? 'pow-rank-row pow-rank-you' : 'pow-rank-row');
  put(
    li,
    el('span', 'pow-rank-n', String(r.rank)),
    el('span', 'pow-rank-name', r.isYou ? `${r.handle} (${S.you})` : r.handle),
    el('span', 'pow-rank-val', `${r.value.toLocaleString('en-US')} ${unit}`),
  );
  if (r.isYou) li.setAttribute('aria-current', 'true');
  return li;
}

/**
 * The rankings panel (M5-09): a board picker and the board. It is built from the shared parts and
 * set with `textContent`. The Social tab and the request board's wall both use it. Redraw on
 * `render()`: it keeps the chosen board between redraws.
 */
export class RankingsPanel {
  private choice = '';
  readonly root = el('div', 'pow-rankings');

  constructor(private readonly deps: RankingsDeps) {}

  render(): void {
    const { state, who } = this.deps.read();
    const map = this.deps.mapPercent();
    const list = boardSummaries(state, who, map);
    if (!list.some((b) => b.id === this.choice)) {
      // Start on the board where the player stands highest, else the first.
      const ranked = list.filter((b) => b.rank !== null).sort((a, b) => a.rank! - b.rank!);
      this.choice = (ranked[0] ?? list[0])?.id ?? '';
    }
    this.root.textContent = '';
    if (list.length === 0) {
      put(this.root, el('p', 'pow-empty', S.empty));
      return;
    }
    const sel = el('select', 'pow-rank-select');
    sel.dataset.key = 'rank-board';
    sel.setAttribute('aria-label', S.boardLabel);
    for (const b of list) {
      const o = el(
        'option',
        undefined,
        b.rank === null
          ? b.name
          : `${b.name}, ${fill(S.summary, { rank: b.rank, total: b.total })}`,
      );
      o.value = b.id;
      o.selected = b.id === this.choice;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      this.choice = sel.value;
      this.render();
      sel.focus();
    });
    this.root.appendChild(sel);
    const page = boardPage(state, who, this.choice, map);
    put(
      this.root,
      el(
        'p',
        'pow-rank-yours',
        page.rank === null
          ? page.total === 0
            ? page.emptyLine
            : S.noneYet
          : page.rank === 1
            ? fill(S.yourRankTop, { total: page.total })
            : fill(S.yourRank, { rank: page.rank, total: page.total }),
      ),
    );
    if (page.total === 0) return;
    const ol = el('ol', 'pow-rank-list');
    for (const r of page.top) put(ol, line(r, page.unit));
    if (page.near.length > 0) {
      put(ol, el('li', 'pow-rank-gap', '...'));
      for (const r of page.near) put(ol, line(r, page.unit));
    }
    put(this.root, ol);
  }
}
