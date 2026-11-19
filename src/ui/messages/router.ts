import { UI_BALANCE } from '../../content/balance/ui';

const B = UI_BALANCE.messages;

/** The lanes of design/09. `tick` is drawn by the skill feed itself and is only logged here. */
export type Lane = 'floater' | 'tick' | 'notice' | 'banner' | 'chat' | 'hint';

/** Chat channels, in tab order. */
export const CHANNELS = ['world', 'local', 'party', 'guild', 'whisper', 'system'] as const;
export type Channel = (typeof CHANNELS)[number];

/** What every producer sends. */
export interface Message {
  lane: Lane;
  text: string;
  /** The same key posted again within the merge window adds a count (or an amount). */
  key?: string;
  icon?: string;
  /** Floaters: "+n text". Merging adds the amounts. */
  amount?: number;
  /** Banners: gold for a mastery or a Path. */
  tone?: 'plain' | 'gold';
  /** Chat: who said it and where. */
  from?: string;
  channel?: Channel;
}

export interface NoticeView {
  id: number;
  text: string;
  count: number;
  icon: string | null;
  hint: boolean;
}
export interface BannerView {
  text: string;
  tone: 'plain' | 'gold';
}
export interface FloaterView {
  text: string;
}
export interface ChatLine {
  from: string | null;
  text: string;
  channel: Channel;
  /** Router time of the post, ms. */
  at: number;
  /** Older than `chatShowMs`: the lane still shows it, dimmed, until newer lines replace it. */
  old?: boolean;
}
export interface LogEntry {
  lane: Lane;
  text: string;
  count: number;
  at: number;
}

interface NoticeItem extends NoticeView {
  key: string;
  /** Ms of showing left. Infinity for a hint, which stays until it is retracted. */
  left: number;
  postedAt: number;
}
interface FloaterItem {
  key: string;
  label: string;
  amount: number | null;
  count: number;
  left: number;
  postedAt: number;
}

/** The text a notice of this length is shown for, ms. */
export function noticeMs(text: string): number {
  const extra = Math.max(0, text.length - B.noticeFreeChars) * B.noticePerCharMs;
  return Math.min(B.noticeCapMs, B.noticeBaseMs + extra);
}

/**
 * The one place every transient message goes through (D21). It owns timing, merging, the queue
 * while a panel is open, and the System log. No DOM and no clock of its own: `update` is told the
 * wall time and whether a panel is open, so time stands still while the player cannot read.
 */
export class MessageRouter {
  /** Router time, ms. It only advances while nothing pauses it. */
  private t = 0;
  private lastWall: number | null = null;
  private nextId = 1;
  private visible: NoticeItem[] = [];
  private waiting: NoticeItem[] = [];
  private banners: { text: string; tone: 'plain' | 'gold'; key: string }[] = [];
  private bannerNow: (BannerView & { left: number }) | null = null;
  private floaterList: FloaterItem[] = [];
  private chat: ChatLine[] = [];
  private logList: LogEntry[] = [];
  private unreadCount = 0;
  private chatOpen = false;
  private held = false;

  /** Sends a message to its lane. */
  post(m: Message): void {
    switch (m.lane) {
      case 'notice':
      case 'hint':
        this.postNotice(m);
        break;
      case 'banner':
        this.record('banner', m.text);
        if (this.banners.length < B.bannerQueueMax)
          this.banners.push({ text: m.text, tone: m.tone ?? 'plain', key: m.key ?? m.text });
        break;
      case 'floater':
        this.postFloater(m);
        break;
      case 'chat':
        this.postChat(m);
        break;
      case 'tick':
        break;
    }
  }

  /** Removes a message by key from the notice lane: a hint that was acted on. */
  retract(key: string): void {
    this.visible = this.visible.filter((n) => n.key !== key);
    this.waiting = this.waiting.filter((n) => n.key !== key);
    this.promote();
  }

  /** Tap to dismiss a visible notice. */
  dismiss(id: number): void {
    this.visible = this.visible.filter((n) => n.id !== id);
    this.promote();
  }

  /**
   * Advances time. `paused` is true while the Menu, a shop, dialogue or a craft panel is open:
   * nothing ages and nothing is lost. Notices also wait while a banner shows.
   */
  update(wallMs: number, paused: boolean): void {
    const dt = this.lastWall === null ? 0 : Math.max(0, Math.min(250, wallMs - this.lastWall));
    this.lastWall = wallMs;
    this.held = paused;
    if (paused) return;
    this.t += dt;
    // Banners: one at a time.
    if (this.bannerNow) {
      this.bannerNow.left -= dt;
      if (this.bannerNow.left <= 0) this.bannerNow = null;
    }
    if (!this.bannerNow) {
      const next = this.banners.shift();
      if (next) this.bannerNow = { text: next.text, tone: next.tone, left: B.bannerMs };
    }
    if (!this.bannerNow) {
      for (const n of this.visible) n.left -= dt;
      this.visible = this.visible.filter((n) => n.left > 0);
      this.promote();
    }
    for (const f of this.floaterList) f.left -= dt;
    this.floaterList = this.floaterList.filter((f) => f.left > 0);
  }

  /** Notices on screen, newest first. Empty while a banner shows or a panel is open. */
  notices(): readonly NoticeView[] {
    return this.bannerNow || this.held ? [] : [...this.visible].reverse();
  }

  banner(): BannerView | null {
    return this.held ? null : this.bannerNow;
  }

  /** Floaters, oldest first, with "+n text" already built. */
  floaters(): readonly FloaterView[] {
    if (this.held) return [];
    return this.floaterList.map((f) => ({ text: floaterText(f) }));
  }

  /** The newest chat lines for the lane, oldest first. Old ones are marked and drawn dim. */
  chatLane(): readonly ChatLine[] {
    return this.chat
      .filter((l) => l.channel !== 'system')
      .slice(-B.chatLines)
      .map((l) => (this.t - l.at >= B.chatShowMs ? { ...l, old: true } : l));
  }

  /** Chat lines posted while the lane was collapsed and not yet seen. */
  get unread(): number {
    return this.unreadCount;
  }

  /** The player has the lane open, or the sheet: new lines are read as they come. */
  setChatSeen(open: boolean): void {
    this.chatOpen = open;
    if (open) this.unreadCount = 0;
  }

  /** The System log: every notice, banner and pickup since login, oldest first. */
  log(): readonly LogEntry[] {
    return this.logList;
  }

  /** A channel's lines, oldest first. System is the log. */
  lines(channel: Channel): readonly ChatLine[] {
    if (channel === 'system')
      return this.logList.map((e) => ({ from: null, text: e.text, channel, at: e.at }));
    return this.chat.filter((l) => l.channel === channel);
  }

  /** Channels with something in them, in tab order. Empty ones are hidden. */
  channels(): readonly Channel[] {
    return CHANNELS.filter((c) => this.lines(c).length > 0);
  }

  // ---- internals ----

  private record(lane: Lane, text: string, merge = false): void {
    const last = this.logList[this.logList.length - 1];
    if (merge && last && last.lane === lane && last.text === text && this.t - last.at < B.mergeMs) {
      last.count++;
      return;
    }
    this.logList.push({ lane, text, count: 1, at: this.t });
    if (this.logList.length > B.logMax) this.logList.shift();
  }

  private postNotice(m: Message): void {
    const key = m.key ?? m.text;
    this.record(m.lane, m.text, true);
    const hint = m.lane === 'hint';
    for (const n of [...this.visible, ...this.waiting]) {
      if (n.key !== key) continue;
      if (this.t - n.postedAt < B.mergeMs || hint) {
        n.count = hint ? 1 : n.count + 1;
        n.postedAt = this.t;
        if (!hint) n.left = Math.max(n.left, noticeMs(n.text));
        return;
      }
    }
    this.waiting.push({
      id: this.nextId++,
      key,
      text: m.text,
      count: 1,
      icon: m.icon ?? (hint ? 'hint' : null),
      hint,
      left: hint ? Infinity : noticeMs(m.text),
      postedAt: this.t,
    });
    this.promote();
  }

  /** Fills free notice slots from the queue, oldest first. */
  private promote(): void {
    while (this.visible.length < B.noticeMax && this.waiting.length > 0)
      this.visible.push(this.waiting.shift() as NoticeItem);
  }

  private postFloater(m: Message): void {
    const key = m.key ?? m.text;
    this.record('floater', m.amount !== undefined ? `+${m.amount} ${m.text}` : m.text, true);
    const same = this.floaterList.find(
      (f) => f.key === key && this.t - f.postedAt < B.floaterMergeMs,
    );
    if (same) {
      if (m.amount !== undefined) same.amount = (same.amount ?? 0) + m.amount;
      else same.count++;
      same.postedAt = this.t;
      same.left = B.floaterMs;
      return;
    }
    this.floaterList.push({
      key,
      label: m.text,
      amount: m.amount ?? null,
      count: 1,
      left: B.floaterMs,
      postedAt: this.t,
    });
    while (this.floaterList.length > B.floaterStack) this.floaterList.shift();
  }

  private postChat(m: Message): void {
    this.chat.push({
      from: m.from ?? null,
      text: m.text,
      channel: m.channel ?? 'world',
      at: this.t,
    });
    if (!this.chatOpen) this.unreadCount++;
  }
}

/** "+5 Moss", or "Moss x2", cut to the floater width. */
function floaterText(f: FloaterItem): string {
  const full =
    f.amount !== null
      ? `+${f.amount} ${f.label}`
      : f.count > 1
        ? `${f.label} x${f.count}`
        : f.label;
  return full.length > B.floaterChars ? `${full.slice(0, B.floaterChars - 1)}~` : full;
}
