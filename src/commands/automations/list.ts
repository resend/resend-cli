import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderAutomationsTable } from './utils';

export const listAutomationsCommand = new Command('list')
  .alias('ls')
  .description('List all automations')
  .option(
    '--limit <n>',
    'Maximum number of automations to return (1-100)',
    '10',
  )
  .option(
    '--after <cursor>',
    'Return automations after this cursor (next page)',
  )
  .option(
    '--before <cursor>',
    'Return automations before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"list","data":[...],"has_more":true}',
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend automations list',
        'resend automations list --limit 25 --json',
        'resend automations list --after <cursor> --json',
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
        loading: 'Fetching automations...',
        sdkCall: (resend) => resend.automations.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderAutomationsTable(list.data));
          printPaginationHint(list, 'automations list', {
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
