import type { ChatExchange, ChatTemplate } from '../types';

/** Questions and answers, and the banter of Travelers who know each other. */
const T = (
  id: string,
  category: ChatTemplate['category'],
  trigger: ChatTemplate['trigger'],
  text: string[],
  extra: Partial<ChatTemplate> = {},
): ChatTemplate => ({
  id,
  category,
  channel: 'world',
  trigger,
  text,
  weight: 3,
  cooldownMin: 60,
  ...extra,
});

export const KNOWLEDGE: readonly ChatTemplate[] = [
  // Questions. An answer (a rumor, right or wrong) can follow.
  T(
    'question.recipe',
    'question',
    'state.question',
    ['how do i make {item}?', 'anyone know the recipe for {item}?', 'what goes into {item}?'],
    {
      when: { archetype: ['Newbie', 'Casual', 'Crafter', 'Socializer'] },
    },
  ),
  T(
    'question.creature',
    'question',
    'state.question',
    ['how do you beat a {creature}?', 'any tips for a {creature}? it keeps beating me'],
    {
      when: { archetype: ['Newbie', 'Casual', 'Explorer'] },
    },
  ),
  T(
    'question.dungeon',
    'question',
    'state.question',
    ['is {dungeon} hard? what should i bring?', 'tips for {dungeon}?'],
    {
      when: { archetype: ['Newbie', 'Casual', 'Explorer', 'Completionist'] },
    },
  ),
  T('question.where', 'question', 'state.question', [
    'where do i find {item}?',
    'where does {item} come from?',
  ]),
  T(
    'question.sleep',
    'question',
    'state.question',
    ['where do i respawn if i die?', 'does the inn bed do anything?'],
    {
      when: { archetype: ['Newbie'] },
    },
  ),
  T(
    'question.fast',
    'question',
    'state.question',
    ['fastest way to rank up {skill}?', 'how are you all training {skill}?'],
    {
      when: { archetype: ['Grinder', 'Completionist', 'Newbie'] },
    },
  ),
  T(
    'question.where.local',
    'question',
    'state.question',
    ['anyone know where {place} is?', 'which way to {place}?'],
    {
      channel: 'local',
      when: { archetype: ['Newbie', 'Casual'] },
    },
  ),
  T(
    'question.price',
    'question',
    'state.question',
    ['what is {item} worth these days?', 'how much for {item}?'],
    {
      when: { archetype: ['Newbie', 'Casual', 'Trader'] },
    },
  ),

  // Answers. `{rumor}` is a line from the rumor table.
  T('answer.sure', 'answer', 'state.answer', [
    'i think {rumor}',
    'pretty sure {rumor}',
    'from what i know, {rumor}',
  ]),
  T(
    'answer.helpful',
    'answer',
    'state.answer',
    ['{rumor}. hope that helps', 'good question. {rumor}'],
    {
      when: { archetype: ['Socializer', 'Veteran', 'Crafter'] },
    },
  ),
  T('answer.firm', 'answer', 'state.answer', ['{rumor}', '{rumor}. trust me'], {
    when: { archetype: ['Explorer', 'Completionist', 'Veteran'] },
  }),
  T('answer.shy', 'answer', 'state.answer', ['not sure but maybe {rumor}', 'i heard {rumor}'], {
    when: { archetype: ['Casual', 'Newbie'] },
  }),
  T('answer.local', 'answer', 'state.answer', ['{rumor}', 'try this, {rumor}'], {
    channel: 'local',
    weight: 2,
  }),
  T(
    'answer.thanks',
    'answer',
    'state.answer',
    ['{rumor}, i read it somewhere', 'someone told me {rumor}'],
    { weight: 2 },
  ),
];

/**
 * Exchanges between Travelers with a standing tie (design/12 4.5): a few lines, `a` then `b`. They
 * are said by those two, in order, a minute or so apart.
 */
export const EXCHANGES: readonly ChatExchange[] = [
  {
    id: 'exchange.friend.hello',
    tie: 'friend',
    weight: 3,
    lines: [
      { role: 'a', text: 'hey {handle}, you around?' },
      { role: 'b', text: 'always. what is up?' },
      { role: 'a', text: 'nothing, just saying hi' },
    ],
  },
  {
    id: 'exchange.friend.bread',
    tie: 'friend',
    weight: 2,
    lines: [
      { role: 'a', text: '{handle} did you eat yet?' },
      { role: 'b', text: 'bread. always bread' },
    ],
  },
  {
    id: 'exchange.friend.help',
    tie: 'friend',
    weight: 2,
    lines: [
      { role: 'a', text: '{handle} can you help me with a job later?' },
      { role: 'b', text: 'sure, whisper me when you are ready' },
      { role: 'a', text: 'thanks, you are the best' },
    ],
  },
  {
    id: 'exchange.sibling.logoff',
    tie: 'sibling',
    weight: 4,
    lines: [
      { role: 'a', text: '{handle} it is your turn to log off' },
      { role: 'b', text: 'no it is not, you went last' },
      { role: 'a', text: 'i did not' },
      { role: 'b', text: 'you did, i have a witness' },
    ],
  },
  {
    id: 'exchange.sibling.borrow',
    tie: 'sibling',
    weight: 2,
    lines: [
      { role: 'a', text: '{handle} did you take my good dagger again?' },
      { role: 'b', text: 'borrowed. i was going to give it back' },
    ],
  },
  {
    id: 'exchange.rival.board',
    tie: 'rival',
    weight: 3,
    lines: [
      { role: 'a', text: 'still behind me on the board, {handle}' },
      { role: 'b', text: 'enjoy it while it lasts' },
      { role: 'a', text: 'every day i enjoy it more' },
    ],
  },
  {
    id: 'exchange.rival.price',
    tie: 'rival',
    weight: 2,
    lines: [
      { role: 'a', text: '{handle} i see you undercut me again' },
      { role: 'b', text: 'a good trade is a fair fight' },
    ],
  },
  {
    id: 'exchange.mentor.ask',
    tie: 'mentor',
    weight: 3,
    lines: [
      { role: 'a', text: '{handle} how do i stop burning everything?' },
      { role: 'b', text: 'watch the meter, not the pan' },
      { role: 'a', text: 'okay. okay. trying again' },
    ],
  },
];
