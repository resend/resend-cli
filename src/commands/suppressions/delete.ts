import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickItem } from '../../lib/prompts';
import { suppressionPickerConfig } from './utils';

export const deleteSuppressionCommand = new Command('delete')
  .alias('rm')
  .description(
    'Remove a suppression so the address can receive your emails again',
  )
  .argument('[id-or-email]', 'Suppression ID or the suppressed email address')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --yes is required to confirm removal when stdin/stdout is not a TTY.

Removing a suppression means future sends to this address are no longer skipped.`,
      output: `  {"object":"suppression","id":"<id>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend suppressions delete spam@example.com --yes',
        'resend suppressions rm 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const picked = await pickItem(idArg, suppressionPickerConfig, globalOpts);
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Remove suppression "${picked.label}"?\nID: ${picked.id}\nResend will be able to send to this address again.`,
        loading: 'Removing suppression...',
        object: 'suppression',
        successMsg: 'Suppression removed',
        sdkCall: (resend) => resend.suppressions.remove(picked.id),
      },
      globalOpts,
    );
  });
