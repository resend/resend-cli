import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { receivedEmailPickerConfig } from './utils';

export const forwardCommand = new Command('forward')
  .description('Forward a received email')
  .argument('[id]', 'Received email ID')
  .requiredOption('--to <addresses...>', 'Recipient address(es)')
  .requiredOption('--from <address>', 'Sender address')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Required: --to, --from\nForwards the original email content (passthrough mode).',
      output: '  {"id":"<email-id>"}',
      errorCodes: ['auth_error', 'create_error'],
      examples: [
        'resend emails receiving forward <email-id> --to user@example.com --from you@domain.com',
        'resend emails receiving forward <email-id> --to a@example.com --to b@example.com --from you@domain.com --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, receivedEmailPickerConfig, globalOpts);
    await runCreate(
      {
        spinner: {
          loading: 'Forwarding email...',
          success: 'Email forwarded',
          fail: 'Failed to forward email',
        },
        sdkCall: (resend) =>
          resend.emails.receiving.forward({
            emailId: id,
            to: opts.to,
            from: opts.from,
          }),
        onInteractive: (data) => {
          console.log(`\nEmail forwarded: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
