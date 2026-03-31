import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { emailPickerConfig } from './utils';

export const cancelCommand = new Command('cancel')
  .description('Cancel a scheduled email')
  .argument('[id]', 'Email ID')
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"email","id":"<email-id>"}',
      errorCodes: ['auth_error', 'cancel_error'],
      examples: [
        'resend emails cancel <email-id>',
        'resend emails cancel <email-id> --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, emailPickerConfig, globalOpts);
    await runWrite(
      {
        loading: 'Cancelling email...',
        sdkCall: (resend) => resend.emails.cancel(id),
        errorCode: 'cancel_error',
        successMsg: `Email cancelled: ${id}`,
      },
      globalOpts,
    );
  });
