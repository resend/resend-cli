import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { parseLimitOpt, buildPaginationOpts, printPaginationHint } from '../../lib/pagination';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { renderDomainsTable } from './utils';

export const listDomainsCommand = new Command('list')
  .description('List all domains')
  .option('--limit <n>', 'Maximum number of domains to return (1-100)', '10')
  .option('--after <cursor>', 'Return domains after this cursor (next page)')
  .option('--before <cursor>', 'Return domains before this cursor (previous page)')
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"list","data":[...],"has_more":true}',
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend domains list',
        'resend domains list --limit 25 --json',
        'resend domains list --after <cursor> --json',
      ],
    })
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    const spinner = createSpinner('Fetching domains...');

    try {
      const { data, error } = await resend.domains.list(paginationOpts);

      if (error) {
        spinner.fail('Failed to list domains');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Domains fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderDomainsTable(list.data));
        printPaginationHint(list);
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list domains');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'list_error' },
        { json: globalOpts.json }
      );
    }
  });
