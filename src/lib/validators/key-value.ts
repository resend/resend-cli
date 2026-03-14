import type { GlobalOpts } from '../client';
import { outputError } from '../formatters';

/**
 * Parse key=value pairs from an array of strings (e.g. --headers, --tags).
 * Exits via outputError if any item does not contain '=' or has empty key.
 * @returns Array of [key, value] tuples
 */
export function parseKeyValuePairs(
  strings: string[],
  opts: { optionName: string; code: string },
  globalOpts: GlobalOpts,
): [string, string][] {
  return strings.map((s) => {
    const eq = s.indexOf('=');
    if (eq < 1) {
      outputError(
        {
          message: `Invalid ${opts.optionName} format: "${s}". Expected key=value.`,
          code: opts.code,
        },
        { json: globalOpts.json },
      );
    }
    return [s.slice(0, eq), s.slice(eq + 1)];
  });
}
