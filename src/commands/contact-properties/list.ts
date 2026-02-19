import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { parseLimitOpt, buildPaginationOpts } from '../../lib/pagination';
import { isInteractive } from '../../lib/tty';
import { renderContactPropertiesTable } from './utils';

export const listContactPropertiesCommand = new Command('list')
  .description('List all contact property definitions')
  .option('--limit <n>', 'Maximum number of contact properties to return (1-100)', '10')
  .option('--after <cursor>', 'Return contact properties after this cursor (next page)')
  .option('--before <cursor>', 'Return contact properties before this cursor (previous page)')
  .addHelpText(
    'after',
    `
Pagination: use --after or --before with a contact property ID as the cursor.
  Only one of --after or --before may be used at a time.
  The response includes has_more: true when additional pages exist.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {
    "object": "list",
    "has_more": false,
    "data": [
      { "id": "<uuid>", "key": "company_name", "type": "string", "fallbackValue": null, "createdAt": "..." }
    ]
  }

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | invalid_limit | list_error

Examples:
  $ resend contact-properties list
  $ resend contact-properties list --limit 25 --json
  $ resend contact-properties list --after prop_abc123 --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    const spinner = createSpinner('Fetching contact properties...');

    try {
      const { data, error } = await resend.contactProperties.list(paginationOpts);

      if (error) {
        spinner.fail('Failed to list contact properties');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contact properties fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderContactPropertiesTable(list.data));
        if (list.has_more && list.data.length > 0) {
          const last = list.data[list.data.length - 1];
          console.log(`\nMore results available. Use --after ${last.id} to fetch the next page.`);
        }
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list contact properties');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'list_error' }, { json: globalOpts.json });
    }
  });
