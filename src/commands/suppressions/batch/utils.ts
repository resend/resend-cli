import type { GlobalOpts } from '../../../lib/client';
import { outputError } from '../../../lib/output';

// Parse a batch file into a list of non-empty strings (emails or IDs).
// Exits with a formatted error when the content is not a JSON array of strings.
export function readEmailList(raw: string, globalOpts: GlobalOpts): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    outputError(
      { message: 'File content is not valid JSON.', code: 'invalid_json' },
      { json: globalOpts.json },
    );
  }

  if (!Array.isArray(parsed)) {
    outputError(
      {
        message: 'File content must be a JSON array of strings.',
        code: 'invalid_format',
      },
      { json: globalOpts.json },
    );
  }

  const items = parsed as unknown[];
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'string' || items[i] === '') {
      outputError(
        {
          message: `Item at index ${i} must be a non-empty string.`,
          code: 'invalid_format',
        },
        { json: globalOpts.json },
      );
    }
  }

  return items as string[];
}
