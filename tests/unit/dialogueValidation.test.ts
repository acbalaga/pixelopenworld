import { describe, expect, it } from 'vitest';
import { DIALOGUES, NPCS } from '../../src/content/dialogue';
import type { Dialogue } from '../../src/content/dialogue/types';
import { DIALOGUE_STRINGS } from '../../src/content/strings/dialogue';
import { validateDialogue } from '../../tools/bake-assets/validateDialogue';

describe('dialogue validation', () => {
  it('the real content is valid', () => {
    expect(validateDialogue()).toEqual([]);
  });

  const withNode = (patch: Partial<Dialogue['nodes'][string]>): Record<string, Dialogue> => {
    const d = DIALOGUES['npc.guard'] as Dialogue;
    return {
      ...DIALOGUES,
      'npc.guard': { ...d, nodes: { ...d.nodes, accepted: { ...d.nodes.accepted!, ...patch } } },
    };
  };

  it('rejects a dangling node reference', () => {
    const errors = validateDialogue(withNode({ next: 'nowhere' }));
    expect(errors.join('\n')).toMatch(/node accepted: points at missing node nowhere/);
  });

  it('rejects a missing string key', () => {
    const errors = validateDialogue(withNode({ text: 'dlg.orla.not_written' }));
    expect(errors.join('\n')).toMatch(/missing string dlg\.orla\.not_written/);
  });

  it('rejects an effect that names something that does not exist', () => {
    const errors = validateDialogue(withNode({ do: [{ give: 'item.nope', qty: 1 }] }));
    expect(errors.join('\n')).toMatch(/unknown item item\.nope/);
  });

  it('rejects an NPC with no dialogue, and an em dash in text', () => {
    const rest: Record<string, Dialogue> = { ...DIALOGUES };
    delete rest['npc.pilgrim'];
    expect(validateDialogue(rest).join('\n')).toMatch(/npc npc\.pilgrim: has no dialogue/);
    const errors = validateDialogue(DIALOGUES, {
      npcs: NPCS,
      shops: {},
      requests: {},
      strings: { ...DIALOGUE_STRINGS, 'dlg.c_bye': 'Bye — now' },
      items: new Set(),
      recipes: new Set(),
      trials: new Set(),
      skills: new Set(),
      creatures: new Set(),
    });
    expect(errors.join('\n')).toMatch(/has an em dash/);
  });
});
