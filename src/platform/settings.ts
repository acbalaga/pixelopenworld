/**
 * Player settings. Not part of the save (tech/01: settings and UI preferences live outside it).
 * A plain observable store with clamping. Persistence to IndexedDB comes with the save work.
 */

export type Handedness = 'right' | 'left';
export type ControlScheme = 'flow' | 'classic';

export interface Settings {
  /** Clear text scale, 0.8 to 1.6. */
  textScale: number;
  /** HUD and control scale, 0.8 to 1.5. */
  hudScale: number;
  /** Size of the on-screen buttons on their own, 0.8 to 1.5. Never below the touch minimum. */
  buttonScale: number;
  /** Opacity of the on-screen controls and HUD, 0.3 to 1. */
  hudOpacity: number;
  handedness: Handedness;
  reducedMotion: boolean;
  /** Flow plays on its own swings; Classic has an attack button and a three hit combo. */
  controlScheme: ControlScheme;
  /** Haptic ticks on hit and perfect dodge, where the device supports them. */
  haptics: boolean;
  /** Silences all audio (master bus). The volumes themselves are kept. */
  muted: boolean;
  /** Touch guard: a tap raises it and the next tap lowers it. Off holds it while the finger is down. */
  guardToggle: boolean;
  /** The chat lane is folded to its unread glyph (M4-17). A UI setting, outside the save. */
  chatCollapsed: boolean;
  /** The chat sheet's last tab. */
  chatTab: string;
  /** The Menu reopens on this tab and scroll position (M4-18). UI settings, outside the save. */
  menuTab: string;
  menuScroll: number;
  /** Ids of Menu sections the player folded. Everything else is open. */
  closedSections: string[];
  /** Show the minimap, top right (M4-06). A UI setting, outside the save. */
  minimap: boolean;
  /** Download the region being played in the background, so it plays offline (M4-03). */
  prefetchRegions: boolean;
  /** Regions the player keeps for offline play. They are fetched whole and stay cached. */
  pinnedRegions: string[];
}

export const TEXT_SCALE_RANGE = [0.8, 1.6] as const;
export const HUD_SCALE_RANGE = [0.8, 1.5] as const;
export const BUTTON_SCALE_RANGE = [0.8, 1.5] as const;
export const HUD_OPACITY_RANGE = [0.3, 1] as const;

const clamp = (v: number, [lo, hi]: readonly [number, number]): number =>
  Math.min(hi, Math.max(lo, v));

/** What the store needs from the platform. */
export interface SettingsEnv {
  prefersReducedMotion: () => boolean;
}

/** The observable store. */
export class SettingsStore {
  private value: Settings;
  private listeners = new Set<(s: Readonly<Settings>) => void>();

  constructor(env: SettingsEnv) {
    this.value = {
      textScale: 1,
      hudScale: 1,
      buttonScale: 1,
      hudOpacity: 1,
      handedness: 'right',
      reducedMotion: env.prefersReducedMotion(),
      controlScheme: 'flow',
      haptics: true,
      muted: false,
      guardToggle: true,
      chatCollapsed: false,
      chatTab: 'world',
      menuTab: 'character',
      menuScroll: 0,
      closedSections: [],
      minimap: true,
      prefetchRegions: true,
      pinnedRegions: [],
    };
  }

  get(): Readonly<Settings> {
    return this.value;
  }

  /** Applies a change, clamping scales, and notifies listeners if anything changed. */
  set(patch: Partial<Settings>): void {
    const next: Settings = { ...this.value, ...patch };
    next.textScale = clamp(next.textScale, TEXT_SCALE_RANGE);
    next.hudScale = clamp(next.hudScale, HUD_SCALE_RANGE);
    next.buttonScale = clamp(next.buttonScale, BUTTON_SCALE_RANGE);
    next.hudOpacity = clamp(next.hudOpacity, HUD_OPACITY_RANGE);
    if (
      next.textScale === this.value.textScale &&
      next.hudScale === this.value.hudScale &&
      next.buttonScale === this.value.buttonScale &&
      next.hudOpacity === this.value.hudOpacity &&
      next.handedness === this.value.handedness &&
      next.reducedMotion === this.value.reducedMotion &&
      next.controlScheme === this.value.controlScheme &&
      next.haptics === this.value.haptics &&
      next.muted === this.value.muted &&
      next.guardToggle === this.value.guardToggle &&
      next.chatCollapsed === this.value.chatCollapsed &&
      next.chatTab === this.value.chatTab &&
      next.menuTab === this.value.menuTab &&
      next.menuScroll === this.value.menuScroll &&
      next.minimap === this.value.minimap &&
      next.prefetchRegions === this.value.prefetchRegions &&
      next.pinnedRegions.length === this.value.pinnedRegions.length &&
      next.pinnedRegions.every((x, i) => x === this.value.pinnedRegions[i]) &&
      next.closedSections.length === this.value.closedSections.length &&
      next.closedSections.every((x, i) => x === this.value.closedSections[i])
    )
      return;
    this.value = next;
    for (const l of this.listeners) l(next);
  }

  subscribe(fn: (s: Readonly<Settings>) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/** The browser environment. */
export function browserSettingsEnv(): SettingsEnv {
  return {
    prefersReducedMotion: () =>
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}
