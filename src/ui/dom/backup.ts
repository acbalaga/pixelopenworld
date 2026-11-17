import { UI_STRINGS } from '../../content/strings/ui';
import { ImportError, type ImportPlan } from '../../save/exportImport';
import { MAX_FILE_BYTES } from '../../save/powsave';
import { createSeal } from './seal';

const S = UI_STRINGS.backup;

/** What the backup UI needs from the game. It never touches storage or the sim itself. */
export interface BackupDeps {
  /** Writes the current save and returns the sealed file and its name. */
  exportCurrent: () => Promise<{ bytes: Uint8Array; fileName: string }>;
  /** Opens file bytes into what the player is asked to confirm. Throws {@link ImportError}. */
  planImport: (bytes: Uint8Array) => Promise<ImportPlan>;
  /** Makes a confirmed import the current save. */
  applyImport: (plan: ImportPlan) => Promise<void>;
  /** Whether this device holds a save an import would replace. */
  hasSave: () => boolean;
  /** Called after an import has been applied. */
  onImported: () => void;
  /** Called after an export has been written, for the reminder. */
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

/** The sentence for a failed import or export. */
export function errorText(e: unknown): string {
  if (e instanceof ImportError) return S.errors[e.code as keyof typeof S.errors] ?? S.errors.failed;
  return S.errors.failed;
}

/** Hands bytes to the browser as a download, through an object URL. */
export function download(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: 'application/octet-stream' }),
  );
  const a = el('a');
  a.href = url;
  a.download = fileName;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

function fmtPlayed(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/**
 * Asks the player to confirm an import: who, how long, when, the seal, and what it replaces.
 * Resolves true only on Import. Escape and Cancel resolve false and nothing has changed.
 */
export function confirmImport(
  root: HTMLElement,
  plan: ImportPlan,
  replacing: boolean,
): Promise<boolean> {
  const box = el('div', 'pow-sheet pow-import');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', S.importTitle);
  const rows = el('dl', 'pow-import-rows');
  const row = (k: string, v: string): void => {
    put(rows, el('dt', undefined, k), el('dd', undefined, v));
  };
  row(S.character, plan.handle);
  row(S.played, fmtPlayed(plan.playSeconds));
  row(S.savedOn, fmtDate(plan.savedAt));
  put(box, el('h2', 'pow-sheet-title', S.importTitle), rows);
  put(box, el('p', 'pow-import-seal-label', S.sealLine), createSeal(plan.trust));
  put(box, el('p', 'pow-recover-body', replacing ? S.replaces : S.noneHere));
  const ok = el('button', 'pow-button', S.confirm);
  ok.type = 'button';
  const no = el('button', 'pow-button', S.cancel);
  no.type = 'button';
  put(box, put(el('div', 'pow-import-buttons'), no, ok));
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
    ok.addEventListener('click', () => end(true));
    no.addEventListener('click', () => end(false));
  });
}

/** What an import needs. The title screen has no export, so it uses only this. */
export type ImportDeps = Pick<BackupDeps, 'planImport' | 'applyImport' | 'hasSave' | 'onImported'>;

/**
 * The import flow: pick a file, open it, confirm, apply. `status` shows progress and errors.
 * The file picker must start from a tap, so call this from a click handler.
 */
export function startImport(
  root: HTMLElement,
  deps: ImportDeps,
  status: (text: string) => void,
): void {
  const input = el('input');
  input.type = 'file';
  input.accept = '.powsave,application/octet-stream';
  input.hidden = true;
  document.body.appendChild(input);
  const cleanup = (): void => {
    input.remove();
  };
  input.addEventListener('cancel', cleanup);
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    cleanup();
    if (!file) return;
    void (async () => {
      try {
        if (file.size > MAX_FILE_BYTES) throw new ImportError('too_large', 'file is over 4 MB');
        status(S.working);
        const plan = await deps.planImport(new Uint8Array(await file.arrayBuffer()));
        status('');
        if (!(await confirmImport(root, plan, deps.hasSave()))) return;
        status(S.working);
        await deps.applyImport(plan);
        status(S.imported);
        deps.onImported();
      } catch (e) {
        status(errorText(e));
      }
    })();
  });
  input.click();
}

/** Runs an export: seal, download, report. */
export async function runExport(deps: BackupDeps, status: (text: string) => void): Promise<void> {
  try {
    status(S.working);
    const file = await deps.exportCurrent();
    download(file.bytes, file.fileName);
    deps.onExported?.();
    status(S.exported);
  } catch (e) {
    status(errorText(e));
  }
}

/** The Backup block for System: export, import, and a line for progress and errors. */
export function createBackupSection(root: HTMLElement, deps: BackupDeps): HTMLElement {
  const wrap = el('div', 'pow-backup');
  const msg = el('p', 'pow-backup-status');
  msg.setAttribute('role', 'status');
  const status = (t: string): void => {
    msg.textContent = t;
    wrap.setAttribute('aria-busy', String(t === S.working));
  };
  const exp = el('button', 'pow-button', S.export);
  exp.type = 'button';
  exp.addEventListener('click', () => void runExport(deps, status));
  const imp = el('button', 'pow-button', S.import);
  imp.type = 'button';
  imp.addEventListener('click', () => startImport(root, deps, status));
  put(wrap, exp, el('p', 'pow-hint', S.exportNote), imp, el('p', 'pow-hint', S.importNote), msg);
  return wrap;
}

/** The reminder banner. Dismissible; `onExport` runs the export and `onDismiss` is remembered. */
export function showReminder(
  root: HTMLElement,
  onExport: () => Promise<void>,
  onDismiss: () => void,
): void {
  const box = el('div', 'pow-reminder');
  box.setAttribute('role', 'status');
  const text = el('p', undefined, S.reminder);
  const now = el('button', 'pow-button', S.reminderNow);
  now.type = 'button';
  const later = el('button', 'pow-button', S.reminderDismiss);
  later.type = 'button';
  put(box, text, put(el('div', 'pow-import-buttons'), later, now));
  now.addEventListener('click', () => {
    box.remove();
    void onExport();
  });
  later.addEventListener('click', () => {
    box.remove();
    onDismiss();
  });
  root.appendChild(box);
}
