import { stripVTControlCharacters } from 'node:util';

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — this regex strips dangerous C0 control chars
const DANGEROUS_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]|\r(?!\n)/g;

export const safeTerminalText = (value: unknown): string =>
  stripVTControlCharacters(String(value)).replace(DANGEROUS_CONTROL_CHARS, '');

export function deepSanitize<T>(value: T): T {
  if (typeof value === 'string') {
    return safeTerminalText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(deepSanitize) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepSanitize(v)]),
    ) as T;
  }
  return value;
}
