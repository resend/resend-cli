import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import { outputError } from '../../../../lib/output';

const collectRecipients = (value: string, previous: string[]) => [
  ...previous,
  value,
];

export const forwardInboxThreadEmailCommand = new Command('forward')
  .description('Forward an email in a thread to other recipients')
  .argument('<inboxId>', 'Inbox UUID')
  .argument('<threadId>', 'Thread UUID')
  .argument('<emailId>', 'Email UUID to forward (from "threads get")')
  .option(
    '--to <address>',
    'Recipient address (repeat the flag for multiple recipients)',
    collectRecipients,
    [] as string[],
  )
  .option('--text <text>', 'Plain text note to include with the forward')
  .option('--html <html>', 'HTML note to include with the forward')
  .option('--subject <subject>', 'Override the forwarded subject')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Forwards the email from the inbox address. --to is required; --text/--html add an optional note.',
      output: `  {"id":"<uuid>","email_id":"<uuid>","direction":"outbound","from":"<inbox-address>","to":["<recipient>"],"text":"<text>|null","html":"<html>|null","attachments":[],"read":true,"received_at":"<date>"}`,
      errorCodes: ['auth_error', 'missing_to', 'create_error'],
      examples: [
        'resend inboxes threads emails forward <inboxId> <threadId> <emailId> --to teammate@example.com',
        'resend inboxes threads emails forward <inboxId> <threadId> <emailId> --to a@x.com --to b@x.com --text "FYI" --json',
      ],
    }),
  )
  .action(async (inboxId, threadId, emailId, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (opts.to.length === 0) {
      outputError(
        {
          message: 'Provide at least one recipient with --to.',
          code: 'missing_to',
        },
        { json: globalOpts.json },
      );
    }

    await runCreate(
      {
        loading: 'Forwarding email...',
        sdkCall: (resend) =>
          resend.inboxes.threads.emails.forward({
            inboxId,
            threadId,
            emailId,
            to: opts.to,
            ...(opts.text && { text: opts.text }),
            ...(opts.html && { html: opts.html }),
            ...(opts.subject && { subject: opts.subject }),
          }),
        onInteractive: (data) => {
          console.log(`Email forwarded: ${data.email_id}`);
          console.log(`To: ${data.to.join(', ')}`);
        },
      },
      globalOpts,
    );
  });
