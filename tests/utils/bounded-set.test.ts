import { describe, expect, it } from 'vitest';
import { createBoundedSet } from '../../src/utils/bounded-set';

describe('createBoundedSet', () => {
  it('tracks membership correctly', () => {
    const set = createBoundedSet<string>(5);
    set.add('a');
    set.add('b');

    expect(set.has('a')).toBe(true);
    expect(set.has('b')).toBe(true);
    expect(set.has('c')).toBe(false);
  });

  it('evicts oldest entries when capacity is exceeded', () => {
    const set = createBoundedSet<string>(3);
    set.add('a');
    set.add('b');
    set.add('c');
    set.add('d');

    expect(set.has('a')).toBe(false);
    expect(set.has('b')).toBe(true);
    expect(set.has('c')).toBe(true);
    expect(set.has('d')).toBe(true);
    expect(set.size()).toBe(3);
  });

  it('refreshes recently re-added entries to prevent premature eviction', () => {
    const set = createBoundedSet<string>(3);
    set.add('a');
    set.add('b');
    set.add('c');

    set.add('a');

    set.add('d');

    expect(set.has('a')).toBe(true);
    expect(set.has('b')).toBe(false);
    expect(set.has('c')).toBe(true);
    expect(set.has('d')).toBe(true);
  });

  it('does not exceed the configured capacity', () => {
    const set = createBoundedSet<number>(5);
    const entries = Array.from({ length: 20 }, (_, i) => i);
    entries.forEach((n) => {
      set.add(n);
    });

    expect(set.size()).toBe(5);

    const retained = entries.filter((n) => set.has(n));
    expect(retained).toEqual([15, 16, 17, 18, 19]);
  });

  it('handles duplicate adds without growing', () => {
    const set = createBoundedSet<string>(3);
    set.add('x');
    set.add('x');
    set.add('x');

    expect(set.size()).toBe(1);
    expect(set.has('x')).toBe(true);
  });

  it('refreshes LRU position on has() checks', () => {
    const set = createBoundedSet<string>(3);
    set.add('a');
    set.add('b');
    set.add('c');

    // Touch 'a' via has() to refresh its position
    expect(set.has('a')).toBe(true);

    // 'b' is now the oldest — should be evicted
    set.add('d');
    expect(set.has('b')).toBe(false);
    expect(set.has('a')).toBe(true);
    expect(set.has('c')).toBe(true);
    expect(set.has('d')).toBe(true);
  });

  it('throws on invalid maxSize', () => {
    expect(() => createBoundedSet(0)).toThrow(RangeError);
    expect(() => createBoundedSet(-1)).toThrow(RangeError);
    expect(() => createBoundedSet(3.5)).toThrow(RangeError);
    expect(() => createBoundedSet(Number.NaN)).toThrow(RangeError);
    expect(() => createBoundedSet(Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
  });

  it('uses default capacity when none is provided', () => {
    const set = createBoundedSet<number>();
    const entries = Array.from({ length: 10_001 }, (_, i) => i);
    entries.forEach((n) => {
      set.add(n);
    });

    expect(set.size()).toBe(10_000);
    expect(set.has(0)).toBe(false);
    expect(set.has(10_000)).toBe(true);
  });
});
