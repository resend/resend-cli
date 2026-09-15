import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { requireText } from '../../lib/prompts';

export const createInboxCommand = new Command('create')
  .description('Create a new inbox at one of your verified domains')
  .option(
    '--email-address <address>',
    'Email address for the inbox, e.g. support@yourdomain.com (required)',
  )
  .option('--name <name>', 'Inbox name shown in the dashboard')
  .option(
    '--forwarding',
    'Enable forwarding — received emails are also forwarded to a generated forwarding address',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `The address must belong to one of your verified domains with receiving enabled.

Non-interactive: --email-address is required.`,
      output: `  {"object":"inbox","id":"<uuid>","name":"<name>","email_address":"<address>","domain_id":"<uuid>","forwarding_address":"<address>|null","unread":0,"created_at":"<date>"}`,
      errorCodes: ['auth_error', 'missing_email_address', 'create_error'],
      examples: [
        'resend inboxes create --email-address support@yourdomain.com',
        'resend inboxes create --email-address hello@yourdomain.com --name "Hello" --forwarding',
        'resend inboxes create --email-address support@yourdomain.com --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const emailAddress = await requireText(
      opts.emailAddress,
      {
        message: 'Inbox email address',
        placeholder: 'e.g. support@yourdomain.com',
      },
      {
        message: 'Missing --email-address flag.',
        code: 'missing_email_address',
      },
      globalOpts,
    );

    await runCreate(
      {
        loading: 'Creating inbox...',
        sdkCall: (resend) =>
          resend.inboxes.create({
            emailAddress,
            ...(opts.name && { name: opts.name }),
            ...(opts.forwarding && { forwarding: true }),
          }),
        onInteractive: (data) => {
          console.log(`Inbox created: ${data.id}`);
          console.log(`Email address: ${data.email_address}`);
          if (data.forwarding_address) {
            console.log(`Forwarding address: ${data.forwarding_address}`);
          }
        },
      },
      globalOpts,
    );
  });
