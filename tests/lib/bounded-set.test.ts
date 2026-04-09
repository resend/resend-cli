import { describe, expect, it } from 'vitest';
import { createBoundedSet } from '../../src/lib/bounded-set';

describe('createBoundedSet', () => {
  it('tracks added values with has()', () => {
    const set = createBoundedSet<string>(5);
    set.add('a');
    set.add('b');

    expect(set.has('a')).toBe(true);
    expect(set.has('b')).toBe(true);
    expect(set.has('c')).toBe(false);
  });

  it('reports correct size', () => {
    const set = createBoundedSet<string>(5);
    set.add('a');
    set.add('b');

    expect(set.size()).toBe(2);
  });

  it('does not duplicate existing values', () => {
    const set = createBoundedSet<string>(5);
    set.add('a');
    set.add('a');

    expect(set.size()).toBe(1);
  });

  it('evicts oldest entry when exceeding maxSize', () => {
    const set = createBoundedSet<string>(3);
    set.add('a');
    set.add('b');
    set.add('c');
    set.add('d');

    expect(set.size()).toBe(3);
    expect(set.has('a')).toBe(false);
    expect(set.has('b')).toBe(true);
    expect(set.has('c')).toBe(true);
    expect(set.has('d')).toBe(true);
  });

  it('evicts in FIFO order across multiple overflows', () => {
    const set = createBoundedSet<number>(2);
    set.add(1);
    set.add(2);
    set.add(3);

    expect(set.has(1)).toBe(false);
    expect(set.has(2)).toBe(true);
    expect(set.has(3)).toBe(true);

    set.add(4);

    expect(set.has(2)).toBe(false);
    expect(set.has(3)).toBe(true);
    expect(set.has(4)).toBe(true);
  });

  it('handles maxSize of 1', () => {
    const set = createBoundedSet<string>(1);
    set.add('a');

    expect(set.has('a')).toBe(true);
    expect(set.size()).toBe(1);

    set.add('b');

    expect(set.has('a')).toBe(false);
    expect(set.has('b')).toBe(true);
    expect(set.size()).toBe(1);
  });

  it('re-adding existing value does not evict', () => {
    const set = createBoundedSet<string>(2);
    set.add('a');
    set.add('b');
    set.add('a');

    expect(set.has('a')).toBe(true);
    expect(set.has('b')).toBe(true);
    expect(set.size()).toBe(2);
  });
});
