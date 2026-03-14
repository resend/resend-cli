import type { GlobalOpts } from '../client';
import { outputError } from '../formatters';

/**
 * Parse JSON string and validate shape. Exits via outputError on parse or validation failure.
 */
export function parseJson<T>(
  raw: string,
  guard: (value: unknown) => value is T,
  opts: { message: string; code: string },
  globalOpts: GlobalOpts,
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    outputError(
      { message: opts.message, code: opts.code },
      { json: globalOpts.json },
    );
    return undefined as never;
  }
  if (!guard(parsed)) {
    outputError(
      { message: opts.message, code: opts.code },
      { json: globalOpts.json },
    );
  }
  return parsed;
}
