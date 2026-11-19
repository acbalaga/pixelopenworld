import { describe, expect, it } from 'vitest';
import { UI_BALANCE } from '../../src/content/balance/ui';
import { MessageRouter, noticeMs } from '../../src/ui/messages/router';

const B = UI_BALANCE.messages;

/** Runs the router for `ms` of wall time in 50 ms frames. */
function run(r: MessageRouter, from: number, ms: number, paused = false): number {
  let t = from;
  for (let i = 0; i < ms / 50; i++) {
    t += 50;
    r.update(t, paused);
  }
  return t;
}

describe('notices', () => {
  it('merge: the same key within the window adds a count', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'notice', text: 'Too heavy to carry', key: 'full' });
    r.post({ lane: 'notice', text: 'Too heavy to carry', key: 'full' });
    r.post({ lane: 'notice', text: 'Too heavy to carry', key: 'full' });
    expect(r.notices()).toHaveLength(1);
    expect(r.notices()[0]?.count).toBe(3);
  });

  it('the same key after the window is a new notice', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'notice', text: 'A', key: 'a' });
    run(r, 0, B.mergeMs + 100);
    r.post({ lane: 'notice', text: 'A', key: 'a' });
    expect(r.notices()).toHaveLength(2);
  });

  it('shows at most noticeMax at once, newest on top, and the rest wait their turn', () => {
    const r = new MessageRouter();
    r.update(0, false);
    for (const t of ['one', 'two', 'three']) r.post({ lane: 'notice', text: t });
    expect(r.notices().map((n) => n.text)).toEqual(['two', 'one']);
    const t = run(r, 0, noticeMs('one') + 100);
    expect(r.notices().map((n) => n.text)).toContain('three');
    run(r, t, noticeMs('three') + 100);
    expect(r.notices()).toHaveLength(0);
  });

  it('a longer text stays longer, up to the cap', () => {
    expect(noticeMs('short')).toBe(B.noticeBaseMs);
    expect(noticeMs('x'.repeat(60))).toBeGreaterThan(B.noticeBaseMs);
    expect(noticeMs('x'.repeat(600))).toBe(B.noticeCapMs);
  });

  it('tap to dismiss', () => {
    const r = new MessageRouter();
    r.post({ lane: 'notice', text: 'gone' });
    r.dismiss(r.notices()[0]!.id);
    expect(r.notices()).toHaveLength(0);
  });

  it('a hint stays until it is retracted, and posting it again does not stack it', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'hint', text: 'Drag to walk', key: 'hint.move' });
    const t = run(r, 0, 20_000);
    r.post({ lane: 'hint', text: 'Drag to walk', key: 'hint.move' });
    expect(r.notices()).toHaveLength(1);
    expect(r.notices()[0]?.hint).toBe(true);
    r.retract('hint.move');
    expect(r.notices()).toHaveLength(0);
    expect(t).toBeGreaterThan(0);
  });
});

describe('queueing while a panel is open', () => {
  it('nothing ages or shows while paused, and everything is there on release', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'notice', text: 'before' });
    r.update(50, true);
    r.post({ lane: 'notice', text: 'during' });
    r.post({ lane: 'banner', text: 'Rank up' });
    r.post({ lane: 'floater', text: 'Moss', amount: 2 });
    expect(r.notices()).toHaveLength(0);
    expect(r.banner()).toBeNull();
    expect(r.floaters()).toHaveLength(0);
    // A minute behind a panel costs the messages no time.
    let t = 50;
    for (let i = 0; i < 1200; i++) r.update((t += 50), true);
    r.update((t += 50), false);
    // The banner that queued behind the panel shows first, and the notices wait for it.
    expect(r.banner()?.text).toBe('Rank up');
    expect(r.floaters().map((f) => f.text)).toEqual(['+2 Moss']);
    run(r, t, B.bannerMs + 100);
    expect(
      r
        .notices()
        .map((n) => n.text)
        .sort(),
    ).toEqual(['before', 'during']);
  });
});

describe('banners', () => {
  it('show one at a time for bannerMs, in order, and notices wait while one shows', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'banner', text: 'first', tone: 'gold' });
    r.post({ lane: 'banner', text: 'second' });
    r.post({ lane: 'notice', text: 'waiting' });
    r.update(50, false);
    expect(r.banner()?.text).toBe('first');
    expect(r.banner()?.tone).toBe('gold');
    expect(r.notices()).toHaveLength(0);
    let t = run(r, 50, B.bannerMs - 400);
    expect(r.banner()?.text).toBe('first');
    t = run(r, t, 600);
    expect(r.banner()?.text).toBe('second');
    t = run(r, t, B.bannerMs + 100);
    expect(r.banner()).toBeNull();
    expect(r.notices().map((n) => n.text)).toEqual(['waiting']);
    // A banner and the notices are never both visible.
    expect(t).toBeGreaterThan(0);
  });
});

describe('floaters', () => {
  it('merge pickups of the same kind, build "+n text", and stack at most three', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'floater', text: 'Moss', key: 'moss', amount: 2 });
    r.post({ lane: 'floater', text: 'Moss', key: 'moss', amount: 3 });
    expect(r.floaters().map((f) => f.text)).toEqual(['+5 Moss']);
    for (const n of ['A', 'B', 'C', 'D']) r.post({ lane: 'floater', text: n, key: n, amount: 1 });
    expect(r.floaters()).toHaveLength(B.floaterStack);
  });

  it('cuts long text to 24 characters', () => {
    const r = new MessageRouter();
    r.post({ lane: 'floater', text: 'An Extremely Long Item Name Indeed', amount: 12 });
    expect(r.floaters()[0]!.text.length).toBeLessThanOrEqual(B.floaterChars);
  });

  it('fade after floaterMs', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'floater', text: 'Moss', amount: 1 });
    run(r, 0, B.floaterMs + 100);
    expect(r.floaters()).toHaveLength(0);
  });
});

describe('the System log', () => {
  it('keeps every notice, banner and pickup since login, even after they fade', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'notice', text: 'N1' });
    r.post({ lane: 'banner', text: 'B1' });
    r.post({ lane: 'floater', text: 'Moss', amount: 2 });
    r.post({ lane: 'tick', text: 'not logged' });
    run(r, 0, 30_000);
    expect(r.notices()).toHaveLength(0);
    expect(r.log().map((e) => e.text)).toEqual(['N1', 'B1', '+2 Moss']);
    expect(r.channels()).toEqual(['system']);
    expect(r.lines('system').map((l) => l.text)).toEqual(['N1', 'B1', '+2 Moss']);
  });

  it('a burst of the same notice is one log line with a count', () => {
    const r = new MessageRouter();
    r.update(0, false);
    for (let i = 0; i < 4; i++) r.post({ lane: 'notice', text: 'Locked', key: 'lock' });
    expect(r.log()).toHaveLength(1);
    expect(r.log()[0]?.count).toBe(4);
  });
});

describe('chat', () => {
  it('shows the newest two lines, counts unread while collapsed, and hides empty channels', () => {
    const r = new MessageRouter();
    r.update(0, false);
    expect(r.channels()).toEqual([]);
    for (const [from, text] of [
      ['Mira', 'one'],
      ['Tobo', 'two'],
      ['Wren', 'three'],
    ] as const)
      r.post({ lane: 'chat', from, text });
    expect(r.chatLane().map((l) => l.text)).toEqual(['two', 'three']);
    expect(r.unread).toBe(3);
    r.setChatSeen(true);
    expect(r.unread).toBe(0);
    r.post({ lane: 'chat', from: 'Mira', text: 'four' });
    expect(r.unread).toBe(0);
    expect(r.channels()).toEqual(['world']);
    r.post({ lane: 'chat', from: 'Hal', text: 'hi', channel: 'party' });
    expect(r.channels()).toEqual(['world', 'party']);
  });

  it('lines dim in the lane after chatShowMs and stay in their channel', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'chat', from: 'Mira', text: 'hello' });
    run(r, 0, B.chatShowMs + 100);
    expect(r.chatLane().map((l) => l.old)).toEqual([true]);
    expect(r.lines('world')).toHaveLength(1);
  });
});
