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

/** The source from the build variable's JSON. */
function envSource(raw: string): SealSource {
  const parsed = JSON.parse(raw) as { current: number; versions: Record<string, string[]> };
  return {
    current: parsed.current,
    fragments: async (v) => {
      const list = parsed.versions[String(v)];
      return list ? list.map(hex) : null;
    },
  };
}

const committedSource: SealSource = {
  current: CURRENT_SEAL_VERSION,
  fragments: async (v) => (SEAL_VERSIONS.includes(v) ? loadCommitted(v) : null),
};

/**
 * The game's source: the committed modules, or the build variable when the build set one. The
 * test is against a build-time constant, so with the variable set the committed branch is dead
 * code and the committed modules are not in the bundle at all.
 */
export const defaultSealSource: SealSource =
  __SEAL_ENV__ !== '' ? envSource(__SEAL_ENV__) : committedSource;

/**
 * Loads every version's material now, so an import still works with the network gone. The
 * committed modules are lazy chunks; this fetches them while the page is online. Never throws.
 */
export async function warmSealMaterial(): Promise<void> {
  if (__SEAL_ENV__ !== '') return;
  try {
    for (const v of SEAL_VERSIONS) await loadCommitted(v);
  } catch {
    // A failed warm-up only means the first import loads the chunk itself.
  }
}
