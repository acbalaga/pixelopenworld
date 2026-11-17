import { UI_STRINGS } from '../../content/strings/ui';
import {
  onInstallChange,
  installHint,
  persistenceState,
  promptInstall,
  requestPersistence,
  type Persistence,
} from '../../platform/pwa';

const S = UI_STRINGS.device;

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

/** System > This device: whether storage is protected from being cleared, and how to install. */
export function createDeviceSection(): HTMLElement {
  const box = el('div', 'pow-device');

  const storage = el('p', 'pow-hint');
  storage.dataset.key = 'storage-state';
  const protect = el('button', 'pow-button', S.protect);
  protect.type = 'button';
  protect.hidden = true;
  const showStorage = (p: Persistence): void => {
    storage.textContent = S.storage[p];
    storage.dataset.state = p;
    protect.hidden = p !== 'denied';
  };
  void persistenceState().then(showStorage);
  protect.addEventListener('click', () => {
    storage.textContent = S.asking;
    void requestPersistence().then(showStorage);
  });

  const install = el('p', 'pow-hint');
  install.dataset.key = 'install-hint';
  const installBtn = el('button', 'pow-button', S.installButton);
  installBtn.type = 'button';
  const showInstall = (): void => {
    const h = installHint();
    install.textContent = S.install[h];
    installBtn.hidden = h !== 'prompt';
  };
  showInstall();
  installBtn.addEventListener('click', () => void promptInstall());
  const off = onInstallChange(showInstall);
  // The System tab is rebuilt when opened, so stop listening once this section leaves the page.
  const watcher = new MutationObserver(() => {
    if (!box.isConnected) {
      off();
      watcher.disconnect();
    }
  });
  watcher.observe(document.body, { childList: true, subtree: true });

  for (const k of [storage, protect, install, installBtn]) box.appendChild(k);
  return box;
}
