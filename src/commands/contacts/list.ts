import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderContactsTable } from './utils';

export const listContactsCommand = new Command('list')
  .alias('ls')
  .description('List all contacts')
  .option('--limit <n>', 'Maximum number of contacts to return (1-100)', '10')
  .option('--after <cursor>', 'Return contacts after this cursor (next page)')
  .option(
    '--before <cursor>',
    'Return contacts before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Contacts are global — they are not scoped to audiences or segments since the 2025 migration.

Pagination: use --after or --before with a contact ID as the cursor.
  Only one of --after or --before may be used at a time.
  The response includes has_more: true when additional pages exist.`,
      output: `  {"object":"list","data":[{"id":"...","email":"...","first_name":"...","last_name":"...","unsubscribed":false}],"has_more":false}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend contacts list',
        'resend contacts list --limit 25 --json',
        'resend contacts list --after 479e3145-dd38-4932-8c0c-e58b548c9e76 --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);
    await runList(
      {
        spinner: {
          loading: 'Fetching contacts...',
          success: 'Contacts fetched',
          fail: 'Failed to list contacts',
        },
        sdkCall: (resend) => resend.contacts.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderContactsTable(list.data));
          printPaginationHint(list);
        },
      },
      globalOpts,
    );
  });
