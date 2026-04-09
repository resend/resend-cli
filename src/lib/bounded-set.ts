const createBoundedSet = <T>(maxSize: number) => {
  const inner = new Set<T>();

  const add = (value: T) => {
    if (inner.has(value)) {
      return;
    }
    if (inner.size >= maxSize) {
      const oldest = inner.values().next().value as T;
      inner.delete(oldest);
    }
    inner.add(value);
  };

  const has = (value: T): boolean => inner.has(value);

  const size = (): number => inner.size;

  return { add, has, size } as const;
};

export { createBoundedSet };
