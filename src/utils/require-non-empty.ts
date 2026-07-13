export const requireNonEmpty = (
  value: string | undefined,
  source: string,
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value.trim().length === 0) {
    throw new Error(
      `${source} is set but empty. Provide a non-empty value or remove it.`,
    );
  }
  return value;
};
