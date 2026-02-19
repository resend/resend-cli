import type { GlobalOpts } from './client';
import { outputError } from './output';

export function parseLimitOpt(raw: string, globalOpts: GlobalOpts): number {
  const limit = parseInt(raw, 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    outputError(
      { message: '--limit must be an integer between 1 and 100', code: 'invalid_limit' },
      { json: globalOpts.json }
    );
  }
  return limit;
}

export function buildPaginationOpts(limit: number, after?: string, before?: string) {
  return after ? { limit, after } : before ? { limit, before } : { limit };
}
