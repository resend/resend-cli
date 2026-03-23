import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { contactPickerConfig } from './utils';

export const getContactCommand = new Command('get')
  .description('Retrieve a contact by ID or email address')
  .argument(
    '[id]',
    'Contact UUID or email address — both are accepted by the API',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {\n    "object": "contact",\n    "id": "<uuid>",\n    "email": "user@example.com",\n    "first_name": "Jane",\n    "last_name": "Smith",\n    "created_at": "2026-01-01T00:00:00.000Z",\n    "unsubscribed": false,\n    "properties": {}\n  }`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend contacts get 479e3145-dd38-4932-8c0c-e58b548c9e76',
        'resend contacts get user@example.com',
        'resend contacts get 479e3145-dd38-4932-8c0c-e58b548c9e76 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactPickerConfig, globalOpts);
    await runGet(
      {
        spinner: {
          loading: 'Fetching contact...',
          success: 'Contact fetched',
          fail: 'Failed to fetch contact',
        },
        sdkCall: (resend) => resend.contacts.get(id),
        onInteractive: (data) => {
          const name = [data.first_name, data.last_name]
            .filter(Boolean)
            .join(' ');
          console.log(`\n${data.email}${name ? ` (${name})` : ''}`);
          console.log(`ID: ${data.id}`);
          console.log(`Created: ${data.created_at}`);
          console.log(`Unsubscribed: ${data.unsubscribed ? 'yes' : 'no'}`);
          const propEntries = Object.entries(data.properties ?? {});
          if (propEntries.length > 0) {
            console.log('Properties:');
            for (const [key, val] of propEntries) {
              console.log(`  ${key}: ${val.value}`);
            }
          }
        },
      },
      globalOpts,
    );
  });
