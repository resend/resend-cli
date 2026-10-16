import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { requireText } from '../../lib/prompts';
import { snakeCaseAlias } from '../../lib/snake-case-alias';

export const createInboxCommand = new Command('create')
  .description('Create a new inbox at one of your verified domains')
  .option(
    '--email-address <address>',
    'Email address for the inbox, e.g. support@yourdomain.com (required)',
  )
  .addOption(snakeCaseAlias('--email-address <address>'))
  .option(
    '--name <name>',
    'Internal name for the inbox. Recipients do not see it',
  )
  .option(
    '--from-name <name>',
    'Name used when sending from this inbox, e.g. "Ada from Support" (a plain name, not "Name <email>")',
  )
  .addOption(snakeCaseAlias('--from-name <name>'))
  .option(
    '--forwarding',
    'Receive mail without an MX record — Resend generates a receiving address to forward mail to',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `The address must belong to one of your verified domains.
The part before the @ can contain letters, numbers, and . _ % -. A + returns an error.
Receiving must be enabled on the domain, unless you pass --forwarding.
With --forwarding, Resend generates a receiving address. Run "resend inboxes get <id>"
to read it.

Non-interactive: --email-address is required.`,
      output: `  {"object":"inbox","id":"<uuid>"}`,
      errorCodes: ['auth_error', 'missing_email_address', 'create_error'],
      examples: [
        'resend inboxes create --email-address support@yourdomain.com',
        'resend inboxes create --email-address hello@yourdomain.com --name "Hello" --from-name "Team Hello" --forwarding',
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
            ...(opts.name !== undefined && { name: opts.name }),
            ...(opts.fromName !== undefined && { fromName: opts.fromName }),
            ...(opts.forwarding && { forwarding: true }),
          }),
        onInteractive: (data) => {
          console.log(`Inbox created: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
