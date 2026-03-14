import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/formatters';

export const cancelCommand = new Command('cancel')
  .description('Cancel a scheduled email')
  .argument('<id>', 'Email ID')
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
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await runWrite(
      {
        spinner: {
          loading: 'Cancelling email...',
          success: 'Email cancelled',
          fail: 'Failed to cancel email',
        },
        sdkCall: (resend) => resend.emails.cancel(id),
        errorCode: 'cancel_error',
        successMsg: `\nEmail cancelled: ${id}`,
      },
      globalOpts,
    );
  });
