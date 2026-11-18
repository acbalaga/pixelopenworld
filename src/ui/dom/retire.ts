import { fill } from '../../content/strings/skills';
import { UI_STRINGS } from '../../content/strings/ui';
import { download } from './backup';

const S = UI_STRINGS.retire;

/** What the confirm needs: who is being deleted, and a way to export them first. */
export interface RetireInfo {
  handle: string;
  playSeconds: number;
  exportCurrent: () => Promise<{ bytes: Uint8Array; fileName: string }>;
  onExported?: () => void;
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

function put<T extends HTMLElement>(parent: T, ...kids: HTMLElement[]): T {
  for (const k of kids) parent.appendChild(k);
  return parent;
}

function played(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/**
 * Asks the player to confirm deleting their character. Offers an export first. Resolves true only
 * on Delete character. Escape and Cancel resolve false and nothing has changed. The caller does
 * the deleting.
 */
export function confirmRetire(root: HTMLElement, info: RetireInfo): Promise<boolean> {
  const box = el('div', 'pow-sheet pow-import pow-retire');
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', S.title);
  const status = el('p', 'pow-backup-status');
  status.setAttribute('role', 'status');
  const exp = el('button', 'pow-button', S.export);
  exp.type = 'button';
  const no = el('button', 'pow-button', S.cancel);
  no.type = 'button';
  const ok = el('button', 'pow-button pow-danger', S.confirm);
  ok.type = 'button';
  put(
    box,
    el('h2', 'pow-sheet-title', S.title),
    el('p', 'pow-recover-body', `${info.handle}, ${played(info.playSeconds)}`),
    el('p', 'pow-recover-body', fill(S.body, { name: info.handle })),
    put(el('div', 'pow-import-buttons'), exp),
    status,
    put(el('div', 'pow-import-buttons'), no, ok),
  );
  root.appendChild(box);
  no.focus();
  return new Promise((resolve) => {
    const end = (v: boolean): void => {
      window.removeEventListener('keydown', onKey, true);
      box.remove();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Escape') return;
      e.stopPropagation();
      end(false);
    };
    window.addEventListener('keydown', onKey, true);
    exp.addEventListener('click', () => {
      exp.disabled = true;
      void info
        .exportCurrent()
        .then((f) => {
          download(f.bytes, f.fileName);
          info.onExported?.();
          status.textContent = S.exported;
        })
        .catch(() => {
          status.textContent = S.exportFailed;
        })
        .finally(() => {
          exp.disabled = false;
        });
    });
    ok.addEventListener('click', () => end(true));
    no.addEventListener('click', () => end(false));
  });
}
