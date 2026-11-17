import { CREATURES } from '../../src/content/creatures';
import { DIALOGUES, NPCS, REQUESTS, SHOPS } from '../../src/content/dialogue';
import type {
  Cond,
  Dialogue,
  Effect,
  NpcDef,
  RequestDef,
  ShopDef,
} from '../../src/content/dialogue/types';
import { ITEMS } from '../../src/content/items';
import { RECIPES } from '../../src/content/items/recipes';
import { SKILLS, TRIALS } from '../../src/content/skills';
import { DIALOGUE_STRINGS } from '../../src/content/strings/dialogue';

/** What dialogue content may refer to. Defaults to the real game content. */
export interface DialogueRefs {
  npcs: Readonly<Record<string, NpcDef>>;
  shops: Readonly<Record<string, ShopDef>>;
  requests: Readonly<Record<string, RequestDef>>;
  strings: Readonly<Record<string, string>>;
  items: ReadonlySet<string>;
  recipes: ReadonlySet<string>;
  trials: ReadonlySet<string>;
  skills: ReadonlySet<string>;
  creatures: ReadonlySet<string>;
}

const REAL: DialogueRefs = {
  npcs: NPCS,
  shops: SHOPS,
  requests: REQUESTS,
  strings: DIALOGUE_STRINGS,
  items: new Set(Object.keys(ITEMS)),
  recipes: new Set(Object.keys(RECIPES)),
  trials: new Set(Object.keys(TRIALS)),
  skills: new Set(Object.keys(SKILLS)),
  creatures: new Set(Object.keys(CREATURES)),
};

/**
 * Checks dialogue, shop and request content: every node reference lands on a node, every string
 * key exists, every id an effect or condition names exists, and no text has an em dash.
 */
export function validateDialogue(
  dialogues: Readonly<Record<string, Dialogue>> = DIALOGUES,
  refs: DialogueRefs = REAL,
): string[] {
  const errors: string[] = [];
  const text = (where: string, key: string): void => {
    const v = refs.strings[key];
    if (v === undefined) errors.push(`${where}: missing string ${key}`);
    else if (v.includes('—')) errors.push(`${where}: string ${key} has an em dash`);
  };
  const cond = (where: string, c: Cond): void => {
    if ('item' in c && !refs.items.has(c.item)) errors.push(`${where}: unknown item ${c.item}`);
    if ('skill' in c && !refs.skills.has(c.skill))
      errors.push(`${where}: unknown skill ${c.skill}`);
    if ('trial' in c && !refs.trials.has(c.trial))
      errors.push(`${where}: unknown trial ${c.trial}`);
    if ('request' in c && !refs.requests[c.request])
      errors.push(`${where}: unknown request ${c.request}`);
  };
  const effect = (where: string, e: Effect): void => {
    if ('give' in e && !refs.items.has(e.give)) errors.push(`${where}: unknown item ${e.give}`);
    if ('learnRecipe' in e && !refs.recipes.has(e.learnRecipe))
      errors.push(`${where}: unknown recipe ${e.learnRecipe}`);
    if ('offerTrial' in e && !refs.trials.has(e.offerTrial))
      errors.push(`${where}: unknown trial ${e.offerTrial}`);
    if ('startRequest' in e && !refs.requests[e.startRequest])
      errors.push(`${where}: unknown request ${e.startRequest}`);
    if ('turnIn' in e && !refs.requests[e.turnIn])
      errors.push(`${where}: unknown request ${e.turnIn}`);
    if ('openShop' in e && !refs.shops[e.openShop])
      errors.push(`${where}: unknown shop ${e.openShop}`);
  };

  for (const [key, d] of Object.entries(dialogues)) {
    const label = `dialogue ${key}`;
    if (d.npc !== key) errors.push(`${label}: npc ${d.npc} does not match its key`);
    if (!refs.npcs[d.npc]) errors.push(`${label}: no NPC ${d.npc}`);
    if (d.entries.length === 0) errors.push(`${label}: no entries`);
    const node = (where: string, id: string | null | undefined): void => {
      if (id !== null && id !== undefined && !d.nodes[id])
        errors.push(`${where}: points at missing node ${id}`);
    };
    d.entries.forEach((e, i) => {
      node(`${label} entry ${i}`, e.node);
      for (const c of e.if ?? []) cond(`${label} entry ${i}`, c);
    });
    if (d.entries.length > 0 && d.entries[d.entries.length - 1]?.if)
      errors.push(`${label}: the last entry needs no condition, or a talk could find no start`);
    for (const [id, n] of Object.entries(d.nodes)) {
      const where = `${label} node ${id}`;
      if (n.id !== id) errors.push(`${where}: id ${n.id} does not match its key`);
      text(where, n.text);
      node(where, n.next);
      if (n.next !== undefined && n.choices) errors.push(`${where}: has both next and choices`);
      if ((n.choices?.length ?? 0) > 6) errors.push(`${where}: more than 6 choices`);
      for (const e of n.do ?? []) effect(where, e);
      n.choices?.forEach((c, i) => {
        const cw = `${where} choice ${i}`;
        text(cw, c.text);
        node(cw, c.next);
        for (const k of c.if ?? []) cond(cw, k);
        for (const e of c.do ?? []) effect(cw, e);
      });
    }
  }
  for (const n of Object.keys(refs.npcs))
    if (!dialogues[n]) errors.push(`npc ${n}: has no dialogue`);
  for (const [key, s] of Object.entries(refs.shops)) {
    if (s.id !== key) errors.push(`shop ${key}: id ${s.id} does not match its key`);
    if (!refs.npcs[s.npc]) errors.push(`shop ${key}: no NPC ${s.npc}`);
    for (const i of s.stock) if (!refs.items.has(i)) errors.push(`shop ${key}: unknown item ${i}`);
  }
  for (const [key, r] of Object.entries(refs.requests)) {
    const label = `request ${key}`;
    if (r.id !== key) errors.push(`${label}: id ${r.id} does not match its key`);
    if (!refs.npcs[r.giver]) errors.push(`${label}: no NPC ${r.giver}`);
    if (!refs.creatures.has(r.goal.kill)) errors.push(`${label}: unknown creature ${r.goal.kill}`);
    if (r.goal.count < 1) errors.push(`${label}: goal count must be at least 1`);
    text(label, r.title);
    text(label, r.log);
    for (const x of r.reward.items)
      if (!refs.items.has(x.item)) errors.push(`${label}: unknown reward item ${x.item}`);
  }
  return errors;
}
