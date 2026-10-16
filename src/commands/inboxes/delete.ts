import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputResult } from '../../lib/output';
import { confirmDelete, pickItem } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';
import { inboxPickerConfig } from './utils';

export const deleteInboxCommand = new Command('delete')
  .alias('rm')
  .description('Delete an inbox')
  .argument('[id]', 'Inbox UUID or email address')
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
    const resend = await requireClient(globalOpts);
    if (!opts.yes) {
      await confirmDelete(
        picked.id,
        `Delete inbox "${picked.label}"?\nID: ${picked.id}\nAll threads and messages in this inbox will be removed.`,
        globalOpts,
      );
    }
    // The output comes from the API so an address argument still prints the inbox UUID.
    const data = await withSpinner(
      'Deleting inbox...',
      () => resend.inboxes.remove(picked.id),
      'delete_error',
      globalOpts,
    );
    if (!globalOpts.json && isInteractive()) {
      console.log('Inbox deleted');
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
