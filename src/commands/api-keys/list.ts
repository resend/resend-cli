import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderApiKeysTable } from './utils';

export const listApiKeysCommand = new Command('list')
  .alias('ls')
  .description(
    'List all API keys (IDs and names — tokens are never returned by this endpoint)',
  )
  .option('--limit <n>', 'Maximum number of API keys to return (1-100)', '10')
  .option(
    '--after <cursor>',
    'Cursor for forward pagination — list items after this ID',
  )
  .option(
    '--before <cursor>',
    'Cursor for backward pagination — list items before this ID',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"object":"list","has_more":false,"data":[{"id":"<id>","name":"<name>","created_at":"<date>","last_used_at":"<date>|null"}]}
  Tokens are never included in list responses.`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend api-keys list',
        'resend api-keys list --limit 25 --json',
        'resend api-keys list --after <cursor> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );
    await runList(
      {
        loading: 'Fetching API keys...',
        sdkCall: (resend) => resend.apiKeys.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderApiKeysTable(list.data));
          printPaginationHint(list, 'api-keys list', {
            limit,
            before: opts.before,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
          });
        },
      },
      globalOpts,
    );
  });
