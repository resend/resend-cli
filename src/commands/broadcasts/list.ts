import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { parseLimitOpt, buildPaginationOpts } from '../../lib/pagination';
import { isInteractive } from '../../lib/tty';
import { renderBroadcastsTable } from './utils';

export const listBroadcastsCommand = new Command('list')
  .description('List broadcasts — returns summary objects (use "get <id>" for full details including html/text)')
  .option('--limit <n>', 'Maximum number of results to return (1–100, default 20)', '20')
  .option('--after <cursor>', 'Cursor for forward pagination — list items after this ID')
  .option('--before <cursor>', 'Cursor for backward pagination — list items before this ID')
  .addHelpText(
    'after',
    `
Note: List results include name, status, created_at, and id only.
To retrieve full details (html, from, subject), use: resend broadcasts get <id>

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"list","has_more":false,"data":[{"id":"...","name":"...","status":"draft|queued|sent","created_at":"..."}]}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | invalid_limit | list_error

Examples:
  $ resend broadcasts list
  $ resend broadcasts list --limit 5
  $ resend broadcasts list --after bcast_abc --limit 10
  $ resend broadcasts list --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    const spinner = createSpinner('Fetching broadcasts...');

    try {
      const { data, error } = await resend.broadcasts.list(paginationOpts);

      if (error) {
        spinner.fail('Failed to list broadcasts');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Broadcasts fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderBroadcastsTable(list.data));
        if (list.has_more && list.data.length > 0) {
          const last = list.data[list.data.length - 1];
          console.log(`\nMore results available. Use --after ${last.id} to fetch the next page.`);
        }
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list broadcasts');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'list_error' },
        { json: globalOpts.json }
      );
    }
  });
