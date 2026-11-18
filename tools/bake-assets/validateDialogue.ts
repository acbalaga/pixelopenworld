import { PATHS } from '../../src/content/paths';
import { SHOP_BALANCE } from '../../src/content/balance/shop';
import { CREATURES } from '../../src/content/creatures';
import { REQUEST_BALANCE } from '../../src/content/balance/requests';
import { DIALOGUES, NPCS, SHOPS } from '../../src/content/dialogue';
import { REQUESTS } from '../../src/content/requests';
import type { RequestDef } from '../../src/content/requests/types';
import type { Cond, Dialogue, Effect, NpcDef, ShopDef } from '../../src/content/dialogue/types';
import { ITEMS } from '../../src/content/items';
import { FIXTURES } from '../../src/content/world/fixtures';
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
    if ('pathWorn' in c && !PATHS[c.pathWorn]) errors.push(`${where}: unknown path ${c.pathWorn}`);
    if ('pathEarned' in c && !PATHS[c.pathEarned])
      errors.push(`${where}: unknown path ${c.pathEarned}`);
    if ('trial' in c && !refs.trials.has(c.trial))
      errors.push(`${where}: unknown trial ${c.trial}`);
    if ('request' in c && !refs.requests[c.request])
      errors.push(`${where}: unknown request ${c.request}`);
    if ('renown' in c && c.renown.region !== REQUEST_BALANCE.homeRegion)
      errors.push(`${where}: unknown region ${c.renown.region}`);
    if ('phase' in c && c.phase.length === 0) errors.push(`${where}: empty phase list`);
    if ('season' in c && c.season.length === 0) errors.push(`${where}: empty season list`);
    if ('weather' in c && c.weather.length === 0) errors.push(`${where}: empty weather list`);
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
    if ('takeItem' in e && !refs.items.has(e.takeItem))
      errors.push(`${where}: unknown item ${e.takeItem}`);
    if ('renown' in e && !(e.renown >= 1 && Number.isInteger(e.renown)))
      errors.push(`${where}: renown must be a whole number above 0`);
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
      for (const e of n.do ?? []) {
        effect(where, e);
        if ('renown' in e) errors.push(`${where}: Renown belongs on a choice, not a node`);
      }
      n.choices?.forEach((c, i) => {
        const cw = `${where} choice ${i}`;
        text(cw, c.text);
        node(cw, c.next);
        for (const k of c.if ?? []) cond(cw, k);
        for (const e of c.do ?? []) effect(cw, e);
        // A conversation can be had again, so Renown from one is paid once: the choice sets a
        // flag and is only offered while that flag is not set.
        if ((c.do ?? []).some((e) => 'renown' in e)) {
          const flags = (c.do ?? []).flatMap((e) => ('setFlag' in e ? [e.setFlag] : []));
          const guarded = (c.if ?? []).some(
            (k) => 'flag' in k && k.not === true && flags.includes(k.flag),
          );
          if (!guarded)
            errors.push(`${cw}: gives Renown without a flag that stops it paying twice`);
        }
      });
    }
  }
  for (const n of Object.keys(refs.npcs))
    if (!dialogues[n]) errors.push(`npc ${n}: has no dialogue`);
  for (const [key, s] of Object.entries(refs.shops)) {
    if (s.id !== key) errors.push(`shop ${key}: id ${s.id} does not match its key`);
    if (!refs.npcs[s.npc]) errors.push(`shop ${key}: no NPC ${s.npc}`);
    for (const i of s.stock) {
      if (!refs.items.has(i.item)) errors.push(`shop ${key}: unknown item ${i.item}`);
      if (!Number.isInteger(i.max) || i.max < 1) errors.push(`shop ${key}: ${i.item} max below 1`);
    }
    if (!(s.region in SHOP_BALANCE.regionPct))
      errors.push(`shop ${key}: unknown region ${s.region}`);
    if (s.buys.length === 0) errors.push(`shop ${key}: buys nothing`);
    if (s.firmness < 0 || s.firmness > 60) errors.push(`shop ${key}: firmness outside 0 to 60`);
  }
  const flagsSet = new Set<string>();
  const offered = new Set<string>();
  const turnedIn = new Set<string>();
  for (const d of Object.values(dialogues))
    for (const n of Object.values(d.nodes))
      for (const e of [...(n.do ?? []), ...(n.choices ?? []).flatMap((c) => c.do ?? [])]) {
        if ('setFlag' in e) flagsSet.add(e.setFlag);
        if ('startRequest' in e) offered.add(`${d.npc}|${e.startRequest}`);
        if ('turnIn' in e) turnedIn.add(`${d.npc}|${e.turnIn}`);
      }
  const fixtureFlags = new Set(
    Object.values(FIXTURES).flatMap((f) => (f.setsFlag ? [f.setsFlag] : [])),
  );
  for (const [key, r] of Object.entries(refs.requests)) {
    const label = `request ${key}`;
    if (r.id !== key) errors.push(`${label}: id ${r.id} does not match its key`);
    if ('npc' in r.giver) {
      if (!refs.npcs[r.giver.npc]) errors.push(`${label}: no NPC ${r.giver.npc}`);
      else if (r.kind === 'authored') {
        if (!offered.has(`${r.giver.npc}|${key}`))
          errors.push(`${label}: ${r.giver.npc} never starts it`);
        if (!turnedIn.has(`${r.giver.npc}|${key}`))
          errors.push(`${label}: ${r.giver.npc} never takes it in`);
      }
    }
    if (r.region !== REQUEST_BALANCE.homeRegion)
      errors.push(`${label}: unknown region ${r.region}`);
    text(label, r.titleKey);
    text(label, r.askKey);
    const title = (refs.strings[r.titleKey] ?? '').length;
    if (r.kind === 'authored' && title > REQUEST_BALANCE.titleMax)
      errors.push(
        `${label}: title is ${title} characters, the limit is ${REQUEST_BALANCE.titleMax}`,
      );
    if (r.solutions.length === 0) errors.push(`${label}: no solutions`);
    const ids = new Set<string>();
    for (const sol of r.solutions) {
      const sw = `${label} solution ${sol.id}`;
      if (ids.has(sol.id)) errors.push(`${sw}: duplicate id`);
      ids.add(sol.id);
      text(sw, sol.labelKey);
      if (sol.steps.length === 0) errors.push(`${sw}: no steps`);
      for (const o of sol.steps) {
        if (o.kind === 'defeat' && o.creature && !refs.creatures.has(o.creature))
          errors.push(`${sw}: unknown creature ${o.creature}`);
        if ((o.kind === 'gather' || o.kind === 'deliver') && o.item && !refs.items.has(o.item))
          errors.push(`${sw}: unknown item ${o.item}`);
        if (o.kind === 'deliver' && !refs.npcs[o.to]) errors.push(`${sw}: no NPC ${o.to}`);
        if (o.kind === 'talk' && !refs.npcs[o.npc]) errors.push(`${sw}: no NPC ${o.npc}`);
        if (o.kind === 'flag') {
          if (!flagsSet.has(o.flag) && !fixtureFlags.has(o.flag))
            errors.push(`${sw}: nothing sets flag ${o.flag}`);
          text(sw, `${o.flag}.step`);
        }
        if ((o.kind === 'defeat' || o.kind === 'gather' || o.kind === 'perform') && o.count < 1)
          errors.push(`${sw}: count must be at least 1`);
      }
    }
    for (const x of r.reward.items)
      if (!refs.items.has(x.item)) errors.push(`${label}: unknown reward item ${x.item}`);
    if (r.reward.renown < 0 || !Number.isInteger(r.reward.renown))
      errors.push(`${label}: renown must be a whole number`);
  }
  return errors;
}
