import { GUILDS } from '../../content/travelers/guilds';
import { SKILLS } from '../../content/skills';
import { UI_STRINGS as S } from '../../content/strings/ui';
import type { ProfileCard } from '../../sim/travelers/entities';
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
    },
  ) {}

  get isOpen(): boolean {
    return this.wrap !== null;
  }

  open(card: ProfileCard): void {
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
      extra: [el('p', 'pow-part-sheet-desc', card.met ? L.met : L.notMet)],
      onClose: () => this.close(),
    });
    const wrap = el('div', 'pow-traveler-card');
    put(wrap, sheet.el);
    this.root.appendChild(wrap);
    this.wrap = wrap;
    sheet.title.focus();
    this.opts.onOpenChange(true);
  }

  close(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.opts.onOpenChange(false);
  }
}
