/** Player-facing text for skills. No em dashes. */
export const SKILL_STRINGS = {
  /** HUD tick after XP is earned. `{n}` is the amount, `{skill}` the skill name. */
  xpTick: '+{n} {skill}',
  /** Banner when a skill gains a point. `{skill}`, `{points}`. */
  rankUp: '{skill} {points}',
  newSkill: 'New skill: {skill}',
  /** Banner when a skill reaches a mastery rank. `{skill}`, `{rank}`. */
  masteryUp: '{skill}: {rank}',
  /** Shown while XP waits on a Trial. */
  waiting: 'Ready for a Trial',
} as const;

/** Fills `{key}` slots in a template. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
