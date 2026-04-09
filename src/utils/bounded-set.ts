export type BoundedSet<T> = {
  readonly has: (value: T) => boolean;
  readonly add: (value: T) => void;
  readonly size: () => number;
};

const DEFAULT_MAX_SIZE = 10_000;

export const createBoundedSet = <T>(
  maxSize: number = DEFAULT_MAX_SIZE,
): BoundedSet<T> => {
  const map = new Map<T, true>();

  const evict = () => {
    const oldest = map.keys().next();
    if (!oldest.done) {
      map.delete(oldest.value);
    }
  };

  return {
    has: (value: T) => map.has(value),

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
