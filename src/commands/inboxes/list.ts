import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderInboxesTable } from './utils';

export const listInboxesCommand = new Command('list')
  .alias('ls')
  .description('List all inboxes')
  .option('--limit <n>', 'Maximum number of inboxes to return (1-100)', '10')
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
      output: `  {"object":"list","has_more":false,"data":[{"id":"<uuid>","name":"<name>|null","email_address":"<address>","unread":0,"last_received":"<date>|null"}]}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend inboxes list',
        'resend inboxes list --json',
        'resend inboxes list --limit 25 --after <cursor> --json',
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
        loading: 'Fetching inboxes...',
        sdkCall: (resend) => resend.inboxes.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderInboxesTable(list.data));
          printPaginationHint(list, 'inboxes list', {
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
