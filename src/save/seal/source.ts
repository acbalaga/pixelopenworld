import { CURRENT_SEAL_VERSION, SEAL_VERSIONS, loadCommitted } from './registry';

declare const __SEAL_ENV__: string;

/** Where the seal fragments come from. Tests inject their own. */
export interface SealSource {
  /** The version new exports are sealed with. */
  current: number;
  /** Fragments of one version, or null if there is no such version. */
  fragments(version: number): Promise<readonly Uint8Array[] | null>;
}

const hex = (s: string): Uint8Array =>
  Uint8Array.from(s.match(/../g) ?? [], (b) => Number.parseInt(b, 16));

/** The source from a build variable, parsed once. Null when the build did not set one. */
function fromEnv(): SealSource | null {
  const raw = typeof __SEAL_ENV__ === 'string' ? __SEAL_ENV__ : '';
  if (raw === '') return null;
  const parsed = JSON.parse(raw) as { current: number; versions: Record<string, string[]> };
  return {
    current: parsed.current,
    fragments: async (v) => {
      const list = parsed.versions[String(v)];
      return list ? list.map(hex) : null;
    },
  };
}

/**
 * The game's source: the committed modules, or the build variable when the build set one. With
 * the variable set the committed modules are not imported at all, so they are not in the bundle.
 */
export const defaultSealSource: SealSource = fromEnv() ?? {
  current: CURRENT_SEAL_VERSION,
  fragments: async (v) => (SEAL_VERSIONS.includes(v) ? loadCommitted(v) : null),
};
