import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickItem } from '../../lib/prompts';
import { inboxPickerConfig } from './utils';

export const deleteInboxCommand = new Command('delete')
  .alias('rm')
  .description('Delete an inbox')
  .argument('[id]', 'Inbox UUID')
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Warning: Deleting an inbox removes its threads and messages, and the address
stops receiving email.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"inbox","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend inboxes delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
        'resend inboxes delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const picked = await pickItem(idArg, inboxPickerConfig, globalOpts);
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete inbox "${picked.label}"?\nID: ${picked.id}\nAll threads and messages in this inbox will be removed.`,
        loading: 'Deleting inbox...',
        object: 'inbox',
        successMsg: 'Inbox deleted',
        sdkCall: (resend) => resend.inboxes.remove(picked.id),
      },
      globalOpts,
    );
  });
