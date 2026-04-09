const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F]',
  'g',
);

export const sanitizeForTerminal = (value: string): string =>
  value.replace(CONTROL_CHARS, '');
