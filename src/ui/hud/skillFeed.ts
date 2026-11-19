import { SKILLS } from '../../content/skills';
import { fill, SKILL_STRINGS } from '../../content/strings/skills';
import { PALETTE } from '../../content/sprites/palette';
import type { Renderer } from '../../render/renderer';
import type { SimEvent } from '../../sim/kernel/events';
import type { MessageRouter } from '../messages/router';
import type { PixelFont } from '../text/pixelFont';

const INK = PALETTE[3] as string;
const DARK = PALETTE[0] as string;

/** How long the small XP tick stays up after the last gain, ms. */
const TICK_MS = 1600;

interface Tick {
  skill: string;
  amount: number;
  at: number;
}

/**
 * The small XP tick (design/03) and the source of rank-up banners. Render-side only: it reads sim
 * events and keeps its own timers in wall time, so it never touches the sim. Banners go to the
 * message router, which owns their lane and timing.
 */
export class SkillFeed {
  private ticks: Tick[] = [];

  constructor(private readonly router: MessageRouter) {}

  /** Takes this tick's events for the avatar `who`. */
  ingest(events: readonly SimEvent[], who: number): void {
    for (const e of events) {
      // XP gains are silent: only a rank-up says anything about a skill.
      if (e.type === 'skillRankUp' && e.id === who) {
        const name = SKILLS[e.skill]?.name ?? e.skill;
        const text = e.mastery
          ? fill(SKILL_STRINGS.masteryUp, { skill: name, rank: e.mastery })
          : e.points === 1
            ? fill(SKILL_STRINGS.newSkill, { skill: name })
            : fill(SKILL_STRINGS.rankUp, { skill: name, points: e.points });
        this.router.post({ lane: 'banner', text, tone: e.mastery !== null ? 'gold' : 'plain' });
      }
    }
  }

  /** Draws the XP ticks below the bars at (`x`, `y`). */
  draw(
    r: Renderer,
    font: PixelFont,
    now: number,
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
  }
}
