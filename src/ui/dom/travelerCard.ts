import { GUILDS } from '../../content/travelers/guilds';
import { SKILLS } from '../../content/skills';
import { FRIEND_STRINGS as F } from '../../content/strings/friends';
import { UI_STRINGS as S } from '../../content/strings/ui';
import type { ProfileCard } from '../../sim/travelers/entities';
import type { SimState } from '../../sim/state';
import { memoryLine } from '../menu/friendsModel';
import { detailSheet, el, put } from './parts';

/**
 * A Traveler's profile card (POW-M5-04): the doll, the handle, the title, the guild, the three
 * skills they are best at as rank bands (never exact points), and whether the player has met them.
 * Built on the shared Menu parts (POW-M4-18) and shown over the world as a sheet. Shared history
 * arrives with POW-M5-06. Text is set with `textContent` only.
 */
export class TravelerCard {
  private wrap: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: {
      /** Paints the Traveler's doll (24 x 32) into the canvas. */
      drawDoll: (canvas: HTMLCanvasElement, slot: number) => void;
      onOpenChange: (open: boolean) => void;
      /** Sends a friend action for the Traveler on the card (M5-06). */
      onFriend: (slot: number, op: 'request' | 'accept' | 'decline' | 'remove') => void;
      /** Pokes a sleeping Traveler awake (M5-31). */
      onPoke: (slot: number) => void;
      /** Challenges the Traveler to a duel (M5-12). */
      onDuel: (slot: number) => void;
    },
  ) {}

  get isOpen(): boolean {
    return this.wrap !== null;
  }

  open(card: ProfileCard, state?: SimState): void {
    this.close();
    const L = S.travelerCard;
    const icon = document.createElement('canvas');
    icon.width = 24;
    icon.height = 32;
    icon.className = 'pow-traveler-doll';
    icon.setAttribute('aria-hidden', 'true');
    this.opts.drawDoll(icon, card.slot);
    const guild = GUILDS.find((g) => g.id === card.guild);
    const desc = [card.title, guild ? L.guild.replace('{guild}', guild.name) : L.noGuild]
      .filter((x) => x !== '')
      .join('. ');
    const skills = card.skills.map(
      (k) => `${SKILLS[k.skill]?.name ?? k.skill}: ${L.bands[k.band] ?? ''}`,
    );
    const sheet = detailSheet({
      title: card.handle,
      icon,
      desc,
      lines: skills.length > 0 ? skills : [L.noSkills],
      extra: [
        el('p', 'pow-part-sheet-desc', card.met ? L.met : L.notMet),
        el('p', 'pow-part-sheet-desc', F.card.regard.replace('{tier}', F.tiers[card.tier] ?? '')),
        ...this.historyBlock(card, state),
        ...this.pokeBlock(card),
        ...this.duelBlock(card),
        ...this.friendBlock(card),
      ],
      onClose: () => this.close(),
    });
    const wrap = el('div', 'pow-traveler-card');
    put(wrap, sheet.el);
    this.root.appendChild(wrap);
    this.wrap = wrap;
    sheet.title.focus();
    this.opts.onOpenChange(true);
  }

  private historyBlock(card: ProfileCard, state?: SimState): HTMLElement[] {
    const lines = state ? card.memory.map((m) => memoryLine(state, m)).filter((x) => x !== '') : [];
    const ul = el('ul', 'pow-card-history');
    for (const l of lines) put(ul, el('li', 'pow-card-history-row', l));
    return [
      el('h4', 'pow-card-history-title', F.card.history),
      lines.length > 0 ? ul : el('p', 'pow-part-sheet-desc', F.card.noHistory),
    ];
  }

  /** Anyone the player has met can be challenged to a duel. They answer by temper and regard. */
  private duelBlock(card: ProfileCard): HTMLElement[] {
    if (!card.met) return [];
    const b = el('button', 'pow-button pow-card-action', F.card.challenge);
    b.type = 'button';
    b.addEventListener('click', () => {
      this.opts.onDuel(card.slot);
      this.close();
    });
    return [el('p', 'pow-part-sheet-desc', F.card.duelNote), b];
  }

  /** A sleeping Traveler can be poked awake. It is a joke, so it is only here while they sleep. */
  private pokeBlock(card: ProfileCard): HTMLElement[] {
    if (!card.asleep) return [];
    const b = el('button', 'pow-button pow-card-action', F.card.poke);
    b.type = 'button';
    b.addEventListener('click', () => {
      this.opts.onPoke(card.slot);
      this.close();
    });
    return [el('p', 'pow-part-sheet-desc', F.card.asleep), b];
  }

  private friendBlock(card: ProfileCard): HTMLElement[] {
    const act = (label: string, op: 'request' | 'accept' | 'decline' | 'remove'): HTMLElement => {
      const b = el('button', 'pow-button pow-card-action', label);
      b.type = 'button';
      b.addEventListener('click', () => {
        this.opts.onFriend(card.slot, op);
        this.close();
      });
      return b;
    };
    if (card.friend)
      return [el('p', 'pow-part-sheet-desc', F.card.isFriend), act(F.card.removeFriend, 'remove')];
    if (card.requestIn)
      return [
        el('p', 'pow-part-sheet-desc', F.card.theyAsked),
        act(F.accept, 'accept'),
        act(F.decline, 'decline'),
      ];
    if (card.requestOut) return [el('p', 'pow-part-sheet-desc', F.card.pending)];
    if (!card.met) return [el('p', 'pow-part-sheet-desc', F.card.needMeet)];
    return [act(F.card.addFriend, 'request')];
  }

  close(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.opts.onOpenChange(false);
  }
}
