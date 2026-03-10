import type { GlobalOpts } from './client';
import { outputError } from './output';

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

export function buildPaginationOpts(
  limit: number,
  after?: string,
  before?: string,
) {
  return after ? { limit, after } : before ? { limit, before } : { limit };
}

export function printPaginationHint(list: {
  has_more: boolean;
  data: Array<{ id: string }>;
}): void {
  if (list.has_more && list.data.length > 0) {
    const last = list.data[list.data.length - 1];
    console.log(
      `\nMore results available. Use --after ${last.id} to fetch the next page.`,
    );
  }
}
