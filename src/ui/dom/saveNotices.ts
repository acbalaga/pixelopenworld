import { UI_STRINGS } from '../../content/strings/ui';
import type { LoadReport } from '../../save';

const S = UI_STRINGS.save;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Plain words for why a snapshot was skipped. */
export function reasonText(reason: string): string {
  if (reason.includes('authentication')) return S.recoverReason.integrity;
  if (reason.includes('checksum')) return S.recoverReason.damaged;
  return S.recoverReason.unreadable;
}

/** What the recover screen says, as plain data so it can be tested without a DOM. */
export function recoverLines(
  report: LoadReport,
  savedAt: number,
  locale?: string,
): { body: string; reasons: string[] } {
  const when = new Date(savedAt).toLocaleString(locale);
  const what = S.recoverLoaded[report.slot as keyof typeof S.recoverLoaded] ?? report.slot;
  const template = report.slot === 'emergency' ? S.recoverBodyEmergency : S.recoverBody;
  return {
    body: template.replace('{what}', what).replace('{when}', when),
    reasons: report.skipped
      .filter((s) => s.slot in S.recoverWhy)
      .map((s) => `${S.recoverWhy[s.slot as keyof typeof S.recoverWhy]} ${reasonText(s.reason)}`),
  };
}

/**
 * Tells the player which save was loaded and why. Built with createElement and `textContent`
 * only. Resolves when the player continues.
 */
export function showRecover(root: HTMLElement, report: LoadReport, savedAt: number): Promise<void> {
  const lines = recoverLines(report, savedAt);
  const box = el('div', 'pow-sheet pow-recover');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', S.recoverTitle);
  box.appendChild(el('h2', 'pow-sheet-title', S.recoverTitle));
  box.appendChild(el('p', 'pow-recover-body', lines.body));
  if (lines.reasons.length > 0) {
    const ul = el('ul', 'pow-recover-reasons');
    for (const r of lines.reasons) ul.appendChild(el('li', '', r));
    box.appendChild(ul);
  }
  const go = el('button', 'pow-button', S.recoverContinue);
  go.type = 'button';
  box.appendChild(go);
  root.appendChild(box);
  go.focus();
  return new Promise((resolve) => {
    go.addEventListener('click', () => {
      box.remove();
      resolve();
    });
  });
}

/** The message for a browser that cannot keep a save safely. Nothing else starts. */
export function showUnsupported(missing: readonly string[]): void {
  const box = el('div', 'pow-sheet pow-unsupported');
  box.setAttribute('role', 'alert');
  box.appendChild(el('h2', 'pow-sheet-title', S.unsupportedTitle));
  box.appendChild(el('p', 'pow-recover-body', S.unsupportedBody));
  box.appendChild(el('p', 'pow-recover-body', `${S.unsupportedMissing} ${missing.join(', ')}`));
  document.body.appendChild(box);
}
