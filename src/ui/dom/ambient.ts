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
