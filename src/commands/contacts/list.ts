import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { parseLimitOpt, buildPaginationOpts } from '../../lib/pagination';
import { isInteractive } from '../../lib/tty';
import { renderContactsTable } from './utils';

export const listContactsCommand = new Command('list')
  .description('List all contacts')
  .option('--limit <n>', 'Maximum number of contacts to return (1-100)', '10')
  .option('--after <cursor>', 'Return contacts after this cursor (next page)')
  .option('--before <cursor>', 'Return contacts before this cursor (previous page)')
  .addHelpText(
    'after',
    `
Contacts are global — they are not scoped to audiences or segments since the 2025 migration.

Pagination: use --after or --before with a contact ID as the cursor.
  Only one of --after or --before may be used at a time.
  The response includes has_more: true when additional pages exist.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"list","data":[{"id":"...","email":"...","first_name":"...","last_name":"...","unsubscribed":false}],"has_more":false}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | invalid_limit | list_error

Examples:
  $ resend contacts list
  $ resend contacts list --limit 25 --json
  $ resend contacts list --after 479e3145-dd38-4932-8c0c-e58b548c9e76 --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    const spinner = createSpinner('Fetching contacts...', 'braille');

    try {
      const { data, error } = await resend.contacts.list(paginationOpts);

      if (error) {
        spinner.fail('Failed to list contacts');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contacts fetched');

      if (!globalOpts.json && isInteractive()) {
        console.log(renderContactsTable(data!.data));
        if (data!.has_more && data!.data.length > 0) {
          const last = data!.data[data!.data.length - 1];
          console.log(`\nMore results available. Use --after ${last.id} to fetch the next page.`);
        }
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list contacts');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'list_error' }, { json: globalOpts.json });
    }
  });
