/**
 * Dev-only slice hooks for the Gate G1 playtest and the scripted e2e run: a control scheme toggle
 * on the HUD and a small read-only view of the run on `window.__pow`. Imported only behind
 * `import.meta.env.DEV`, so none of it reaches the production bundle (tools/check-dev-absent.ts).
 */

import './dev.css';
import type { ControlScheme, SettingsStore } from '../platform/settings';
import { spawnCreature } from '../sim/combat/enemy';
import { addItem, countItem } from '../sim/items';
import { madeItems } from '../sim/ledger';
import { getComp, type EntityId } from '../sim/kernel/entities';
import type { SimState } from '../sim/state';

/** What the hooks need from the running scene. */
export interface SliceHookContext {
  state: SimState;
  who: EntityId;
  settings: SettingsStore;
}

/** The view a test reads. Plain data, no live references. */
export interface PowSnapshot {
  scheme: ControlScheme;
  tick: number;
  requests: Record<string, { state: string; progress: number }>;
  coin: number;
  recipes: string[];
  held: Record<string, number>;
}

/** Test and playtest access. Dev builds only. */
export interface PowDevApi {
  snapshot(): PowSnapshot;
  /** Places a creature one tile from the avatar, in the direction it faces. */
  spawnFoeAhead(creatureId: string): void;
  /** Puts items in the bag, as if gathered. */
  giveItem(item: string, qty: number): void;
}

const TILE = 16;
// Sim facing is N, E, S, W as 0, 2, 4, 6.
const AHEAD: Record<number, [number, number]> = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };

/** Adds the scheme toggle button and `window.__pow`. */
export function installSliceHooks(ctx: SliceHookContext): void {
  const { state, who, settings } = ctx;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'pow-dev-scheme';
  const label = (): void => {
    button.textContent = `Scheme: ${settings.get().controlScheme}`;
  };
  label();
  button.addEventListener('click', () => {
    settings.set({ controlScheme: settings.get().controlScheme === 'flow' ? 'classic' : 'flow' });
  });
  settings.subscribe(label);
  document.body.appendChild(button);

  const api: PowDevApi = {
    snapshot() {
      const inv = getComp(state.entities, who, 'inventory');
      const j = getComp(state.entities, who, 'journal');
      const held: Record<string, number> = {};
      if (inv) for (const s of inv.slots) if (s) held[s.item] = countItem(inv, s.item);
      return {
        scheme: settings.get().controlScheme,
        tick: state.tick,
        requests: { ...(j?.requests ?? {}) },
        coin: getComp(state.entities, who, 'avatar')?.coin ?? 0,
        recipes: [...(inv?.recipes ?? [])],
        held,
      };
    },
    giveItem(item, qty) {
      const inv = getComp(state.entities, who, 'inventory');
      if (!inv) return;
      addItem(inv, item, qty);
      madeItems(state, 'seed', item, qty);
    },
    spawnFoeAhead(creatureId) {
      const pos = getComp(state.entities, who, 'pos');
      const facing = getComp(state.entities, who, 'avatar')?.facing ?? 4;
      if (!pos) return;
      const [dx, dy] = AHEAD[facing] ?? [0, 1];
      spawnCreature(
        state,
        creatureId,
        Math.round(pos.x / 256) + dx * TILE,
        Math.round(pos.y / 256) + dy * TILE,
      );
    },
  };
  (window as unknown as { __pow: PowDevApi }).__pow = api;
}
