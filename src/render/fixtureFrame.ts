import type { FixtureDef } from '../content/world/fixtures';

/**
 * The sprite frame a fixture shows, by its type and whether it is open (a plate pressed, a vent
 * bursting, a door open). The opening animation of doors, gates and chests is played over this by
 * the caller. Kept apart from the drawing so a test can hold every fixture to a frame that exists.
 */
export function fixtureFrame(type: FixtureDef['type'], open: boolean): string {
  if (type === 'plate' || type === 'switch' || type === 'vent') return open ? 'down' : 'up';
  // The reset post borrows the plate sprite and always shows it raised: it is never pressed down.
  if (type === 'resetpost') return 'up';
  if (type === 'element' || type === 'breakable') return open ? 'open' : 'closed';
  // The storage chest shares the chest sprite and stays shut: it is a counter, not a find.
  if (type === 'storage') return 'closed';
  if (type === 'door' || type === 'gate' || type === 'chest') return open ? 'open' : 'closed';
  if (type === 'torch') return open ? 'lit' : 'base';
  return 'base';
}
