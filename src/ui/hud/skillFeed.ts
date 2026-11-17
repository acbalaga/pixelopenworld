import { SKILLS } from '../../content/skills';
import { fill, SKILL_STRINGS } from '../../content/strings/skills';
import { PALETTE } from '../../content/sprites/palette';
import type { Renderer } from '../../render/renderer';
import type { SimEvent } from '../../sim/kernel/events';
import type { PixelFont } from '../text/pixelFont';

const INK = PALETTE[3] as string;
const DARK = PALETTE[0] as string;
const GOLD = PALETTE[47] as string;

/** How long the small XP tick stays up after the last gain, ms. */
const TICK_MS = 1600;
/** How long the rank-up banner stays up, ms. */
const BANNER_MS = 2600;
/** Banners that wait their turn, so a burst of rank-ups is read one at a time. */
const MAX_QUEUED = 4;

interface Tick {
  skill: string;
  amount: number;
  at: number;
}

interface Banner {
  text: string;
  mastery: boolean;
}

/**
 * The small XP tick and the rank-up banner (design/03). Render-side only: it reads sim events
 * and keeps its own timers in wall time, so it never touches the sim.
 */
export class SkillFeed {
  private ticks: Tick[] = [];
  private queue: Banner[] = [];
  private shown: (Banner & { at: number }) | null = null;

  /** Takes this tick's events for the avatar `who`. */
  ingest(events: readonly SimEvent[], who: number, now: number): void {
    for (const e of events) {
      if (e.type === 'skillXp' && e.id === who) {
        const last = this.ticks.find((t) => t.skill === e.skill);
        if (last) {
          last.amount += e.amount;
          last.at = now;
        } else this.ticks.push({ skill: e.skill, amount: e.amount, at: now });
      } else if (e.type === 'skillRankUp' && e.id === who) {
        const name = SKILLS[e.skill]?.name ?? e.skill;
        const text = e.mastery
          ? fill(SKILL_STRINGS.masteryUp, { skill: name, rank: e.mastery })
          : fill(SKILL_STRINGS.rankUp, { skill: name, points: e.points });
        if (this.queue.length < MAX_QUEUED) this.queue.push({ text, mastery: e.mastery !== null });
      }
    }
  }

  /** Draws the banner centered at `cx` and the XP ticks below the bars at (`x`, `y`). */
  draw(
    r: Renderer,
    font: PixelFont,
    now: number,
    cx: number,
    bannerY: number,
    x: number,
    y: number,
    reducedMotion: boolean,
  ): void {
    this.ticks = this.ticks.filter((t) => now - t.at < TICK_MS);
    let row = 0;
    for (const t of this.ticks) {
      const name = SKILLS[t.skill]?.name ?? t.skill;
      const rise = reducedMotion ? 0 : Math.min(3, Math.floor((now - t.at) / 200));
      font.draw(
        r,
        fill(SKILL_STRINGS.xpTick, { n: t.amount, skill: name }),
        x,
        y + row * 9 - rise,
        INK,
        {
          outline: DARK,
        },
      );
      row++;
    }
    if (this.shown && now - this.shown.at >= BANNER_MS) this.shown = null;
    if (!this.shown) {
      const next = this.queue.shift();
      if (next) this.shown = { ...next, at: now };
    }
    if (this.shown)
      font.draw(r, this.shown.text, cx, bannerY, this.shown.mastery ? GOLD : INK, {
        align: 'center',
        outline: DARK,
      });
  }
}
