/**
 * Request text (M3-11): titles at most 24 characters, the asker's own words, one line per way to
 * finish, and the templates the log and the board fill in. Plain voices, nothing about the
 * world's hidden layer. No em dashes.
 */
export const REQUEST_STRINGS: Readonly<Record<string, string>> = {
  // Pests in the meadow (the first request).
  'request.clear_pests.title': 'Pests in the meadow',
  'request.clear_pests.ask':
    'Mosslings are chewing up the meadow gardens. Clear out four of them and I will sleep easier.',
  'request.clear_pests.defeat': 'Put the Mosslings down',

  'request.ember_pods.title': 'A seed that holds fire',
  'request.ember_pods.ask':
    'I study how a seed holds fire. The Spitblooms down in the cave keep theirs in the pods. Put two of them down and I will show you how it is done.',
  'request.ember_pods.defeat': 'Put the Spitblooms down',

  'request.old_lamps.title': 'Oil for the old lamps',
  'request.old_lamps.ask':
    'The lamps along the old road have run dry. Two flasks of lantern oil, and I will see them lit again.',
  'request.old_lamps.bring': 'Bring the oil',

  'request.cave_boar.title': 'The boar by the cave',
  'request.cave_boar.ask':
    'A Bramble Boar has taken the cave mouth. Put it down. Or slip past it unseen: a patrol dropped a satchel in the first cave room, and I want it back.',
  'request.cave_boar.defeat': 'Put the Bramble Boar down',
  'request.cave_boar.hide': 'Slip past it and fetch the satchel',

  'request.watch_supper.title': 'Supper for the watch',
  'request.watch_supper.ask':
    'The night watch has not had a proper meal in days. Three Hearty Stews would do it. Five Herbed Skewers would do as well.',
  'request.watch_supper.stew': 'Bring Hearty Stews',
  'request.watch_supper.skewers': 'Bring Herbed Skewers',

  'request.anvil_metal.title': 'Metal for the anvil',
  'request.anvil_metal.ask':
    'The anvil has gone cold for want of metal. Six copper ore, or two copper ingots, and Tobin can get back to work.',
  'request.anvil_metal.ore': 'Bring copper ore',
  'request.anvil_metal.ingots': 'Bring copper ingots',

  'request.deep_room.title': 'A stir in the deep room',
  'request.deep_room.ask':
    'something is stirring in the deep room of the cave. put down 3 spitblooms in there. or sing it quiet, a hermit swears the courage song settles the place',
  'request.deep_room.defeat': 'Put the Spitblooms down',
  'request.deep_room.sing': 'Finish the Hum of Courage',

  // What a flag step says in the log. Never a place on a map.
  'flag.satchel_taken.step': 'Take the satchel from the first cave room',

  // Steps, filled from the objective. `{what}` is a name from the content strings.
  'request.step.defeat': 'Defeat {n} {what}',
  'request.step.defeat.one': 'Defeat the {what}',
  'request.step.gather': 'Gather {n} {what}',
  'request.step.deliver': 'Bring {n} {what} to {who}',
  'request.step.craft': 'Make a {what}',
  'request.step.perform': 'Finish {what}',
  'request.step.perform.n': 'Do {what} {n} times',
  'request.step.talk': 'Speak with {who}',
  'request.step.other': 'Do the next thing',
  'request.step.done': 'Done',
  'request.step.progress': '{n} of {max}',

  // The log and the board.
  'request.log.heading': 'Requests',
  'request.log.none': 'No requests yet. Talk to people, or look at the board in the square.',
  'request.log.ready': 'Ready to hand in',
  'request.log.done': 'Finished',
  'request.log.pin': 'Pin',
  'request.log.unpin': 'Unpin',
  'request.log.any': 'Any one of these will do:',
  'request.reward': 'Reward: {what}',
  'request.reward.coin': '{n} coin',
  'request.reward.renown': 'Renown {n}',
  'request.board.title': 'Request board',
  'request.board.empty': 'Nothing is posted. New jobs go up at dawn.',
  'request.board.take': 'Take it',
  'request.board.turnIn': 'Hand in',
  'request.board.yours': 'Yours, ready to hand in',
  'request.board.full': 'You are carrying as many jobs as you can manage.',
  'request.board.close': 'Close',

  // Standing requests, made at dawn from what the region needs.
  'request.standing.gather.title': 'Gather {n} {what}',
  'request.standing.gather.ask':
    'We are short of {what}. Bring {n} to the board, from wherever it grows.',
  'request.standing.gather.way': 'Gather them',
  'request.standing.deliver.title': 'Stock for the shelf',
  'request.standing.deliver.ask':
    '{who} has run out of {what}. Bring {n} to {who} and the board will pay you.',
  'request.standing.deliver.way': 'Bring them',
  'request.standing.defeat.title': 'Thin out the {what}',
  'request.standing.defeat.ask': 'The {what} are getting bold. Put {n} down and tell the board.',
  'request.standing.defeat.way': 'Put them down',
};
