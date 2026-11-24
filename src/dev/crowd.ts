/**
 * Dev overlay text for the crowd (POW-M5-03): the online count, then each online Traveler with
 * what it is doing and where. Imported only behind `import.meta.env.DEV`, so it never reaches the
 * production bundle (tools/check-dev-absent.ts enforces that).
 */
import { ACTIVITIES } from '../content/travelers/types';
import type { SimState } from '../sim/state';
import { onlineCount } from '../sim/travelers/crowd';
import { identitiesOf } from '../sim/travelers/generate';
import { PLACE_LIST } from '../sim/travelers/lists';

/** At most `limit` online Travelers, one per line. */
export function crowdLines(state: SimState, limit = 12): string {
  const crowd = state.crowd;
  if (!crowd) return 'crowd: asleep (no clock)';
  const ids = identitiesOf(state.seed);
  const lines: string[] = [`crowd: ${onlineCount(crowd)} online`];
  let shown = 0;
  for (const t of ids) {
    if (!crowd.online[t.slot]) continue;
    if (shown++ >= limit) {
      lines.push('...');
      break;
    }
    const life = state.travelers[t.slot]!;
    const act = ACTIVITIES[life.activity] ?? '?';
    const place = (PLACE_LIST[life.place] ?? '?').replace('hearthford.', 'h.');
    lines.push(`${t.handle} ${act} ${place}${crowd.promoted[t.slot] ? ' [entity]' : ''}`);
  }
  return lines.join('\n');
}
