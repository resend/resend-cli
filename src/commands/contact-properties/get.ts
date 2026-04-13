import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { contactPropertyPickerConfig } from './utils';

export const getContactPropertyCommand = new Command('get')
  .description('Retrieve a contact property definition by ID')
  .argument('[id]', 'Contact property UUID')
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
        'resend contact-properties get b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d',
        'resend contact-properties get b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactPropertyPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching contact property...',
        sdkCall: (resend) => resend.contactProperties.get(id),
        onInteractive: (data) => {
          console.log(`${data.key} (${data.type})`);
          console.log(`ID: ${data.id}`);
          console.log(`Created: ${data.createdAt}`);
          console.log(`Fallback value: ${data.fallbackValue ?? '(none)'}`);
        },
      },
      globalOpts,
    );
  });
