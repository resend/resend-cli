import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderWebhooksTable } from './utils';

export const listWebhooksCommand = new Command('list')
  .alias('ls')
  .description('List all registered webhook endpoints')
  .option('--limit <n>', 'Maximum number of webhooks to return (1-100)', '10')
  .option('--after <cursor>', 'Return webhooks after this cursor (next page)')
  .option(
    '--before <cursor>',
    'Return webhooks before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Pagination: use --after or --before with a webhook ID as the cursor.
Only one of --after or --before may be used at a time.
The response includes has_more: true when additional pages exist.`,
      output: `  {"object":"list","data":[{"id":"<uuid>","endpoint":"<url>","events":["<event>"],"status":"enabled","created_at":"<iso-date>"}],"has_more":false}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend webhooks list',
        'resend webhooks list --limit 25 --json',
        'resend webhooks list --after wh_abc123 --json',
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
        loading: 'Fetching webhooks...',
        sdkCall: (resend) => resend.webhooks.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderWebhooksTable(list.data));
          printPaginationHint(list, 'webhooks list', {
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
