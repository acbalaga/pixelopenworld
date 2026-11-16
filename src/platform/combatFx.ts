import type { SimEvent } from '../sim/kernel/events';

/** Which sound effect an event makes, or null for silence. Ids are in content/audio/sfx. */
export function sfxFor(e: SimEvent, playerId: number): string | null {
  switch (e.type) {
    case 'damageDealt':
      return e.heavy || e.crit || e.bonus ? 'sfx.hit_heavy' : 'sfx.hit_light';
    case 'perfectDodge':
      return 'sfx.chime';
    case 'dodgeStarted':
      return 'sfx.step';
    case 'denied':
      return e.id === playerId ? 'sfx.error' : null;
    case 'echoRecovered':
      return 'sfx.pickup';
    case 'died':
      return 'sfx.hit_heavy';
    case 'staggerBreak':
      return 'sfx.ui_open';
    default:
      return null;
  }
}

/** Vibration pattern (ms) for an event, or null. Only things the player feels in their hands. */
export function hapticFor(e: SimEvent, playerId: number): number | number[] | null {
  switch (e.type) {
    case 'damageDealt':
      return e.dst === playerId ? 25 : e.heavy || e.crit ? 14 : 8;
    case 'perfectDodge':
      return [10, 30, 10];
    default:
      return null;
  }
}

/** Vibrates if the device and the setting allow it. Safe to call anywhere. */
export function vibrate(pattern: number | number[], enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function')
    return;
  navigator.vibrate(pattern);
}
