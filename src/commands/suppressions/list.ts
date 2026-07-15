import { Command, Option } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderSuppressionsTable } from './utils';

export const listSuppressionsCommand = new Command('list')
  .alias('ls')
  .description('List suppressed email addresses')
  .option(
    '--limit <n>',
    'Maximum number of suppressions to return (1-100)',
    '10',
  )
  .option(
    '--after <cursor>',
    'Cursor for forward pagination — list items after this ID',
  )
  .option(
    '--before <cursor>',
    'Cursor for backward pagination — list items before this ID',
  )
  .addOption(
    new Option(
      '--origin <origin>',
      'Filter by how the address was suppressed',
    ).choices(['bounce', 'complaint', 'manual'] as const),
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"object":"list","has_more":false,"data":[{"object":"suppression","id":"<id>","email":"<email>","origin":"bounce|complaint|manual","source_id":"<id>|null","created_at":"<date>"}]}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend suppressions list',
        'resend suppressions list --origin bounce --json',
        'resend suppressions list --limit 25 --after <cursor> --json',
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
        loading: 'Fetching suppressions...',
        sdkCall: (resend) =>
          resend.suppressions.list({
            ...paginationOpts,
            ...(opts.origin && { origin: opts.origin }),
          }),
        onInteractive: (list) => {
          console.log(renderSuppressionsTable(list.data));
          printPaginationHint(list, 'suppressions list', {
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
