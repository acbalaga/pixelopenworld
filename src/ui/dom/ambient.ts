import { SCAFFOLD_CHAT } from '../../content/chat/scaffold';
import type { MessageRouter } from '../messages/router';

/**
 * The scripted chat (scaffolding, see `content/chat/scaffold.ts`). `update` is called each frame
 * with seconds of play; each line goes to the chat lane once as play time passes it, and a session
 * that starts past a line does not replay it.
 */
export class ChatTicker {
  private next = 0;

  constructor(
    private readonly router: MessageRouter,
    startSec: number,
  ) {
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
      this.router.post({ lane: 'chat', from: line.name, text: line.text, channel: 'world' });
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
