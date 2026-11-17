import { UI_STRINGS } from '../../content/strings/ui';
import {
  applyUpdate,
  checkForUpdate,
  onInstallChange,
  onUpdateChange,
  updateReady,
  updateSupported,
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
export function createDeviceSection(
  deps: { beforeUpdate?: (() => Promise<void>) | undefined } = {},
): HTMLElement {
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

  const update = el('p', 'pow-hint');
  update.dataset.key = 'update-state';
  const check = el('button', 'pow-button', S.update.checkButton);
  check.type = 'button';
  check.dataset.key = 'update-check';
  const apply = el('button', 'pow-button', S.update.applyButton);
  apply.type = 'button';
  apply.dataset.key = 'update-apply';
  const showUpdate = (): void => {
    const ready = updateReady();
    update.textContent = ready
      ? S.update.ready
      : updateSupported()
        ? S.update.none
        : S.update.unsupported;
    update.dataset.state = ready ? 'ready' : updateSupported() ? 'none' : 'unsupported';
    apply.hidden = !ready;
    check.hidden = ready || !updateSupported();
  };
  showUpdate();
  check.addEventListener('click', () => {
    update.textContent = S.update.checking;
    check.disabled = true;
    void checkForUpdate().then(() => {
      check.disabled = false;
      showUpdate();
    });
  });
  apply.addEventListener('click', () => {
    apply.disabled = true;
    update.textContent = S.update.saving;
    // Save first, so nothing is lost to the restart. A failed save still lets the update go on:
    // the game also saves on every hide and on a timer.
    void (deps.beforeUpdate?.() ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => applyUpdate());
  });
  const offUpdate = onUpdateChange(showUpdate);

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
      offUpdate();
      watcher.disconnect();
    }
  });
  watcher.observe(document.body, { childList: true, subtree: true });

  for (const k of [storage, protect, update, check, apply, install, installBtn]) box.appendChild(k);
  return box;
}
