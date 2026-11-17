import { describe, expect, it } from 'vitest';
import { checkHandle, HANDLE_MAX, HANDLE_MIN } from '../../src/shared/handle';

describe('handle rules', () => {
  it('accepts ordinary handles', () => {
    for (const h of ['Fred', 'mira_k', 'Ash-9', 'x'.repeat(HANDLE_MAX), 'abc', 'Pixel42'])
      expect(checkHandle(h), h).toBe('ok');
  });

  it('rejects the wrong length', () => {
    expect(checkHandle('ab')).toBe('short');
    expect(checkHandle('   ')).toBe('short');
    expect(checkHandle('x'.repeat(HANDLE_MAX + 1))).toBe('long');
    expect(checkHandle('x'.repeat(HANDLE_MIN))).toBe('ok');
  });

  it('rejects characters outside letters, digits, underscore and hyphen', () => {
    for (const h of ['has space', 'emoji\u{1F600}x', 'a.b.c', 'name!', 'ünï', 'a​b'])
      expect(checkHandle(h), h).toBe('chars');
  });

  it('rejects leading, trailing and doubled separators', () => {
    for (const h of ['_name', 'name-', '-x-y', 'a__b', 'a--b'])
      expect(checkHandle(h), h).toBe('edges');
  });

  it('rejects the short blocklist, including simple look-alikes', () => {
    for (const h of ['Admin', 'xxStaffxx', 'sh1t', 'F4ck'.replace('4', 'u'), 'SYSTEM_1'])
      expect(checkHandle(h), h).toBe('blocked');
    // Ordinary words that merely contain letters in a row are fine.
    expect(checkHandle('Classic')).toBe('ok');
  });
});
