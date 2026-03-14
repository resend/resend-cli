import type { GlobalOpts } from '../client';
import { outputError } from '../formatters';

export function parseLimitOpt(raw: string, globalOpts: GlobalOpts): number {
  const limit = parseInt(raw, 10);
  if (Number.isNaN(limit) || limit < 1 || limit > 100) {
    outputError(
      {
        message: '--limit must be an integer between 1 and 100',
        code: 'invalid_limit',
      },
      { json: globalOpts.json },
    );
  }
  return limit;
}
