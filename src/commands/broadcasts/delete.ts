import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const deleteBroadcastCommand = new Command('delete')
  .alias('rm')
  .description(
    'Delete a broadcast — draft broadcasts are removed; scheduled broadcasts are cancelled before delivery',
  )
  .argument('<id>', 'Broadcast ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Warning: Deleting a scheduled broadcast cancels its delivery immediately.
Only draft and scheduled broadcasts can be deleted; sent broadcasts cannot.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"broadcast","id":"<id>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend broadcasts delete bcast_123abc --yes',
        'resend broadcasts delete bcast_123abc --yes --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await runDelete(
      id,
      !!opts.yes,
      {
        confirmMessage: `Delete broadcast ${id}?\nIf scheduled, delivery will be cancelled.`,
        spinner: {
          loading: 'Deleting broadcast...',
          success: 'Broadcast deleted',
          fail: 'Failed to delete broadcast',
        },
        object: 'broadcast',
        successMsg: 'Broadcast deleted.',
        sdkCall: (resend) => resend.broadcasts.remove(id),
      },
      globalOpts,
    );
  });
