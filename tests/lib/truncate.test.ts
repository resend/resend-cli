import { describe, expect, it } from 'vitest';
import { truncate } from '../../src/lib/truncate';

const LONE_SURROGATE =
  /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

describe('truncate', () => {
  it('returns the value unchanged when it fits', () => {
    expect(truncate('hello', 5)).toBe('hello');
    expect(truncate('', 5)).toBe('');
  });

  it('cuts to max characters including the ellipsis', () => {
    const out = truncate('abcdefghij', 8);
    expect(out).toBe('abcde...');
    expect(out).toHaveLength(8);
  });

  it('does not split a surrogate pair at the cut point', () => {
    // 46 characters, then an emoji whose high surrogate lands at index 46.
    const value = `${'a'.repeat(46)}😀${'b'.repeat(10)}`;
    const out = truncate(value, 50);
    expect(out).toBe(`${'a'.repeat(46)}...`);
    expect(out).not.toMatch(LONE_SURROGATE);
  });

  it('keeps a whole emoji that ends exactly at the cut point', () => {
    const value = `${'a'.repeat(45)}😀${'b'.repeat(10)}`;
    expect(truncate(value, 50)).toBe(`${'a'.repeat(45)}😀...`);
  });

  it('hard-cuts without an ellipsis when max is not larger than it', () => {
    expect(truncate('abcdef', 2)).toBe('ab');
    expect(truncate('abcdef', 3)).toBe('abc');
    expect(truncate('abcdef', 0)).toBe('');
    expect(truncate('abcdef', 4)).toBe('a...');
  });

  describe.each([
    ['a family emoji', '👨‍👩‍👧'],
    ['a flag', '🇺🇸'],
    ['a skin-tone emoji', '👍🏽'],
  ])('with %s at the cut point', (_name, emoji) => {
    it.each([
      // The emoji straddles the cut at max 50 (budget 47), at every offset
      // from fully inside the budget to fully outside it.
      ...Array.from(
        { length: emoji.length + 1 },
        (_, i) => 47 - emoji.length + i,
      ),
    ])('keeps it whole or drops it whole with %i leading characters', (lead) => {
      const value = `${'a'.repeat(lead)}${emoji}${'b'.repeat(20)}`;
      const out = truncate(value, 50);
      expect(out).not.toMatch(LONE_SURROGATE);
      expect(out.endsWith('...')).toBe(true);
      const body = out.slice(0, -3);
      const fits = lead + emoji.length <= 47;
      expect(body).toBe(
        fits ? `${'a'.repeat(lead)}${emoji}` : 'a'.repeat(lead),
      );
    });
  });
});
