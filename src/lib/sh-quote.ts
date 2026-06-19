export const shQuote = (value: string): string =>
  `'${value.replace(/'/g, "'\\''")}'`;
