import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import { outputError } from '../../../../lib/output';
import { pickId, requireText } from '../../../../lib/prompts';
import { inboxPickerConfig } from '../../utils';
import { inboxThreadPickerConfig } from '../utils';

const collectRecipients = (value: string, previous: string[]) => [
  ...previous,
  value,
];

export const forwardInboxThreadEmailCommand = new Command('forward')
  .description('Forward an email in a thread to other recipients')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--thread_id <id>', 'Thread UUID')
  .option(
    '--email_id <id>',
    'Email UUID to forward (from "threads emails list")',
  )
  .option(
    '--to <address>',
    'Recipient address (repeat the flag for multiple recipients)',
    collectRecipients,
    [] as string[],
  )
  .option(
    '--cc <address>',
    'Cc address (repeat the flag for multiple addresses)',
    collectRecipients,
    [] as string[],
  )
  .option(
    '--bcc <address>',
    'Bcc address (repeat the flag for multiple addresses)',
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
        'Forwards the email from the inbox address. --to is required; --text/--html add an optional note.\n--to, --cc, and --bcc combined cannot exceed 50 recipients.',
      output: `  {"id":"<uuid>","email_id":"<uuid>","direction":"outbound","from":"<inbox-address>","to":["<recipient>"],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>|null","message_id":"<message-id>|null","html":"<html>|null","text":"<text>|null","attachments":[],"read":true,"received_at":"<date>"}`,
      errorCodes: ['auth_error', 'missing_id', 'missing_to', 'create_error'],
      examples: [
        'resend inboxes threads emails forward --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --to teammate@example.com',
        'resend inboxes threads emails forward --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --to a@x.com --to b@x.com --cc c@x.com --text "FYI" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
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

    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      opts.thread_id,
      inboxThreadPickerConfig(inboxId),
      globalOpts,
    );
    const emailId = await requireText(
      opts.email_id,
      {
        message: 'Email ID to forward',
        placeholder: 'from "threads emails list"',
      },
      { message: 'Missing --email_id flag.', code: 'missing_id' },
      globalOpts,
    );

    await runCreate(
      {
        loading: 'Forwarding email...',
        sdkCall: (resend) =>
          resend.inboxes.threads.emails.forward({
            inboxId,
            threadId,
            emailId,
            to: opts.to,
            ...(opts.cc.length > 0 && { cc: opts.cc }),
            ...(opts.bcc.length > 0 && { bcc: opts.bcc }),
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
