import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderEventsTable } from './utils';

export const listEventsCommand = new Command('list')
  .alias('ls')
  .description('List all events')
  .option('--limit <n>', 'Maximum number of events to return (1-100)', '10')
  .option('--after <cursor>', 'Return events after this cursor (next page)')
  .option(
    '--before <cursor>',
    'Return events before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"list","data":[...],"has_more":true}',
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend events list',
        'resend events list --limit 25 --json',
        'resend events list --after <cursor> --json',
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
        loading: 'Fetching events...',
        sdkCall: (resend) => resend.events.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderEventsTable(list.data));
          printPaginationHint(list, 'events list', {
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
