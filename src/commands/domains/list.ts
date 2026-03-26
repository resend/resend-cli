import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderDomainsTable } from './utils';

export const listDomainsCommand = new Command('list')
  .alias('ls')
  .description('List all domains')
  .option('--limit <n>', 'Maximum number of domains to return (1-100)', '10')
  .option('--after <cursor>', 'Return domains after this cursor (next page)')
  .option(
    '--before <cursor>',
    'Return domains before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  {"object":"list","data":[...],"has_more":true}\n  The list response does not include DNS records — use "resend domains get <id>" for that.',
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend domains list',
        'resend domains list --limit 25 --json',
        'resend domains list --after <cursor> --json',
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
        spinner: {
          loading: 'Fetching domains...',
          success: 'Domains fetched',
          fail: 'Failed to list domains',
        },
        sdkCall: (resend) => resend.domains.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderDomainsTable(list.data));
          printPaginationHint(list, 'domains list', {
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
