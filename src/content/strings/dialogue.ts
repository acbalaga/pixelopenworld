import { REQUEST_STRINGS } from './requests';
import { TRIAL_STRINGS } from './skills';

/** Dialogue, request and shop text. Plain voices, nothing about the world's hidden layer. No em dashes. */
export const DIALOGUE_STRINGS: Readonly<Record<string, string>> = {
  ...TRIAL_STRINGS,
  ...REQUEST_STRINGS,
  'dlg.c_bye': 'Goodbye.',
  'dlg.carpenter.greet':
    'Planks, beams, a good axe handle. If it is wood and it is wrong, bring it here.',
  'dlg.tinker.greet': 'Springs and clips and things that go click. Mind the bench, it bites.',
  'dlg.miller.greet': 'Flour by the sack and grain by the cart. The wheel does the thinking.',
  'dlg.farmer.greet': 'Dad says I should be in for supper. The barley says otherwise.',
  'dlg.fisher.greet': 'Quiet today. The fish are listening, so keep your voice down.',
  'dlg.foreman.greet': 'Stone does not move itself. Stand back from the lip and we will get along.',
  'dlg.hermit.greet': 'Far enough from town to hear the wind think. What brings you up here?',
  'dlg.reeve.greet':
    'Welcome to Hearthford. If something is wrong in the town, it ends up on my table sooner or later.',

  'dlg.c_accept': 'I will see to it.',
  'dlg.c_later': 'Not right now.',
  'dlg.c_test': 'I want to be tested.',
  'dlg.orla.tests': 'Which test?',
  'dlg.orla.c_blades': 'The blade test.',
  'dlg.orla.c_polearms': 'The spear test.',
  'dlg.orla.c_evasion': 'The dodging test.',
  'dlg.wren.tests': 'Which test do you want?',
  'dlg.wren.c_ember': 'Test my fire.',
  'dlg.wren.c_teach': 'Teach me a school.',
  'dlg.wren.teach': 'Which school? Each has a first spell I can show you. The rest you earn.',
  'dlg.wren.taught': 'There. Practice it, and the next will come to you.',
  'dlg.wren.c_ember_school': 'Ember.',
  'dlg.wren.c_more': 'Other schools.',
  'dlg.wren.c_tide': 'Tide.',
  'dlg.wren.c_gale': 'Gale.',
  'dlg.wren.c_stone': 'Stone.',
  'dlg.wren.c_mending': 'Mending.',
  'dlg.wren.c_hexing': 'Hexing.',
  'dlg.tobin.c_lesson': 'Could you show me a trick with a hammer?',
  'dlg.tobin.lesson':
    'Bring me three lumps of copper ore and I will show you how the weight does the work.',
  'dlg.tobin.c_overhead': 'Three lumps of copper ore for the overhead blow.',
  'dlg.tobin.taught': 'Lift it high, let it fall. Do not fight the weight.',
  'dlg.hesper.c_lesson': 'Do you know any songs?',
  'dlg.hesper.lesson':
    'I know a few. Two sprigs of sunwort for the stew pot and I will hum you one.',
  'dlg.hesper.c_hum': 'Two sprigs of sunwort for a song.',
  'dlg.hesper.taught': 'Low and steady, like carrying something heavy a long way.',
  'dlg.orla.c_lesson': 'Could you show me something?',
  'dlg.orla.lessons':
    'Three moss tufts for each of the first two. Or show me you have already stood behind a shield.',
  'dlg.orla.c_polearm_lunge': 'The spear thrust. Three moss tufts.',
  'dlg.orla.c_aimed': 'Steadying a shot. Three moss tufts.',
  'dlg.orla.c_bash': 'The shield bash. I have blocked some blows.',
  'dlg.orla.taught': 'Like that. Now do it until you stop thinking about it.',
  'dlg.pilgrim.c_lesson': 'Could you show me a way to go unseen?',
  'dlg.pilgrim.lesson':
    'A little bread for the road, and I will show you how to be a shape in the dark.',
  'dlg.pilgrim.c_hide': 'A piece of bread for the lesson.',
  'dlg.pilgrim.taught': 'Stay low. Stay still. Let it look past you.',
  'dlg.pilgrim.tests': 'Which road shall we try?',
  'dlg.pilgrim.c_athletics': 'Test my legs.',

  'dlg.brin.greet': 'Welcome to the counter. Looking, buying, or selling?',
  'dlg.brin.again': 'Back again, {address}. What will it be?',
  'dlg.brin.c_shop': 'Show me what you have.',
  'dlg.brin.c_test': 'I want to be tested at the anvil.',
  'dlg.brin.c_anvil': 'Anything I can do for the shop?',
  'dlg.brin.c_anvil_remind': 'About the metal.',
  'dlg.brin.anvil_accepted': 'Ore or ingots, I do not mind which. Bring it to the counter.',
  'dlg.brin.anvil_progress': 'Six copper ore, or two copper ingots. To the counter.',
  'dlg.brin.anvil_report': 'That will keep the anvil hot. Your coin.',
  'dlg.hesper.c_cook': 'I want to be tested at the pot.',

  'dlg.tobin.greet': 'Tools and blades. Everything here has been hit with a hammer at least once.',
  'dlg.tobin.again': 'Back at the anvil. What do you need?',
  'dlg.tobin.c_bricks': 'I found these firebricks. Do you know what they are for?',
  'dlg.tobin.bricks':
    'Oven bricks. Good ones, the old make. They want setting true, and a steady hand to do it.',
  'dlg.tobin.c_bricks_set': 'Let me hold the hammer. We will set them together.',
  'dlg.tobin.bricks_done': 'There. Square and tight. Whoever owned that oven would be glad of it.',
  'dlg.tobin.c_shop': 'Let me see the steel.',
  'dlg.mara.greet': 'Cloth, leather, a bit of mail. I can fit you in a minute.',
  'dlg.mara.again': 'Back for another fitting?',
  'dlg.mara.c_shop': 'What have you got to wear?',
  'dlg.ilse.greet': 'Roots, tonics and things that keep. Mind the nightshade.',
  'dlg.ilse.again': 'More bruises? Come in.',
  'dlg.ilse.c_shop': 'What do you sell?',

  'dlg.hesper.greet': 'Hungry? A pot is only as good as what goes into it.',
  'dlg.hesper.c_teach': 'Teach me something.',
  'dlg.hesper.teach':
    'Sunwort and dewmint, nothing more. Put them in the pot together and see what comes out.',
  'dlg.hesper.trial':
    'And if you want to call yourself a forager, bring me sunwort picked at dawn or dusk. It keeps its scent then.',
  'dlg.hesper.again': 'You again. The pot is yours whenever you need it.',
  'dlg.hesper.c_test': 'Remind me about the test.',
  'dlg.hesper.c_supper': 'Does the watch need feeding?',
  'dlg.hesper.c_supper_remind': 'About the watch supper.',
  'dlg.hesper.supper_accepted': 'Stews or skewers, whichever you can make. Bring them to me.',
  'dlg.hesper.supper_progress': 'Three Hearty Stews, or five Herbed Skewers. Bring them here.',
  'dlg.hesper.supper_report': 'That will feed them. Here is your coin.',

  'dlg.orla.ask':
    'Mosslings are chewing up the meadow gardens. Clear out four of them and I will sleep easier. Will you?',
  'dlg.orla.c_accept': 'I will handle it.',
  'dlg.orla.c_later': 'Not right now.',
  'dlg.orla.accepted':
    'Good. They gather out in the meadow, east and west of the square. Come back when it is done.',
  'dlg.orla.progress': 'Still at it? Four Mosslings, no more and no fewer.',
  'dlg.orla.report': 'That is all four. Take this, you have earned it.',
  'dlg.orla.after': 'Quiet meadows at last. Thank you.',
  'dlg.orla.c_boar': 'Is there anything else that needs doing?',
  'dlg.orla.c_boar_remind': 'About the boar.',
  'dlg.orla.boar_accepted': 'Mind its charge. The cave mouth is south-east of the square.',
  'dlg.orla.boar_progress':
    'The boar is still at the cave mouth, or the satchel is still in the first room. Either will do.',
  'dlg.orla.boar_report': 'The cave mouth is clear. Here is your pay.',

  'dlg.wren.ask':
    'I study how a seed holds fire. The Spitblooms down in the cave keep theirs in the pods. Put two of them down and I will show you how it is done.',
  'dlg.wren.c_accept': 'I will go and see.',
  'dlg.wren.c_later': 'Not right now.',
  'dlg.wren.accepted':
    'The cave mouth is south-east of town, past the stream. They sit rooted in the side rooms and spit from a distance, so do not stand still.',
  'dlg.wren.progress': 'Two Spitblooms, no more and no fewer. They are in the cave.',
  'dlg.wren.report':
    'Good. Now hold it, aim, and let go. It costs Focus, not breath. That is the Ember bolt, and it is yours.',
  'dlg.wren.after': 'Mind your Focus. It comes back slower than breath.',
  'dlg.wren.c_lamps': 'Is there anything else you need?',
  'dlg.wren.c_lamps_remind': 'About the lamps.',
  'dlg.wren.lamps_accepted': 'Brin sells it, or find it where you can. Bring it to me.',
  'dlg.wren.lamps_progress': 'Two flasks of lantern oil. Bring them to me.',
  'dlg.wren.lamps_report': 'Lit at last. Take this for the trouble.',

  'dlg.pilgrim.one': 'anyone know where the good loot is around here?',
  'dlg.pilgrim.two': 'also this dummy has 2000 hp. send help',
  'dlg.pilgrim.c_deep': 'heard anything odd from the cave?',
  'dlg.pilgrim.c_deep_remind': 'about the deep room',
  'dlg.pilgrim.deep_accepted': 'cool. its past the first rooms. dont stand still',
  'dlg.pilgrim.deep_progress': 'still stirring down there. 3 spitblooms or a song',
  'dlg.pilgrim.deep_report': 'quiet now. thanks. here, for the trouble',
};
