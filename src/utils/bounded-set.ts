export type BoundedSet<T> = {
  readonly has: (value: T) => boolean;
  readonly add: (value: T) => void;
  readonly size: () => number;
};

const DEFAULT_MAX_SIZE = 10_000;

export const createBoundedSet = <T>(
  maxSize: number = DEFAULT_MAX_SIZE,
): BoundedSet<T> => {
  if (!Number.isInteger(maxSize) || maxSize < 1) {
    throw new RangeError(`maxSize must be a positive integer, got ${maxSize}`);
  }

  const map = new Map<T, true>();

  const evict = () => {
    const oldest = map.keys().next();
    if (!oldest.done) {
      map.delete(oldest.value);
    }
  };

  return {
    has: (value: T) => {
      if (map.has(value)) {
        map.delete(value);
        map.set(value, true);
        return true;
      }
      return false;
    },

    add: (value: T) => {
      if (map.has(value)) {
        map.delete(value);
        map.set(value, true);
        return;
      }
      if (map.size >= maxSize) {
        evict();
      }
      map.set(value, true);
    },

    size: () => map.size,
  };
};
