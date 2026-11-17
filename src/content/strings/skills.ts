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

/**
 * Trial text. `intro` is what the giver says when offering (and what the Trials log shows), `hint`
 * is the Skills tab line: it names the giver and gives a clue, never the whole answer.
 */
export const TRIAL_STRINGS: Readonly<Record<string, string>> = {
  'trial.blades.15.intro':
    'Three Mosslings, one after another, with a blade, and not one of them lands a hit on you. Then I will believe your edge.',
  'trial.blades.15.hint': 'Orla, at the gate, wants a clean fight with a blade.',
  'trial.polearms.15.intro':
    'Two Bramble Boars, and only the spear touches them. Keep your distance and let the reach do the work.',
  'trial.polearms.15.hint': 'Orla wants boars put down with a spear and nothing else.',
  'trial.evasion.15.intro':
    'Roll away from five blows at the last moment, in a single fight. Do not leave the fight to catch your breath.',
  'trial.evasion.15.hint': 'Orla wants to see five late dodges in one fight.',
  'trial.ember.15.intro':
    'Three Spitblooms, and only fire. Not a sword stroke, not a thrown stone. I want to see you hold the flame steady.',
  'trial.ember.15.hint': 'Wren is curious how steady your fire is against Spitblooms.',
  'trial.athletics.15.intro':
    'The cave mouth is a long way from the Waystone. Start from the stone and get there in forty seconds. Run, do not stroll.',
  'trial.athletics.15.hint': 'The Pilgrim wants a run from the Waystone to the cave mouth.',
  'trial.foraging.15.intro':
    'And if you want to call yourself a forager, bring me sunwort picked at dawn or dusk. It keeps its scent then.',
  'trial.foraging.15.hint': 'Hesper wants sunwort picked at the turn of the day.',
};

/** Fills `{key}` slots in a template. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
