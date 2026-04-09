import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { safeTerminalText } from '../../lib/safe-terminal-text';
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
      output: `  {\n    "object": "contact",\n    "id": "e169aa45-1ecf-4183-9955-b1499d5701d3",\n    "email": "steve.wozniak@gmail.com",\n    "first_name": "Steve",\n    "last_name": "Wozniak",\n    "created_at": "2026-01-01T00:00:00.000Z",\n    "unsubscribed": false,\n    "properties": {}\n  }`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend contacts get e169aa45-1ecf-4183-9955-b1499d5701d3',
        'resend contacts get steve.wozniak@gmail.com',
        'resend contacts get e169aa45-1ecf-4183-9955-b1499d5701d3 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching contact...',
        sdkCall: (resend) => resend.contacts.get(id),
        onInteractive: (data) => {
          const name = [data.first_name, data.last_name]
            .filter((s): s is string => Boolean(s))
            .map(safeTerminalText)
            .join(' ');
          console.log(
            `${safeTerminalText(data.email)}${name ? ` (${name})` : ''}`,
          );
          console.log(`ID: ${safeTerminalText(data.id)}`);
          console.log(`Created: ${safeTerminalText(data.created_at)}`);
          console.log(`Unsubscribed: ${data.unsubscribed ? 'yes' : 'no'}`);
          const propEntries = Object.entries(data.properties ?? {});
          if (propEntries.length > 0) {
            console.log('Properties:');
            propEntries.map(([key, val]) =>
              console.log(
                `  ${safeTerminalText(key)}: ${safeTerminalText(String(val.value))}`,
              ),
            );
          }
        },
      },
      globalOpts,
    );
  });
