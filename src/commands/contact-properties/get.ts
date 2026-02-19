import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const getContactPropertyCommand = new Command('get')
  .description('Retrieve a contact property definition by ID')
  .argument('<id>', 'Contact property UUID')
  .addHelpText(
    'after',
    `
Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {
    "object": "contact_property",
    "id": "<uuid>",
    "key": "company_name",
    "type": "string",
    "fallbackValue": null,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | fetch_error

Examples:
  $ resend contact-properties get prop_abc123
  $ resend contact-properties get prop_abc123 --json`
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching contact property...');

    try {
      const { data, error } = await resend.contactProperties.get(id);

      if (error) {
        spinner.fail('Failed to fetch contact property');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contact property fetched');

      if (!globalOpts.json && isInteractive()) {
        const d = data!;
        console.log(`\n${d.key} (${d.type})`);
        console.log(`ID: ${d.id}`);
        console.log(`Created: ${d.createdAt}`);
        console.log(`Fallback value: ${d.fallbackValue ?? '(none)'}`);
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to fetch contact property');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'fetch_error' }, { json: globalOpts.json });
    }
  });
