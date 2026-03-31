import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderLogsTable } from './utils';

export const listLogsCommand = new Command('list')
  .alias('ls')
  .description('List API request logs')
  .option('--limit <n>', 'Maximum number of logs to return (1-100)', '10')
  .option('--after <cursor>', 'Return logs after this cursor (next page)')
  .option('--before <cursor>', 'Return logs before this cursor (previous page)')
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  {"object":"list","data":[...],"has_more":true}\n  The list response does not include request/response bodies — use "resend logs get <id>" for that.',
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend logs list',
        'resend logs list --limit 25 --json',
        'resend logs list --after <cursor> --json',
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
        loading: 'Fetching logs...',
        sdkCall: (resend) => resend.logs.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderLogsTable(list.data));
          printPaginationHint(list, 'logs list', {
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
