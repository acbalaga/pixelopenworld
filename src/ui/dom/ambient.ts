import { SCAFFOLD_CHAT } from '../../content/chat/scaffold';
import { UI_STRINGS as S } from '../../content/strings/ui';

/** The one-line hint, near the top, that never takes input. */
export class HintLine {
  private line: HTMLElement | null = null;
  private current: string | null = null;

  constructor(private readonly root: HTMLElement) {}

  /** Shows the hint with this key under `UI_STRINGS.hints`, or hides it when null. */
  set(key: string | null): void {
    if (key === this.current) return;
    this.current = key;
    this.line?.remove();
    this.line = null;
    if (!key) return;
    const text = (S.hints as Record<string, string>)[key];
    if (!text) return;
    const l = document.createElement('p');
    l.className = 'pow-hint-line';
    l.setAttribute('role', 'status');
    l.textContent = text;
    this.root.appendChild(l);
    this.line = l;
  }
}

/**
 * The scripted chat ticker (scaffolding, see `content/chat/scaffold.ts`). `update` is called each
 * frame with seconds of play; each line shows once as play time passes it, and a session that
 * starts past a line does not replay it.
 */
export class ChatTicker {
  private readonly box: HTMLElement;
  private next = 0;

  constructor(root: HTMLElement, startSec: number) {
    this.box = document.createElement('div');
    this.box.className = 'pow-chat-ticker';
    // Not a live region: it would read every line aloud over play.
    this.box.setAttribute('aria-hidden', 'true');
    root.appendChild(this.box);
    while (
      this.next < SCAFFOLD_CHAT.length &&
      (SCAFFOLD_CHAT[this.next] as { atSec: number }).atSec < startSec
    )
      this.next++;
  }

  update(playSec: number): void {
    while (this.next < SCAFFOLD_CHAT.length) {
      const line = SCAFFOLD_CHAT[this.next] as (typeof SCAFFOLD_CHAT)[number];
      if (line.atSec > playSec) break;
      this.next++;
      const p = document.createElement('p');
      p.className = 'pow-chat-line';
      const name = document.createElement('span');
      name.className = 'pow-chat-name';
      name.textContent = `${line.name}:`;
      p.appendChild(name);
      p.appendChild(document.createTextNode(` ${line.text}`));
      this.box.appendChild(p);
      window.setTimeout(() => p.remove(), 14_000);
      while (this.box.children.length > 3) this.box.firstElementChild?.remove();
    }
  }
}

/**
 * The pinned request (design/09): one request's own words, in clear text, bottom left. It is not
 * a tracker. No place, no arrow. Set each frame with the line from `sim/requestLog`, or null.
 */
export class PinnedLine {
  private line: HTMLElement | null = null;
  private text = '';
  private ready = false;

  constructor(private readonly root: HTMLElement) {}

  set(pin: { text: string; ready: boolean } | null): void {
    if (!pin) {
      this.line?.remove();
      this.line = null;
      this.text = '';
      return;
    }
    if (this.line && pin.text === this.text && pin.ready === this.ready) return;
    this.text = pin.text;
    this.ready = pin.ready;
    if (!this.line) {
      this.line = document.createElement('p');
      this.line.className = 'pow-pin-line';
      this.line.dataset.key = 'pinned-request';
      this.root.appendChild(this.line);
    }
    this.line.classList.toggle('pow-pin-ready', pin.ready);
    this.line.textContent = pin.text;
  }
}
