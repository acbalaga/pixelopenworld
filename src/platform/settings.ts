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
  handedness: Handedness;
  reducedMotion: boolean;
  /** Flow plays on its own swings; Classic has an attack button and a three hit combo. */
  controlScheme: ControlScheme;
  /** Haptic ticks on hit and perfect dodge, where the device supports them. */
  haptics: boolean;
}

export const TEXT_SCALE_RANGE = [0.8, 1.6] as const;
export const HUD_SCALE_RANGE = [0.8, 1.5] as const;

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
      handedness: 'right',
      reducedMotion: env.prefersReducedMotion(),
      controlScheme: 'flow',
      haptics: true,
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
    if (
      next.textScale === this.value.textScale &&
      next.hudScale === this.value.hudScale &&
      next.handedness === this.value.handedness &&
      next.reducedMotion === this.value.reducedMotion &&
      next.controlScheme === this.value.controlScheme &&
      next.haptics === this.value.haptics
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
