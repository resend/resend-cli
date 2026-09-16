import { Command } from '@commander-js/extra-typings';
import type { CreateInboxDraftOptions } from 'resend';
import { runCreate } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';

const collectRecipients = (value: string, previous: string[]) => [
  ...previous,
  value,
];

export const createInboxDraftCommand = new Command('create')
  .description('Create a draft in an inbox')
  .option('--inbox-id <id>', 'Inbox UUID')
  .option(
    '--to <address>',
    'Recipient address (repeat the flag for multiple recipients)',
    collectRecipients,
    [] as string[],
  )
  .option(
    '--cc <address>',
    'Cc address (repeatable)',
    collectRecipients,
    [] as string[],
  )
  .option(
    '--bcc <address>',
    'Bcc address (repeatable)',
    collectRecipients,
    [] as string[],
  )
  .option('--subject <subject>', 'Draft subject')
  .option('--text <text>', 'Plain text body')
  .option('--html <html>', 'HTML body')
  .option(
    '--thread-id <threadId>',
    'Thread to reply to (requires --reply-to-email-id)',
  )
  .option(
    '--reply-to-email-id <emailId>',
    'Email the draft replies to (requires --thread-id)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Creates a standalone draft, or a reply draft when --thread-id and
--reply-to-email-id are passed together. At least one content field
(--to, --cc, --bcc, --subject, --text, --html) is required.

Send the draft later with "resend inboxes drafts send".`,
      output: `  {"object":"inbox_draft","id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>|null","html":"<html>|null","text":"<text>|null","thread_id":"<uuid>|null","reply_to_email_id":"<uuid>|null","email_id":null,"created_at":"<date>","updated_at":"<date>"}`,
      errorCodes: [
        'auth_error',
        'invalid_options',
        'missing_content',
        'create_error',
      ],
      examples: [
        'resend inboxes drafts create --inbox-id <inboxId> --to user@example.com --subject "Hello" --text "Draft body"',
        'resend inboxes drafts create --inbox-id <inboxId> --thread-id <threadId> --reply-to-email-id <emailId> --text "Reply draft" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (Boolean(opts.threadId) !== Boolean(opts.replyToEmailId)) {
      outputError(
        {
          message:
            '--thread-id and --reply-to-email-id must be provided together.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    const hasContent =
      opts.to.length > 0 ||
      opts.cc.length > 0 ||
      opts.bcc.length > 0 ||
      opts.subject !== undefined ||
      opts.text !== undefined ||
      opts.html !== undefined;
    if (!hasContent) {
      outputError(
        {
          message:
            'Provide at least one of --to, --cc, --bcc, --subject, --text, or --html.',
          code: 'missing_content',
        },
        { json: globalOpts.json },
      );
    }

    const inboxId = await pickId(opts.inboxId, inboxPickerConfig, globalOpts);

    // The SDK requires at least one content field and pairs threadId with
    // replyToEmailId at the type level; both are guaranteed by the guards
    // above but tsc cannot prove it across the conditional spreads.
    const payload = {
      inboxId,
      ...(opts.to.length > 0 && { to: opts.to }),
      ...(opts.cc.length > 0 && { cc: opts.cc }),
      ...(opts.bcc.length > 0 && { bcc: opts.bcc }),
      ...(opts.subject !== undefined && { subject: opts.subject }),
      ...(opts.text !== undefined && { text: opts.text }),
      ...(opts.html !== undefined && { html: opts.html }),
      ...(opts.threadId && {
        threadId: opts.threadId,
        replyToEmailId: opts.replyToEmailId,
      }),
    } as CreateInboxDraftOptions;

    await runCreate(
      {
        loading: 'Creating draft...',
        sdkCall: (resend) => resend.inboxes.drafts.create(payload),
        onInteractive: (data) => {
          console.log(`Draft created: ${data.id}`);
          console.log(`Type: ${data.type}`);
        },
      },
      globalOpts,
    );
  });
