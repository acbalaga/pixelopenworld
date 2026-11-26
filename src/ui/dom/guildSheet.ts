import { CREATURES } from '../../content/creatures';
import { ITEMS } from '../../content/items';
import { GUILD_STRINGS as GS } from '../../content/strings/guild';
import { ITEM_STRINGS } from '../../content/strings/items';
import { GUILDS } from '../../content/travelers/guilds';
import { currentGoals, hallOf } from '../../sim/guild';
import type { Command } from '../../sim/kernel/commands';
import type { ItemStack, SimState } from '../../sim/state';
import { detailSheet, el, put } from './parts';

const itemName = (id: string): string => {
  const def = ITEMS[id];
  return (def ? ITEM_STRINGS[def.nameKey] : undefined) ?? id;
};

/**
 * The guild hall sheet (POW-M5-08): opened at a hall post. For the player's own guild it shows the
 * week's goals with Give and Take the pay, the stash beside the bag, and Leave. For anyone else it
 * says whose hall it is and how that guild takes members. Text is set with `textContent` only.
 */
export class GuildSheet {
  private wrap: HTMLElement | null = null;
  private hall = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: {
      read: () => { state: SimState; who: number };
      send: (c: Command) => void;
      onOpenChange: (open: boolean) => void;
    },
  ) {}

  get isOpen(): boolean {
    return this.wrap !== null;
  }

  open(hall: number): void {
    this.close();
    this.hall = hall;
    this.build();
    this.opts.onOpenChange(true);
  }

  refresh(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.build();
  }

  private act(c: Command): void {
    this.opts.send(c);
    window.setTimeout(() => this.refresh(), 150);
  }

  private button(label: string, c: Command, disabled = false): HTMLButtonElement {
    const b = el('button', 'pow-button pow-guild-btn', label);
    b.type = 'button';
    b.disabled = disabled;
    b.addEventListener('click', () => this.act(c));
    return b;
  }

  private stacks(slots: readonly (ItemStack | null)[], dir: 'in' | 'out'): HTMLElement {
    const ul = el('ul', 'pow-guild-stacks');
    slots.forEach((st, i) => {
      if (!st) return;
      const li = el('li', 'pow-guild-row');
      put(
        li,
        el(
          'span',
          'pow-guild-text',
          st.qty > 1 ? `${itemName(st.item)} x${st.qty}` : itemName(st.item),
        ),
        this.button(dir === 'in' ? GS.put : GS.take, { type: 'guild', op: 'stash', dir, slot: i }),
      );
      ul.appendChild(li);
    });
    return ul;
  }

  private build(): void {
    const { state, who } = this.opts.read();
    const mine = state.guild.id;
    const hallGuild = this.hall === 0 ? null : GUILDS.find((g) => g.id === this.hall);
    const title = hallGuild ? GS.hallOf.replace('{guild}', hallGuild.name) : GS.backRoom;
    const extra: HTMLElement[] = [];
    const member = mine !== 0 && hallOf(mine) === this.hall;
    if (!hallGuild) extra.push(el('p', 'pow-part-sheet-desc', GS.backRoomDesc));
    if (!member) {
      if (hallGuild) {
        extra.push(el('p', 'pow-part-sheet-desc', hallGuild.culture));
        extra.push(el('p', 'pow-part-sheet-desc', GS.joinsBy.replace('{rule}', hallGuild.joinsBy)));
      }
      extra.push(el('p', 'pow-part-sheet-desc', mine === 0 ? GS.noGuild : GS.wrongHall));
    } else {
      const g = GUILDS.find((x) => x.id === mine)!;
      const online = state.travelers.filter(
        (l, slot) => l.guild === mine && state.crowd?.online[slot] === 1,
      ).length;
      extra.push(el('p', 'pow-part-sheet-desc', `${g.name}. ${g.culture}`));
      extra.push(el('p', 'pow-part-sheet-desc', GS.members.replace('{n}', String(online))));
      extra.push(el('h4', 'pow-guild-head', GS.goals));
      const goals = el('ul', 'pow-guild-goals');
      currentGoals(state).forEach((x, i) => {
        const li = el('li', 'pow-guild-row');
        const text =
          x.def.kind === 'give'
            ? GS.goalGive
                .replace('{qty}', String(x.def.qty))
                .replace('{item}', itemName(x.def.thing))
            : GS.goalClear
                .replace('{qty}', String(x.def.qty))
                .replace('{creature}', CREATURES[x.def.thing]?.name ?? x.def.thing);
        const info = el('div', 'pow-guild-text');
        put(
          info,
          el('span', 'pow-guild-goal', text),
          el(
            'span',
            'pow-guild-meta',
            `${GS.progress.replace('{n}', String(Math.min(x.progress, x.def.qty))).replace('{qty}', String(x.def.qty))}. ${GS.pay.replace('{coin}', String(x.def.coin))}`,
          ),
        );
        let b: HTMLElement;
        if (x.paid) b = el('span', 'pow-guild-meta', GS.paid);
        else if (x.progress >= x.def.qty)
          b = this.button(GS.claim, { type: 'guild', op: 'claim', goal: i });
        else if (x.def.kind === 'give')
          b = this.button(GS.give, { type: 'guild', op: 'give', goal: i });
        else b = el('span', 'pow-guild-meta', '');
        put(li, info, b);
        goals.appendChild(li);
      });
      extra.push(goals);
      extra.push(el('h4', 'pow-guild-head', GS.stash));
      const stash = state.guild.stashes[String(mine)] ?? [];
      extra.push(
        stash.some((x) => x) ? this.stacks(stash, 'out') : el('p', 'pow-empty', GS.stashEmpty),
      );
      extra.push(el('h4', 'pow-guild-head', GS.bag));
      const inv = state.entities.comps.inventory[who];
      if (inv) extra.push(this.stacks(inv.slots, 'in'));
      extra.push(this.button(GS.leave, { type: 'guild', op: 'leave' }));
    }
    const sheet = detailSheet({ title, extra, onClose: () => this.close() });
    const wrap = el('div', 'pow-guild');
    put(wrap, sheet.el);
    this.root.appendChild(wrap);
    this.wrap = wrap;
    sheet.title.focus();
  }

  close(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.opts.onOpenChange(false);
  }
}
