import { stripVTControlCharacters } from 'node:util';

const DANGEROUS_CONTROL_CHARS = new RegExp(
  '[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]',
  'g',
);

export const safeTerminalText = (value: unknown): string =>
  stripVTControlCharacters(String(value)).replace(DANGEROUS_CONTROL_CHARS, '');
