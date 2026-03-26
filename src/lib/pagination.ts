import type { GlobalOpts } from './client';
import { maskKey } from './config';
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
  after: string | undefined,
  before: string | undefined,
  globalOpts: GlobalOpts,
) {
  if (after !== undefined && before !== undefined) {
    outputError(
      {
        message:
          'Cannot use --after and --before together. Pass only one cursor.',
        code: 'invalid_pagination',
      },
      { json: globalOpts.json },
    );
  }
  return after ? { limit, after } : before ? { limit, before } : { limit };
}

export function printPaginationHint(
  list: {
    has_more: boolean;
    data: Array<{ id: string }>;
  },
  command: string,
  opts: { limit?: number; before?: string; apiKey?: string; profile?: string },
): void {
  if (!list.has_more || list.data.length === 0) {
    return;
  }

  // API returns items newest-first; for backward pagination the next cursor
  // is the first item, for forward pagination it's the last item.
  const backward = Boolean(opts.before);
  const cursor = backward
    ? list.data[0].id
    : list.data[list.data.length - 1].id;
  const flag = backward ? '--before' : '--after';
  const limitFlag = opts.limit ? ` --limit ${opts.limit}` : '';
  const apiKeyFlag = opts.apiKey ? ` --api-key ${maskKey(opts.apiKey)}` : '';
  const profileFlag = opts.profile ? ` --profile ${opts.profile}` : '';

  console.log(
    `\nFetch the next page:\n$ resend ${command} ${flag} ${cursor}${limitFlag}${apiKeyFlag}${profileFlag}`,
  );
}
