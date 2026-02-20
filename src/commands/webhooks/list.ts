import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { parseLimitOpt, buildPaginationOpts, printPaginationHint } from '../../lib/pagination';
import { isInteractive } from '../../lib/tty';
import { renderWebhooksTable } from './utils';

export const listWebhooksCommand = new Command('list')
  .description('List all registered webhook endpoints')
  .option('--limit <n>', 'Maximum number of webhooks to return (1-100)', '10')
  .option('--after <cursor>', 'Return webhooks after this cursor (next page)')
  .option('--before <cursor>', 'Return webhooks before this cursor (previous page)')
  .addHelpText(
    'after',
    `
Pagination: use --after or --before with a webhook ID as the cursor.
Only one of --after or --before may be used at a time.
The response includes has_more: true when additional pages exist.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"list","data":[{"id":"<uuid>","endpoint":"<url>","events":["<event>"],"status":"enabled","created_at":"<iso-date>"}],"has_more":false}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | invalid_limit | list_error

Examples:
  $ resend webhooks list
  $ resend webhooks list --limit 25 --json
  $ resend webhooks list --after wh_abc123 --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    const spinner = createSpinner('Fetching webhooks...');

    try {
      const { data, error } = await resend.webhooks.list(paginationOpts);

      if (error) {
        spinner.fail('Failed to list webhooks');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Webhooks fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderWebhooksTable(list.data));
        printPaginationHint(list);
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list webhooks');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'list_error' }, { json: globalOpts.json });
    }
  });
