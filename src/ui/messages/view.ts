import { CHIPS, EMOTE_CHIPS } from '../../content/chat/social';
import { FRIEND_STRINGS as F } from '../../content/strings/friends';
import { UI_STRINGS as S } from '../../content/strings/ui';
import { richNodes } from '../dom/glyph';
import type { Rect } from '../../platform/input/layout';
import type { SettingsStore } from '../../platform/settings';
import type { LaneRects } from './layout';
import { CHANNELS, type Channel, type MessageRouter } from './router';

const place = (el: HTMLElement, r: Rect): void => {
  el.style.left = `${Math.round(r.x)}px`;
  el.style.top = `${Math.round(r.y)}px`;
  el.style.width = `${Math.round(r.w)}px`;
  el.style.height = `${Math.round(r.h)}px`;
};

/**
 * The DOM side of the message lanes: the notice stack, the banner, the chat lane and the chat
 * sheet. Everything is placed from `LaneRects`, so no lane picks its own spot. Text is clear text
 * (design/09 "The text rule") and scales with the text setting.
 */
export class MessageView {
  private readonly stack: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly lane: HTMLElement;
  private readonly laneLines: HTMLElement;
  private readonly collapse: HTMLButtonElement;
  private readonly unread: HTMLButtonElement;
  private readonly sheet: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly list: HTMLElement;
  private readonly chipBar: HTMLElement;
  private chipOffer: ChipOffer | null = null;
  private chipEmotes = false;
  private sigChips = '';
  /** Called with the Traveler's slot and the chip id when the player taps a chip. */
  onChip: (slot: number, chip: string) => void = () => undefined;
  private sheetOpen = false;
  private sigNotices = '';
  private sigBanner = '';
  private sigLane = '';
  private sigSheet = '';
  private sigTabs = '';

  constructor(
    root: HTMLElement,
    private readonly router: MessageRouter,
    private readonly settings: Pick<SettingsStore, 'get' | 'set'>,
  ) {
    // Notices and the banner are polite live regions, so a screen reader hears them once.
    this.stack = el('div', 'pow-notices');
    this.stack.setAttribute('role', 'status');
    this.banner = el('div', 'pow-banner');
    this.banner.setAttribute('role', 'status');
    this.lane = el('div', 'pow-chat-lane');
    this.laneLines = el('div', 'pow-chat-lines');
    this.laneLines.setAttribute('role', 'button');
    this.laneLines.tabIndex = 0;
    this.laneLines.setAttribute('aria-label', S.chat.laneLabel);
    this.laneLines.addEventListener('click', () => this.openSheet());
    this.laneLines.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openSheet();
      }
    });
    this.collapse = el('button', 'pow-chat-collapse');
    this.collapse.type = 'button';
    this.collapse.addEventListener('click', () => this.setCollapsed(true));
    this.unread = el('button', 'pow-chat-unread');
    this.unread.type = 'button';
    this.unread.addEventListener('click', () => this.setCollapsed(false));
    add(this.lane, this.laneLines, this.collapse);

    this.sheet = el('section', 'pow-chat-sheet');
    this.sheet.setAttribute('role', 'region');
    this.sheet.setAttribute('aria-label', S.chat.sheetLabel);
    this.sheet.hidden = true;
    this.tabs = el('div', 'pow-chat-tabs');
    this.tabs.setAttribute('role', 'tablist');
    const close = el('button', 'pow-chat-close');
    close.type = 'button';
    close.textContent = 'x';
    close.setAttribute('aria-label', S.chat.close);
    close.addEventListener('click', () => this.closeSheet());
    const head = el('div', 'pow-chat-head');
    add(head, this.tabs, close);
    this.list = el('div', 'pow-chat-list');
    this.list.setAttribute('role', 'log');
    add(this.sheet, head, this.list);
    this.chipBar = el('div', 'pow-chips');
    this.chipBar.hidden = true;
    this.chipBar.setAttribute('role', 'group');
    add(root, this.stack, this.banner, this.lane, this.unread, this.sheet, this.chipBar);
    window.addEventListener('keydown', (e) => {
      if (this.sheetOpen && e.code === 'Escape') this.closeSheet();
    });
  }

  /** True while the sheet is open: lanes pause behind it like any other panel. */
  get open(): boolean {
    return this.sheetOpen;
  }

  openSheet(): void {
    if (this.sheetOpen) return;
    this.sheetOpen = true;
    this.sheet.hidden = false;
    this.router.setChatSeen(true);
  }

  closeSheet(): void {
    this.sheetOpen = false;
    this.sheet.hidden = true;
    this.router.setChatSeen(!this.settings.get().chatCollapsed ? true : false);
  }

  private setCollapsed(c: boolean): void {
    this.settings.set({ chatCollapsed: c });
    this.router.setChatSeen(!c);
  }

  /** A trace or hold panel is up: the lanes that share its part of the screen step aside. */
  setBusy(b: boolean): void {
    for (const e of [this.stack, this.banner, this.lane, this.unread])
      e.classList.toggle('pow-busy', b);
  }

  /** Offers reply chips for a Traveler's line, or clears them with null (M5-06). */
  offer(o: ChipOffer | null): void {
    this.chipOffer = o;
    this.chipEmotes = false;
    this.sigChips = '';
  }

  /** Positions the lanes. Cheap: only writes styles. */
  layout(r: LaneRects, sheetTop: number): void {
    place(this.stack, r.notices);
    place(this.banner, r.banner);
    place(this.lane, r.chat);
    // The unread glyph takes the lane's corner when it is folded.
    this.unread.style.left = `${Math.round(r.chat.x)}px`;
    this.unread.style.top = `${Math.round(r.chat.y + r.chat.h - 28)}px`;
    this.sheet.style.top = `${Math.round(sheetTop)}px`;
    // The chips sit just above the chat lane, or above the sheet while it is open.
    const base = this.sheetOpen ? sheetTop : r.chat.y;
    this.chipBar.style.left = `${Math.round(r.chat.x)}px`;
    this.chipBar.style.bottom = `${Math.round(window.innerHeight - base + 6)}px`;
    this.chipBar.style.width = `${Math.round(Math.min(window.innerWidth - r.chat.x - 8, 320))}px`;
  }

  /** Redraws what changed. Called once a frame. */
  render(): void {
    const collapsed = this.settings.get().chatCollapsed;
    // Notices.
    const notices = this.router.notices();
    const sn = notices.map((n) => `${n.id}:${n.count}`).join('|');
    if (sn !== this.sigNotices) {
      this.sigNotices = sn;
      this.stack.replaceChildren(
        ...notices.map((n) => {
          const d = el('div', n.hint ? 'pow-notice pow-notice-hint' : 'pow-notice');
          d.title = S.chat.dismiss;
          if (n.icon) {
            const g = el('span', 'pow-notice-icon');
            g.setAttribute('aria-hidden', 'true');
            g.textContent = '?';
            add(d, g);
          }
          add(d, document.createTextNode(n.count > 1 ? `${n.text} x${n.count}` : n.text));
          d.addEventListener('click', () => this.router.dismiss(n.id));
          return d;
        }),
      );
    }
    // Banner.
    const b = this.router.banner();
    const sb = b ? `${b.tone}:${b.text}` : '';
    if (sb !== this.sigBanner) {
      this.sigBanner = sb;
      this.banner.className = b ? `pow-banner pow-banner-${b.tone}` : 'pow-banner';
      this.banner.textContent = b?.text ?? '';
    }
    // Chat lane.
    const lines = this.router.chatLane();
    const sl = `${collapsed}|${this.router.unread}|${lines.map((l) => `${l.at}${l.text}${l.old}`).join('|')}`;
    if (sl !== this.sigLane) {
      this.sigLane = sl;
      // No lane until something has been said: a lone button over the world helps nobody.
      this.lane.hidden = collapsed || lines.length === 0;
      this.collapse.textContent = '-';
      this.collapse.setAttribute('aria-label', S.chat.collapse);
      this.laneLines.replaceChildren(
        ...lines.map((l) => {
          const p = el('p', l.old ? 'pow-chat-line pow-chat-old' : 'pow-chat-line');
          if (l.from) {
            const n = el('span', 'pow-chat-name');
            n.textContent = `${l.from}:`;
            add(p, n, ...richNodes(` ${l.text}`));
          } else add(p, ...richNodes(l.text));
          return p;
        }),
      );
      this.unread.hidden = !collapsed || this.router.channels().length === 0;
      this.unread.textContent =
        this.router.unread > 0 ? String(Math.min(99, this.router.unread)) : 'c';
      this.unread.setAttribute(
        'aria-label',
        `${S.chat.expand}. ${this.router.unread} ${S.chat.unread}`,
      );
    }
    this.renderChips();
    if (this.sheetOpen) this.renderSheet();
  }

  /** The reply chips: 2 to 4 buttons at least 48 px tall, and an Emote button that swaps them. */
  private renderChips(): void {
    const o = this.chipOffer;
    if (o && performance.now() > o.until) this.offer(null);
    const cur = this.chipOffer;
    const sig = cur ? `${cur.slot}|${cur.chips.map((c) => c.id).join(',')}|${this.chipEmotes}` : '';
    if (sig === this.sigChips) return;
    this.sigChips = sig;
    this.chipBar.hidden = cur === null;
    if (!cur) {
      this.chipBar.replaceChildren();
      return;
    }
    this.chipBar.setAttribute('aria-label', F.chips.label.replace('{name}', cur.from));
    const button = (id: string, text: string, onTap: () => void): HTMLButtonElement => {
      const b = el('button', 'pow-chip');
      b.type = 'button';
      b.dataset.chip = id;
      b.textContent = text;
      b.addEventListener('click', onTap);
      return b;
    };
    const head = el('p', 'pow-chips-head');
    head.textContent = F.chips.label.replace('{name}', cur.from);
    const row = el('div', 'pow-chips-row');
    if (this.chipEmotes) {
      for (const id of EMOTE_CHIPS)
        add(
          row,
          button(id, CHIPS[id]?.text ?? id, () => this.onChip(cur.slot, id)),
        );
      add(
        row,
        button('back', F.chips.back, () => this.toggleEmotes(false)),
      );
    } else {
      for (const c of cur.chips)
        add(
          row,
          button(c.id, c.text, () => {
            this.onChip(cur.slot, c.id);
            this.offer(null);
          }),
        );
      add(
        row,
        button('emotes', F.chips.emotes, () => this.toggleEmotes(true)),
      );
    }
    this.chipBar.replaceChildren(head, row);
  }

  private toggleEmotes(on: boolean): void {
    this.chipEmotes = on;
    this.sigChips = '';
  }

  private renderSheet(): void {
    const channels = this.router.channels();
    const want = (this.settings.get().chatTab as Channel) || 'world';
    const tab = channels.includes(want) ? want : (channels[0] ?? 'system');
    const st = `${tab}|${channels.join(',')}`;
    if (st !== this.sigTabs) {
      this.sigTabs = st;
      this.tabs.replaceChildren(
        ...CHANNELS.filter((c) => channels.includes(c)).map((c) => {
          const t = el('button', c === tab ? 'pow-chat-tab pow-chat-tab-on' : 'pow-chat-tab');
          t.type = 'button';
          t.setAttribute('role', 'tab');
          t.setAttribute('aria-selected', String(c === tab));
          t.textContent = S.chat.tabs[c];
          t.addEventListener('click', () => {
            this.settings.set({ chatTab: c });
            this.sigTabs = '';
          });
          return t;
        }),
      );
    }
    const lines = this.router.lines(tab);
    const ss = `${tab}|${lines.length}|${lines[lines.length - 1]?.at ?? 0}`;
    if (ss !== this.sigSheet) {
      this.sigSheet = ss;
      const atEnd = this.list.scrollTop + this.list.clientHeight >= this.list.scrollHeight - 4;
      this.list.replaceChildren(
        ...lines.map((l) => {
          const p = el('p', 'pow-chat-row');
          if (l.from) {
            const n = el('span', 'pow-chat-name');
            n.textContent = `${l.from}:`;
            add(p, n, ...richNodes(` ${l.text}`));
          } else add(p, ...richNodes(l.text));
          return p;
        }),
      );
      // Newest at the bottom: stay there unless the reader scrolled up.
      if (atEnd || this.list.scrollTop === 0) this.list.scrollTop = this.list.scrollHeight;
    }
  }
}

/** Reply chips on offer for one Traveler's line (M5-06). `until` is a `performance.now()` time. */
export interface ChipOffer {
  slot: number;
  from: string;
  chips: { id: string; text: string }[];
  until: number;
}

/** Appends children in order. (`append` is typed against the Worker libs here, so use appendChild.) */
function add(parent: Node, ...kids: Node[]): void {
  for (const k of kids) parent.appendChild(k);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
