import { stripVTControlCharacters } from 'node:util';

const C0_C1_REGEX = new RegExp('[\\x00-\\x1f\\x7f-\\x9f]', 'g');

export const sanitizeTerminalText = (value: string): string =>
  stripVTControlCharacters(value).replace(C0_C1_REGEX, '');
