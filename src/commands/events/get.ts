import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { eventPickerConfig, formatSchema } from './utils';

export const getEventCommand = new Command('get')
  .description('Retrieve an event definition')
  .argument('[id]', 'Event ID')
  .addHelpText(
    'after',
    buildHelpText({
      output: '  Full event object including schema.',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: ['resend events get <id>', 'resend events get <id> --json'],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, eventPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching event...',
        sdkCall: (resend) => resend.events.get(id),
        onInteractive: (e) => {
          console.log(e.name);
          console.log(`ID: ${e.id}`);
          console.log(`Schema: ${formatSchema(e.schema)}`);
          console.log(`Created: ${e.created_at}`);
          if (e.updated_at) {
            console.log(`Updated: ${e.updated_at}`);
          }
        },
      },
      globalOpts,
    );
  });
