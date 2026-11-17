/**
 * The installable, offline side of the game (M2-05): service worker registration, the update
 * note, the storage persistence request, and what the System screen needs to explain installing.
 * Everything here is optional. A browser without a piece of it just plays.
 */

const VERSION_KEY = 'pow.version';
const PERSIST_KEY = 'pow.persistAsked';

/** Registers the worker in production builds. A failure changes nothing: the game plays online. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const go = (): void => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

/**
 * True once when this launch runs a different build than the last one the player saw. A new
 * version installs in the background and starts on the next launch, so this is where the player
 * learns it changed. Storage that is blocked reads as no change.
 */
export function takeUpdateNote(buildId: string): boolean {
  try {
    const before = localStorage.getItem(VERSION_KEY);
    localStorage.setItem(VERSION_KEY, buildId);
    return before !== null && before !== buildId;
  } catch {
    return false;
  }
}

export type Persistence = 'granted' | 'denied' | 'unsupported';

/** Whether this origin's storage is already protected from eviction. */
export async function persistenceState(): Promise<Persistence> {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** True if the request has been made on this device before. It is made once. */
export function persistenceAsked(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) !== null;
  } catch {
    return true;
  }
}

/** Asks the browser to keep this origin's storage, and remembers that we asked. */
export async function requestPersistence(): Promise<Persistence> {
  try {
    localStorage.setItem(PERSIST_KEY, '1');
  } catch {
    // Ask anyway.
  }
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** The moments to ask (tech/01): after the first Trial, or after this many seconds of play. */
export const PERSIST_AFTER_SECONDS = 15 * 60;

interface InstallEvent extends Event {
  prompt(): Promise<unknown>;
}
let deferred: InstallEvent | null = null;
const installListeners = new Set<() => void>();

/** Keeps the browser's install prompt for the System screen's button, where the browser offers one. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    installListeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installListeners.forEach((f) => f());
  });
}

export type InstallHint = 'installed' | 'prompt' | 'ios' | 'other';

/** What to tell the player about installing, for this browser. iOS has no prompt API. */
export function installHint(): InstallHint {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  if (deferred) return 'prompt';
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'other';
}

/** Shows the browser's install dialog, if it gave us one. */
export async function promptInstall(): Promise<void> {
  const d = deferred;
  if (!d) return;
  deferred = null;
  await d.prompt();
  installListeners.forEach((f) => f());
}

/** Calls `f` when the install state may have changed. Returns an unsubscribe. */
export function onInstallChange(f: () => void): () => void {
  installListeners.add(f);
  return () => installListeners.delete(f);
}
