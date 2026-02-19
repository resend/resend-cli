import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { renderTopicsTable, contactIdentifier } from './utils';

export const listContactTopicsCommand = new Command('topics')
  .description("List a contact's topic subscriptions")
  .argument('<id>', 'Contact UUID or email address')
  .addHelpText(
    'after',
    `
The <id> argument accepts either a UUID or an email address.

Topics control which broadcast email types a contact receives.
  subscription values: "opt_in" (receiving) | "opt_out" (not receiving)

Use "resend contacts update-topics <id>" to change subscription statuses.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"list","data":[{"id":"...","name":"Product Updates","description":"...","subscription":"opt_in"}],"has_more":false}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | list_error

Examples:
  $ resend contacts topics 479e3145-dd38-4932-8c0c-e58b548c9e76
  $ resend contacts topics user@example.com
  $ resend contacts topics 479e3145-dd38-4932-8c0c-e58b548c9e76 --json`
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching topic subscriptions...');

    try {
      // ListContactTopicsBaseOptions uses optional { id?, email? } (not a discriminated
      // union), so contactIdentifier's result is directly assignable without a cast.
      const { data, error } = await resend.contacts.topics.list(contactIdentifier(id));

      if (error) {
        spinner.fail('Failed to list topic subscriptions');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Topic subscriptions fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderTopicsTable(list.data));
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list topic subscriptions');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'list_error' }, { json: globalOpts.json });
    }
  });
