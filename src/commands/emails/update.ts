import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { emailPickerConfig } from './utils';

export const updateCommand = new Command('update')
  .description('Update a scheduled email')
  .argument('[id]', 'Email ID')
  .requiredOption(
    '--scheduled-at <datetime>',
    'New scheduled date in ISO 8601 format (e.g. 2024-08-05T11:52:01.858Z)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: 'Required: --scheduled-at',
      output: '  {"object":"email","id":"<email-id>"}',
      errorCodes: ['auth_error', 'update_error'],
      examples: [
        'resend emails update <email-id> --scheduled-at 2024-08-05T11:52:01.858Z',
        'resend emails update <email-id> --scheduled-at 2024-08-05T11:52:01.858Z --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, emailPickerConfig, globalOpts);
    await runWrite(
      {
        loading: 'Updating email...',
        sdkCall: (resend) =>
          resend.emails.update({ id, scheduledAt: opts.scheduledAt }),
        errorCode: 'update_error',
        successMsg: `Email updated: ${id}`,
      },
      globalOpts,
    );
  });
