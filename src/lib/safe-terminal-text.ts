// biome-ignore lint/complexity/useRegexLiterals: literal form triggers noControlCharactersInRegex
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]',
  'g',
);

export const safeTerminalText = (value: string): string =>
  value.replace(
    CONTROL_CHARS,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
