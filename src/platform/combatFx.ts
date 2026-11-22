import type { SimEvent } from '../sim/kernel/events';

/** The warning sound at the start of each creature attack, which is the start of its telegraph. */
const CREATURE_ATTACK_SFX: Readonly<Record<string, string>> = {
  'attack.creature_swipe': 'sfx.creature_growl',
  'attack.boar_gore': 'sfx.creature_growl',
  'attack.boar_charge': 'sfx.charge',
  'attack.boss_gore': 'sfx.creature_growl',
  'attack.boss_charge': 'sfx.charge',
  'attack.boss_slam': 'sfx.slam',
  'attack.spitbloom_seed': 'sfx.creature_growl',
  'attack.hawk_dive': 'sfx.charge',
  'attack.ram_butt': 'sfx.creature_growl',
  'attack.rock_slam': 'sfx.slam',
  'attack.wisp_spark': 'sfx.spit',
  ...Object.fromEntries(
    [
      'nip',
      'peck',
      'sting',
      'bite',
      'pinch',
      'bone_slash',
      'straw_flail',
      'mole_claw',
      'thorn_jab',
      'leech_latch',
    ].map((n) => [`attack.${n}`, 'sfx.creature_growl']),
  ),
};

/** Which sound effect an event makes, or null for silence. Ids are in content/audio/sfx. */
export function sfxFor(
  e: SimEvent,
  playerId: number,
  /** The creature behind an entity id, so each kind has its own voice (M4-05). */
  voiceOf?: (id: number) => { notice: string; die: string } | undefined,
): string | null {
  switch (e.type) {
    case 'attackStarted':
      return CREATURE_ATTACK_SFX[e.attack] ?? null;
    case 'noticed':
      return voiceOf?.(e.id)?.notice ?? 'sfx.creature_notice';
    case 'creatureWarn':
      return 'sfx.creature_warn';
    case 'projectileLaunched':
      return e.owner === playerId ? null : 'sfx.spit';
    case 'damageDealt':
      return e.heavy || e.crit || e.bonus ? 'sfx.hit_heavy' : 'sfx.hit_light';
    case 'gatherSwing':
    case 'gatherResolved':
      return e.id === playerId && e.sweet ? 'sfx.hit_light' : null;
    case 'craftTap':
      return e.id === playerId ? 'sfx.hit_light' : null;
    case 'perfectDodge':
    case 'parried':
      return 'sfx.chime';
    case 'dodgeStarted':
      return 'sfx.step';
    case 'denied':
      return e.id === playerId ? 'sfx.error' : null;
    case 'echoRecovered':
      return 'sfx.pickup';
    case 'died':
      return e.team === 1 ? (voiceOf?.(e.id)?.die ?? 'sfx.creature_die') : 'sfx.hit_heavy';
    case 'staggerBreak':
      return 'sfx.ui_open';
    case 'doorOpened':
    case 'gateOpened':
      return 'sfx.slam';
    case 'doorLocked':
      return 'sfx.error';
    case 'chestOpened':
      return 'sfx.pickup';
    case 'blockPushed':
      return 'sfx.step';
    case 'roomReset':
      return e.count > 0 ? 'sfx.slam' : 'sfx.ui_open';
    case 'waystoneSet':
    case 'traveled':
      return 'sfx.chime';
    case 'pathEarned':
      return e.who === playerId ? 'sfx.chime' : null;
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
