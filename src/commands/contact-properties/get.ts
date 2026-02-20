import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const getContactPropertyCommand = new Command('get')
  .description('Retrieve a contact property definition by ID')
  .argument('<id>', 'Contact property UUID')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {
    "object": "contact_property",
    "id": "<uuid>",
    "key": "company_name",
    "type": "string",
    "fallbackValue": null,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend contact-properties get prop_abc123',
        'resend contact-properties get prop_abc123 --json',
      ],
    }),
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const data = await withSpinner(
      { loading: 'Fetching contact property...', success: 'Contact property fetched', fail: 'Failed to fetch contact property' },
      () => resend.contactProperties.get(id),
      'fetch_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`\n${data.key} (${data.type})`);
      console.log(`ID: ${data.id}`);
      console.log(`Created: ${data.createdAt}`);
      console.log(`Fallback value: ${data.fallbackValue ?? '(none)'}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
