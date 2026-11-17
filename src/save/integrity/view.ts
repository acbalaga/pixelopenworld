import { getComp, query, type EntityId } from '../../sim/kernel/entities';
import type { Ledger } from '../../sim/ledger';
import {
  deserializeState,
  type Avatar,
  type Inventory,
  type Journal,
  type Pools,
  type SimState,
  type Skills,
} from '../../sim/state';
import type { SavePlain } from '../types';

/** A save opened for checking: the plain record, its sim rebuilt, and the avatar's parts. */
export interface View {
  plain: SavePlain;
  sim: SimState;
  who: EntityId;
  avatar: Avatar;
  inv: Inventory;
  skills: Skills;
  pools: Pools;
  journal: Journal;
  ledger: Ledger;
}

/** Rebuilds the sim and finds the avatar. Throws with a plain message if the save is not shaped right. */
export function buildView(plain: SavePlain): View {
  const sim = deserializeState(plain.sim);
  const avatars = query(sim.entities, 'avatar');
  if (avatars.length !== 1) throw new Error(`AVATAR_COUNT ${avatars.length}`);
  const who = avatars[0] as EntityId;
  const avatar = getComp(sim.entities, who, 'avatar');
  const inv = getComp(sim.entities, who, 'inventory');
  const skills = getComp(sim.entities, who, 'skills');
  const pools = getComp(sim.entities, who, 'pools');
  const journal = getComp(sim.entities, who, 'journal');
  if (!avatar || !inv || !skills || !pools || !journal) throw new Error('avatar parts missing');
  return { plain, sim, who, avatar, inv, skills, pools, journal, ledger: sim.ledger };
}
