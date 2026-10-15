import { Command } from '@commander-js/extra-typings';
import type { CreateInboxDraftOptions } from 'resend';
import { runCreate } from '../../../lib/actions';
import { resolveDraftAttachments } from '../../../lib/attachments';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, resolveIdInputs } from '../utils';

export const createInboxDraftCommand = new Command('create')
  .description('Create a draft in an inbox')
  .argument('[inboxId]', 'Inbox UUID')
  .option('--inbox-id <id>', 'Inbox UUID')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--to <addresses...>', 'Recipient addresses')
  .option('--cc <addresses...>', 'Cc addresses')
  .option('--bcc <addresses...>', 'Bcc addresses')
  .option('--subject <subject>', 'Draft subject')
  .option('--text <text>', 'Plain text body')
  .option('--html <html>', 'HTML body')
  .option(
    '--attachment <specs...>',
    'Local file to attach, with ;type= (MIME type) and optional ;filename= params (quote the value)',
  )
  .option(
    '--attachments-file <path>',
    'Path to a JSON array of attachment objects (use "-" for stdin)',
  )
  .option(
    '--idempotency-key <key>',
    'Deduplicate this create request using this key',
  )
  .option(
    '--thread-id <id>',
    'Thread to reply to (requires --reply-to-email-id)',
  )
  .addOption(snakeCaseAlias('--thread-id <id>'))
  .option(
    '--reply-to-email-id <id>',
    'Email the draft replies to (requires --thread-id)',
  )
  .addOption(snakeCaseAlias('--reply-to-email-id <id>'))
  .addHelpText(
    'after',
    buildHelpText({
      context: `Creates a standalone draft, or a reply draft when --thread-id and
--reply-to-email-id are passed together. A reply draft without --to is
addressed to the sender of the email it replies to, or to its Reply-To when
set. For an email the inbox sent, it defaults to that email's "to" recipients.
At least one content field (--to, --cc, --bcc, --subject, --text, --html,
--attachment, --attachments-file) is required. Combined recipients cannot exceed 50.
Only one unsent reply draft can target an email. A reply draft for an email
that already has one returns the ID of the existing draft. That request ignores
every other flag, except the attachments, which replace the attachments of the
existing draft.
A reply draft created without --subject has an empty subject and gets no "Re:"
prefix, so set one before you send it.

Attachments: --attachment takes a local file path plus ;type= (the MIME type)
and an optional ;filename=, as on "resend emails send". Quote values that contain ";".
--attachments-file takes a JSON array of objects with content (base64), filename
and content_type. Draft attachments need content, filename and content_type.
A URL or a ;cid= returns an error. The files on a draft can total at most 25 MB.
An empty file or a blocked file type, such as .exe, returns an error.

Send the draft later with "resend inboxes drafts send".`,
      output: `  {"object":"inbox_draft","id":"<uuid>"}`,
      errorCodes: [
        'auth_error',
        'invalid_options',
        'missing_content',
        'invalid_attachment',
        'file_read_error',
        'stdin_read_error',
        'create_error',
      ],
      examples: [
        'resend inboxes drafts create <inbox-id> --to user@example.com --subject "Hello" --text "Draft body"',
        'resend inboxes drafts create <inbox-id> --thread-id <thread-id> --reply-to-email-id <email-id> --text "Reply draft" --json',
        'resend inboxes drafts create <inbox-id> --to user@example.com --text "Report attached" --attachment "./report.pdf;type=application/pdf"',
      ],
    }),
  )
  .action(async (inboxIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const ids = resolveIdInputs(
      { inbox: [inboxIdArg, opts.inboxId] },
      globalOpts,
    );

    if ((opts.threadId === undefined) !== (opts.replyToEmailId === undefined)) {
      outputError(
        {
          message:
            '--thread-id and --reply-to-email-id must be provided together.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    const attachments = resolveDraftAttachments(
      opts.attachment,
      opts.attachmentsFile,
      globalOpts,
    );

    const hasContent =
      opts.to !== undefined ||
      opts.cc !== undefined ||
      opts.bcc !== undefined ||
      opts.subject !== undefined ||
      opts.text !== undefined ||
      opts.html !== undefined ||
      (attachments?.length ?? 0) > 0;
    if (!hasContent) {
      outputError(
        {
          message:
            'Provide at least one of --to, --cc, --bcc, --subject, --text, --html, --attachment, or --attachments-file.',
          code: 'missing_content',
        },
        { json: globalOpts.json },
      );
    }

    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);

    // The SDK requires at least one content field and pairs threadId with
    // replyToEmailId at the type level; both are guaranteed by the guards
    // above but tsc cannot prove it across the conditional spreads.
    const payload = {
      inboxId,
      ...(opts.to && { to: opts.to }),
      ...(opts.cc && { cc: opts.cc }),
      ...(opts.bcc && { bcc: opts.bcc }),
      ...(opts.subject !== undefined && { subject: opts.subject }),
      ...(opts.text !== undefined && { text: opts.text }),
      ...(opts.html !== undefined && { html: opts.html }),
      ...(attachments && { attachments }),
      ...(opts.threadId !== undefined && {
        threadId: opts.threadId,
        replyToEmailId: opts.replyToEmailId,
      }),
    } as CreateInboxDraftOptions;

    await runCreate(
      {
        loading: 'Creating draft...',
        sdkCall: (resend) =>
          resend.inboxes.drafts.create(
            payload,
            opts.idempotencyKey !== undefined
              ? { idempotencyKey: opts.idempotencyKey }
              : undefined,
          ),
        onInteractive: (data) => {
          console.log(`Draft created: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
