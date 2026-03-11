import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const deleteSegmentCommand = new Command('delete')
  .alias('rm')
  .description('Delete a segment')
  .argument('<id>', 'Segment UUID')
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Warning: Deleting a segment removes it as a target for future broadcasts,
  but does NOT delete the contacts within it.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"segment","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend segments delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
        'resend segments delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await runDelete(
      id,
      !!opts.yes,
      {
        confirmMessage: `Delete segment ${id}?\nContacts will not be deleted, but broadcasts targeting this segment will no longer work.`,
        spinner: {
          loading: 'Deleting segment...',
          success: 'Segment deleted',
          fail: 'Failed to delete segment',
        },
        object: 'segment',
        successMsg: 'Segment deleted.',
        sdkCall: (resend) => resend.segments.remove(id),
      },
      globalOpts,
    );
  });
