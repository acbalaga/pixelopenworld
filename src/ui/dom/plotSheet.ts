import { FARMING } from '../../content/balance/farming';
import { CROPS, CROP_BY_SEED, CROP_NAMES } from '../../content/farming/crops';
import { ITEMS } from '../../content/items';
import { ITEM_STRINGS } from '../../content/strings/items';
import { FARM_STRINGS as S } from '../../content/strings/farming';
import type { Command } from '../../sim/kernel/commands';
import { DAY_TICKS, canPlant, isRipe, isWet, leased, podCrop, stageOf } from '../../sim/farming';
import type { SimState } from '../../sim/state';
import { seasonOf, weatherOn } from '../../sim/time';
import type { EntityId } from '../../sim/kernel/entities';
import { detailSheet, el, put, type SheetAction } from './parts';

/**
 * A plot of the reeve's field (POW-M6-02), opened by the context button when there is no one
 * obvious thing to do: the lease, the soil, the crop and its stage, the water, and buttons to till,
 * plant a seed from the Bag, water, fertilize or harvest. Text is set with `textContent` only.
 */
export class PlotSheet {
  private wrap: HTMLElement | null = null;
  private plot = -1;

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: {
      read: () => { state: SimState; who: EntityId };
      send: (c: Command) => void;
      onOpenChange: (open: boolean) => void;
    },
  ) {}

  get isOpen(): boolean {
    return this.wrap !== null;
  }

  open(plot: number): void {
    this.close();
    this.plot = plot;
    const { state, who } = this.opts.read();
    const p = state.farm.plots[plot];
    if (!p) return;
    const lines: string[] = [];
    const now = state.worldTick;
    if (p.paidUntil <= 0) lines.push(S.unleased);
    else if (!leased(state, p)) lines.push(S.lapsed);
    else {
      const days = Math.floor((p.paidUntil - now) / DAY_TICKS);
      lines.push(days >= 1 ? S.leasedFor.replace('{d}', String(days)) : S.leasedHours);
    }
    lines.push(p.tilled ? (S.soil[p.soil] ?? '') : S.untilled);
    const crop = p.crop ? CROPS[p.crop] : undefined;
    const cropName = crop ? (CROP_NAMES[crop.id]?.crop ?? crop.id) : '';
    if (crop && p.giant !== undefined) lines.push(S.giant.replace('{crop}', cropName));
    else if (crop) {
      const stage = stageOf(state, p);
      lines.push(S.crop.replace('{crop}', cropName).replace('{stage}', S.stage[stage] ?? ''));
      if (!isRipe(state, p)) {
        if (!crop.seasons.includes(seasonOf(now))) lines.push(S.waiting);
        else if (FARMING.rainWeather.includes(weatherOn(state, now))) lines.push(S.rain);
        else lines.push(isWet(state, p) ? S.wet : S.dry);
        if (p.fert) lines.push(S.fed);
      }
    } else if (p.tilled) lines.push(S.empty);
    lines.push(
      S.water.replace('{n}', String(state.farm.water)).replace('{max}', String(FARMING.canCharges)),
    );

    // Each line is a sentence, so they stack as paragraphs rather than sitting in the number grid.
    const extra: HTMLElement[] = lines.map((t) => el('p', 'pow-part-sheet-desc', t));
    const actions: SheetAction[] = [];
    const send = (c: Command): void => {
      this.opts.send(c);
      this.close();
    };
    const on = leased(state, p);
    if (on && !p.tilled)
      actions.push({
        label: S.till,
        key: 'till',
        onClick: () => send({ type: 'farm', op: 'till', plot }),
      });
    if (on && p.tilled && !p.crop) {
      extra.push(el('h4', 'pow-party-head', S.plantHead));
      const inv = state.entities.comps.inventory[who];
      const ul = el('ul', 'pow-party-list');
      inv?.slots.forEach((st, slot) => {
        if (!st) return;
        const c = st.item === 'item.seed_pod' ? podCrop(state, plot) : CROP_BY_SEED[st.item];
        if (!c || !canPlant(state, who, plot, c)) return;
        const li = el('li', 'pow-party-row');
        const b = el('button', 'pow-button pow-party-btn', S.plantHead);
        b.type = 'button';
        b.addEventListener('click', () => send({ type: 'farm', op: 'plant', plot, slot }));
        const name = ITEM_STRINGS[ITEMS[st.item]?.nameKey ?? ''] ?? st.item;
        put(li, el('span', 'pow-party-name', `${name} x${st.qty}`), b);
        ul.appendChild(li);
      });
      extra.push(ul.childElementCount > 0 ? ul : el('p', 'pow-empty', S.noSeeds));
    }
    if (crop && isRipe(state, p))
      actions.push({
        label: S.harvest,
        key: 'harvest',
        primary: true,
        onClick: () => send({ type: 'farm', op: 'harvest', plot }),
      });
    else if (on && crop) {
      actions.push({
        label: S.fertilize,
        key: 'fertilize',
        onClick: () => send({ type: 'farm', op: 'fertilize', plot }),
      });
      actions.push({
        label: S.waterBtn,
        key: 'water',
        primary: true,
        onClick: () => send({ type: 'farm', op: 'water', plot }),
      });
    } else if (on && p.tilled)
      actions.push({
        label: S.fertilize,
        key: 'fertilize',
        onClick: () => send({ type: 'farm', op: 'fertilize', plot }),
      });

    const sheet = detailSheet({
      title: S.title.replace('{n}', String(plot + 1)),
      extra,
      actions,
      onClose: () => this.close(),
    });
    const wrap = el('div', 'pow-pit');
    put(wrap, sheet.el);
    this.root.appendChild(wrap);
    this.wrap = wrap;
    sheet.title.focus();
    this.opts.onOpenChange(true);
  }

  /** Redraws the open sheet, for a plot that changed while it was open. */
  refresh(): void {
    if (this.wrap && this.plot >= 0) this.open(this.plot);
  }

  close(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.opts.onOpenChange(false);
  }
}
