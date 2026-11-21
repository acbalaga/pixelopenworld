import { TECHNIQUES } from '../../content/combat/techniques';
import { BOSSES } from '../../content/creatures/bosses';
import { CALLOUT_STRINGS } from '../../content/strings/callouts';
import { TECHNIQUE_STRINGS } from '../../content/strings/techniques';
import type { SimEvent } from '../../sim/kernel/events';
import type { SimState } from '../../sim/state';

/** Boss callouts by the creature kind each boss fights as. */
const BY_CREATURE: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map(
  Object.values(BOSSES).flatMap((b) => (b.callouts ? [[b.creature, b.callouts] as const] : [])),
);

/**
 * What to shout over someone's head for one sim event (G4 playtest), or null: the avatar's own
 * technique names, and a boss's signature moves. Read-only, so it can sit on the render side.
 */
export function calloutFor(
  state: SimState,
  avatar: number,
  e: SimEvent,
): { id: number; text: string; boss: boolean } | null {
  if (e.type === 'techniqueUsed') {
    if (e.who !== avatar) return null;
    const t = TECHNIQUES[e.technique];
    const text = t ? TECHNIQUE_STRINGS[t.nameKey] : undefined;
    return text ? { id: e.who, text, boss: false } : null;
  }
  if (e.type === 'attackStarted') {
    const kind = state.entities.comps.combatant[e.id]?.kind;
    const key = kind ? BY_CREATURE.get(kind)?.[e.attack] : undefined;
    const text = key ? CALLOUT_STRINGS[key] : undefined;
    return text ? { id: e.id, text, boss: true } : null;
  }
  return null;
}
