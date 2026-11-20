/**
 * What the player sees of the Bestiary (POW-M4-05). An entry opens on a first kill (the ledger
 * counts them) or a first friend. It names the temperaments the avatar has actually seen the kind
 * act on, and nothing the avatar has not witnessed.
 */
import { CREATURES } from '../../content/creatures';
import { fill } from '../../content/strings/skills';
import { UI_STRINGS } from '../../content/strings/ui';
import { getComp, type EntityId } from '../../sim/kernel/entities';
import type { SimState } from '../../sim/state';

export interface BestiaryRowView {
  id: string;
  name: string;
  kills: string;
  befriended: boolean;
  /** "Seen to be: Territorial", or that it has not been seen yet. */
  temperament: string;
}

export interface BestiaryView {
  rows: BestiaryRowView[];
  /** "5 of 21 creatures known". */
  count: string;
}

const S = UI_STRINGS.bestiary;

/** The entries the avatar has opened, in the order the content lists the creatures. */
export function bestiaryView(state: SimState, who: EntityId): BestiaryView {
  const j = getComp(state.entities, who, 'journal');
  const ids = Object.keys(CREATURES).filter((id) => CREATURES[id]?.archetype !== 'dummy');
  const known = (id: string): boolean =>
    (state.ledger.kills[id] ?? 0) > 0 || j?.bestiary?.[id]?.befriended === true;
  const rows = ids.filter(known).map((id): BestiaryRowView => {
    const def = CREATURES[id]!;
    const entry = j?.bestiary?.[id];
    const seen = (entry?.temperaments ?? [])
      .map((t) => (S.temperament as Record<string, string | undefined>)[t])
      .filter((t): t is string => t !== undefined);
    return {
      id,
      name: def.name,
      kills: fill(S.kills, { n: state.ledger.kills[id] ?? 0 }),
      befriended: entry?.befriended === true,
      temperament: seen.length > 0 ? fill(S.seen, { list: seen.join(', ') }) : S.notSeen,
    };
  });
  return { rows, count: fill(S.count, { n: rows.length, total: ids.length }) };
}
