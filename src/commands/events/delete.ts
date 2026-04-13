import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { eventPickerConfig } from './utils';

export const deleteEventCommand = new Command('delete')
  .alias('rm')
  .description('Delete an event definition')
  .argument('[id]', 'Event ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.',
      output: '  {"object":"event","id":"<id>","deleted":true}',
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend events delete <id> --yes',
        'resend events delete <id> --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, eventPickerConfig, globalOpts);
    await runDelete(
      id,
      !!opts.yes,
      {
        confirmMessage: `Delete event ${id}?\nThis cannot be undone.`,
        loading: 'Deleting event...',
        object: 'event',
        successMsg: 'Event deleted',
        sdkCall: (resend) => resend.events.remove(id),
      },
      globalOpts,
    );
  });
