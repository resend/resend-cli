import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickItem } from '../../lib/prompts';
import { broadcastPickerConfig } from './utils';

export const deleteBroadcastCommand = new Command('delete')
  .alias('rm')
  .description(
    'Delete a broadcast — draft broadcasts are removed; scheduled broadcasts are cancelled before delivery',
  )
  .argument('[id]', 'Broadcast ID')
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
        'resend broadcasts delete d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --yes',
        'resend broadcasts delete d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const picked = await pickItem(idArg, broadcastPickerConfig, globalOpts);
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete broadcast "${picked.label}"?\nID: ${picked.id}\nIf scheduled, delivery will be cancelled.`,
        loading: 'Deleting broadcast...',
        object: 'broadcast',
        successMsg: 'Broadcast deleted',
        sdkCall: (resend) => resend.broadcasts.remove(picked.id),
      },
      globalOpts,
    );
  });
