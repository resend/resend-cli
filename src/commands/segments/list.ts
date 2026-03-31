import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderSegmentsTable } from './utils';

export const listSegmentsCommand = new Command('list')
  .alias('ls')
  .description('List all segments')
  .option('--limit <n>', 'Maximum number of segments to return (1-100)', '10')
  .option('--after <cursor>', 'Return segments after this cursor (next page)')
  .option(
    '--before <cursor>',
    'Return segments before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Pagination: use --after or --before with a segment ID as the cursor.
  Only one of --after or --before may be used at a time.
  The response includes has_more: true when additional pages exist.

Use "resend segments list" to discover segment IDs for use with broadcasts
or "resend contacts add-segment".`,
      output: `  {"object":"list","data":[{"id":"<uuid>","name":"<name>","created_at":"<iso-date>"}],"has_more":false}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend segments list',
        'resend segments list --limit 25 --json',
        'resend segments list --after 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
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
        loading: 'Fetching segments...',
        sdkCall: (resend) => resend.segments.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderSegmentsTable(list.data));
          printPaginationHint(list, 'segments list', {
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
