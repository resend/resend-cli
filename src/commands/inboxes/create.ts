import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { requireText } from '../../lib/prompts';

export const createInboxCommand = new Command('create')
  .description('Create a new inbox at one of your verified domains')
  .option(
    '--email_address <address>',
    'Email address for the inbox, e.g. support@yourdomain.com (required)',
  )
  .option('--name <name>', 'Inbox name shown in the dashboard')
  .option(
    '--from_name <name>',
    'Name used when sending from this inbox, e.g. "Ada from Support" (a plain name, not "Name <email>")',
  )
  .option(
    '--forwarding',
    'Receive mail without an MX record — Resend returns a receiving address to forward mail to',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `The address must belong to one of your verified domains.
Receiving must be enabled on the domain, unless you pass --forwarding.

Non-interactive: --email_address is required.`,
      output: `  {"object":"inbox","id":"<uuid>","name":"<name>","email_address":"<address>","domain_id":"<uuid>","receiving_address":"<address>|null","from_name":"<name>|null","unread":0,"drafts":0,"last_received":"<date>|null","created_at":"<date>"}`,
      errorCodes: ['auth_error', 'missing_email_address', 'create_error'],
      examples: [
        'resend inboxes create --email_address support@yourdomain.com',
        'resend inboxes create --email_address hello@yourdomain.com --name "Hello" --from_name "Team Hello" --forwarding',
        'resend inboxes create --email_address support@yourdomain.com --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const emailAddress = await requireText(
      opts.email_address,
      {
        message: 'Inbox email address',
        placeholder: 'e.g. support@yourdomain.com',
      },
      {
        message: 'Missing --email_address flag.',
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
            ...(opts.from_name !== undefined && { fromName: opts.from_name }),
            ...(opts.forwarding && { forwarding: true }),
          }),
        onInteractive: (data) => {
          console.log(`Inbox created: ${data.id}`);
          console.log(`Email address: ${data.email_address}`);
          if (data.receiving_address) {
            console.log(`Receiving address: ${data.receiving_address}`);
          }
        },
      },
      globalOpts,
    );
  });
