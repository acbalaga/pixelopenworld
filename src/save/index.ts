export { AutoSaver, type SaveReason } from './autosave';
export { JsonCodec, sha256Hex } from './codec';
export { SaveManager, OLD_SNAPSHOT_MS, type LoadReport, type LoadResult } from './manager';
export { migrate, MIGRATIONS } from './migrations';
export { SecureCodec, type KeyProvider } from './secureCodec';
export { IdbKeyStore, MemoryKeyStore, loadDeviceKey, type KeyStore } from './deviceKey';
export { validateSave, intact, mergeTrust, type Trust, type ReasonCode } from './integrity';
export { checkSaveSupport, type SupportReport } from './support';
export { createStorage, IdbStorage, MemoryStorage } from './storage';
export { CURRENT_SCHEMA, type SavePlain, type SaveCodec, type SaveStorage } from './types';

/** A random 128-bit id as 32 hex characters. */
export function newSaveId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
