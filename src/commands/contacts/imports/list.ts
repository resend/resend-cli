import { Command, Option } from '@commander-js/extra-typings';
import type { ListContactImportsResponseSuccess } from 'resend';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../../lib/pagination';
import { renderContactImportsTable } from './utils';

export const listContactImportsCommand = new Command('list')
  .alias('ls')
  .description('List contact imports')
  .option(
    '--limit <n>',
    'Maximum number of contact imports to return (1-100)',
    '10',
  )
  .option('--after <cursor>', 'Return imports after this cursor (next page)')
  .option(
    '--before <cursor>',
    'Return imports before this cursor (previous page)',
  )
  .addOption(
    new Option('--status <status>', 'Filter by import status').choices([
      'queued',
      'in_progress',
      'completed',
      'failed',
    ] as const),
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Pagination: use --after or --before with a contact import ID as the cursor.
  Only one of --after or --before may be used at a time.
  The response includes has_more: true when additional pages exist.`,
      output: `  {"object":"list","has_more":false,"data":[{"object":"contact_import","id":"...","status":"completed","counts":{"total":1200,"created":800,"updated":300,"skipped":75,"failed":25}}]}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend contacts imports list',
        'resend contacts imports list --status completed --json',
        'resend contacts imports list --after 479e3145-dd38-476b-932c-529ceb705947 --json',
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
    await runList<ListContactImportsResponseSuccess>(
      {
        loading: 'Fetching contact imports...',
        sdkCall: (resend) =>
          resend.contacts.imports.list({
            ...paginationOpts,
            ...(opts.status && { status: opts.status }),
          }),
        onInteractive: (list) => {
          console.log(renderContactImportsTable(list.data));
          printPaginationHint(list, 'contacts imports list', {
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
